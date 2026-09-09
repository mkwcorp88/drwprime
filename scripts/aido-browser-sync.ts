import { execFile } from 'child_process';
import { promisify } from 'util';
import { runAidoSync, type AidoSyncSource } from '@/lib/aido/sync';
import { isValidSyncDate, getPreviousJakartaDate, mapAidoPatient } from '@/lib/aido/mapping';
import type { AidoSession } from '@/lib/aido/client';

const execFileAsync = promisify(execFile);
const DEFAULT_SESSION = 'aido-drv';

type AgentBrowserEvalResponse = {
  success?: boolean;
  data?: { result?: unknown };
  error?: unknown;
};

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const directIndex = process.argv.indexOf(name);
  if (directIndex >= 0) return process.argv[directIndex + 1] || null;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function getSyncDate(): string {
  const date = getArgValue('--date') || getPreviousJakartaDate();
  if (!isValidSyncDate(date)) {
    throw new Error('Invalid --date; expected YYYY-MM-DD');
  }
  return date;
}

function getSessionName(): string {
  return getArgValue('--session') || process.env.AIDO_BROWSER_SESSION || DEFAULT_SESSION;
}

async function browserEval<T>(script: string): Promise<T> {
  const { stdout } = await execFileAsync('agent-browser', [
    '--session',
    getSessionName(),
    'eval',
    '--json',
    script,
  ], {
    maxBuffer: 1024 * 1024 * 256,
    timeout: 600_000,
  });
  const payload = JSON.parse(stdout) as AgentBrowserEvalResponse;
  if (!payload.success) throw new Error(`agent-browser eval failed: ${JSON.stringify(payload.error)}`);
  return payload.data?.result as T;
}

function createBrowserAidoSource(options: { patientsOnly?: boolean } = {}): AidoSyncSource {
  let cachedSession: AidoSession | null = null;

  async function readSession(): Promise<AidoSession> {
    if (cachedSession) return cachedSession;
    cachedSession = await browserEval<AidoSession>(String.raw`
      (() => {
        const accessToken = localStorage.getItem('accessToken');
        const hospitalId = localStorage.getItem('hospitalId');
        const hospitalGroupId = localStorage.getItem('hospitalGroupId');
        let hospitalName = null;
        try {
          hospitalName = JSON.parse(localStorage.getItem('hospitalRole') || '{}')?.hospital?.name || null;
        } catch {}
        if (!accessToken || !hospitalId || !hospitalGroupId) {
          throw new Error('AIDO browser session is not logged in');
        }
        return { accessToken, hospitalId, hospitalGroupId, hospitalName };
      })()
    `);
    return cachedSession;
  }

  async function fetchAllPages(options: {
    endpoint: string;
    rowExpression: string;
    extraParams: Record<string, string>;
    onPage?: () => Promise<void>;
  }): Promise<unknown[]> {
    const session = await readSession();
    const limit = 100;
    const result = await browserEval<unknown[]>(`
      (async () => {
        const token = localStorage.getItem('accessToken');
        const allRows = [];
        let expectedTotal = null;
        for (let page = 1; page <= 1000; page++) {
          const params = new URLSearchParams(${JSON.stringify({
            ...options.extraParams,
            hospitalId: session.hospitalId,
            hospitalGroupId: session.hospitalGroupId,
          })});
          params.set('page', String(page));
          params.set('limit', '${limit}');
          const response = await fetch('${options.endpoint}?' + params.toString(), {
            headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
            credentials: 'include',
          });
          const json = await response.json();
          if (!response.ok || ![200, undefined].includes(json?.status ?? json?.statusCode)) {
            throw new Error('AIDO browser request failed at page ' + page);
          }
          const rows = ${options.rowExpression};
          const total = json?.data?.totalData ?? json?.data?.total ?? json?.totalData;
          if (!Array.isArray(rows) || !Number.isSafeInteger(total)) {
            throw new Error('Unexpected AIDO browser response at page ' + page);
          }
          if (expectedTotal !== null && total !== expectedTotal) {
            throw new Error('AIDO total changed during fetch');
          }
          expectedTotal = total;
          allRows.push(...rows);
          if (allRows.length >= total) break;
          if (rows.length === 0) throw new Error('AIDO returned empty page before total');
        }
        if (expectedTotal === null || allRows.length !== expectedTotal) {
          throw new Error('AIDO fetch incomplete: ' + allRows.length + ' of ' + expectedTotal);
        }
        return allRows;
      })()
    `);
    await options.onPage?.();
    return result;
  }

  return {
    login: readSession,
    getAllPatients: async (_session, onPage) => fetchAllPages({
      endpoint: '/api/emr/v1/api/patients/search',
      rowExpression: 'json?.data?.patients || json?.patients || []',
      extraParams: { count: 'true' },
      onPage,
    }),
    getIncome: async (_session, date, onPage) => {
      if (options.patientsOnly) return [];
      return fetchAllPages({
        endpoint: '/api/sales/v1/api/report/income',
        rowExpression: 'json?.data?.report || json?.data?.reports || json?.report || json?.reports || []',
        extraParams: { periodFrom: date, periodTo: date },
        onPage,
      });
    },
  };
}

async function main() {
  const date = getSyncDate();
  const dryRun = process.argv.includes('--dry-run');
  const patientsOnly = process.argv.includes('--patients-only');
  const patientsPreview = process.argv.includes('--patients-preview');
  const source = createBrowserAidoSource({ patientsOnly: patientsOnly || patientsPreview });

  if (patientsPreview) {
    const session = await source.login();
    const rawPatients = await source.getAllPatients(session);
    const patients = rawPatients.map(mapAidoPatient).filter((patient) => patient !== null);
    const withMrNumber = patients.filter((patient) => patient.mrNumber).length;
    console.log(JSON.stringify({
      success: true,
      hospitalId: session.hospitalId,
      patientsFetched: rawPatients.length,
      patientsMapped: patients.length,
      invalidRows: rawPatients.length - patients.length,
      withMrNumber,
    }, null, 2));
    return;
  }

  const summary = await runAidoSync({
    date,
    dryRun,
    mode: patientsOnly ? 'manual-browser-patients' : 'manual-browser',
    source,
  });
  console.log(JSON.stringify({ success: true, summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
