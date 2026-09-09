import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const AIDO_ORIGIN = 'https://klinika.aido.id';
const DEFAULT_SYNC_URL = 'http://127.0.0.1:5054/api/internal/aido-browser-sync';
const DEFAULT_SESSION = 'drwprime-aido';
const DEFAULT_PROFILE = 'aido-production';
const PAGE_SIZE = 100;

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] || null;
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function jakartaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function previousJakartaDate() {
  return jakartaDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

function sessionName() {
  return argValue('--session') || process.env.AIDO_BROWSER_SESSION || DEFAULT_SESSION;
}

function profileName() {
  return process.env.AIDO_BROWSER_PROFILE || DEFAULT_PROFILE;
}

async function browserCommand(args, options = {}) {
  try {
    const { stdout } = await execFileAsync('agent-browser', [
      '--session', sessionName(),
      '--restore',
      '--restore-save', 'auto',
      ...args,
    ], {
      timeout: options.timeout || 900_000,
      maxBuffer: options.maxBuffer || 256 * 1024 * 1024,
    });
    return stdout;
  } catch {
    throw new Error('agent-browser command failed');
  }
}

async function browserEval(script) {
  const stdout = await browserCommand(['eval', '--json', script]);
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('agent-browser returned an invalid response');
  }
  if (!payload.success) throw new Error('agent-browser evaluation failed');
  return payload.data?.result;
}

async function openAido() {
  await browserCommand(['open', `${AIDO_ORIGIN}/`], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
}

async function sessionIsReady() {
  return browserEval(`
    (async () => {
      const token = localStorage.getItem('accessToken');
      const hospitalId = localStorage.getItem('hospitalId');
      const hospitalGroupId = localStorage.getItem('hospitalGroupId');
      if (!token || !hospitalId || !hospitalGroupId) return { ready: false };
      const params = new URLSearchParams({
        hospitalId,
        hospitalGroupId,
        count: 'true',
        page: '1',
        limit: '1',
      });
      try {
        const response = await fetch('/api/emr/v1/api/patients/search?' + params.toString(), {
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          credentials: 'include',
        });
        return { ready: response.ok, status: response.status };
      } catch {
        return { ready: false };
      }
    })()
  `);
}

async function ensureLogin() {
  await openAido();
  const state = await sessionIsReady();
  if (state?.ready) return;

  await browserCommand(['auth', 'login', profileName()], { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  await browserCommand(['wait', '--load', 'domcontentloaded'], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  const refreshed = await sessionIsReady();
  if (!refreshed?.ready) throw new Error('AIDO browser session is not authenticated');
}

async function fetchAidoPayload(date, patientsOnly) {
  const request = JSON.stringify({ date, patientsOnly, pageSize: PAGE_SIZE });
  return browserEval(`
    (async () => {
      const config = ${request};
      const token = localStorage.getItem('accessToken');
      const hospitalId = localStorage.getItem('hospitalId');
      const hospitalGroupId = localStorage.getItem('hospitalGroupId');
      if (!token || !hospitalId || !hospitalGroupId) throw new Error('AIDO session is not authenticated');

      async function getPages(endpoint, extraParams, getRows, mapRow) {
        const allRows = [];
        let expectedTotal = null;
        for (let page = 1; page <= 1000; page += 1) {
          const params = new URLSearchParams({ ...extraParams, hospitalId, hospitalGroupId, page: String(page), limit: String(config.pageSize) });
          const response = await fetch(endpoint + '?' + params.toString(), { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, credentials: 'include' });
          const json = await response.json();
          if (!response.ok || (json?.status !== undefined && json.status !== 200)) throw new Error('AIDO request failed at page ' + page);
          const rows = getRows(json);
          const total = Number(json?.data?.totalData ?? json?.data?.total ?? json?.totalData);
          if (!Array.isArray(rows) || !Number.isSafeInteger(total) || total < 0) throw new Error('Unexpected AIDO response at page ' + page);
          if (expectedTotal !== null && expectedTotal !== total) throw new Error('AIDO total changed during fetch');
          expectedTotal = total;
          allRows.push(...rows.map(mapRow));
          if (allRows.length >= total) break;
          if (rows.length === 0) throw new Error('AIDO returned an empty page before total');
        }
        if (expectedTotal === null || allRows.length !== expectedTotal) throw new Error('AIDO response is incomplete');
        return allRows;
      }

      const patients = await getPages(
        '/api/emr/v1/api/patients/search',
        { count: 'true' },
        (json) => json?.data?.patients || json?.patients || [],
        (row) => ({ uuid: row.uuid ?? null, id: row.id ?? null, firstName: row.firstName ?? null, lastName: row.lastName ?? null, mrNumber: row.mrNumber ?? null, dob: row.dob ?? null, gender: row.gender ?? null, identityNumber: row.identityNumber ?? null, waNumber: row.waNumber ?? null, phoneNumber: row.phoneNumber ?? null }),
      );
      const income = config.patientsOnly ? [] : await getPages(
        '/api/sales/v1/api/report/income',
        { periodFrom: config.date, periodTo: config.date },
        (json) => json?.data?.report || json?.data?.reports || json?.report || json?.reports || [],
        (row) => ({ id: row.id ?? null, trxuuid: row.trxuuid ?? null, trxnumber: row.trxnumber ?? null, paymentdate: row.paymentdate ?? null, totalbill: row.totalbill ?? null, visitname: row.visitname ?? null, medicalcategoriesname: row.medicalcategoriesname ?? null, registrationnumber: row.registrationnumber ?? null, nomorkwitansi: row.nomorkwitansi ?? null, patientUuid: row.patientUuid ?? null, patientId: row.patientId ?? null, patientsId: row.patientsId ?? null, mrNumber: row.mrNumber ?? null, patientMr: row.patientMr ?? null, description: row.description && typeof row.description === 'object' ? { patientUuid: row.description.patientUuid ?? null, patientId: row.description.patientId ?? null, mrNumber: row.description.mrNumber ?? null, name: row.description.name ?? null, dob: row.description.dob ?? null, gender: row.description.gender ?? null } : null }),
      );
      return { hospitalId, hospitalGroupId, patients, income };
    })()
  `);
}

async function postPayload(payload, date, dryRun) {
  const secret = process.env.AIDO_SYNC_SECRET;
  if (!secret) throw new Error('AIDO_SYNC_SECRET is not configured');
  const response = await fetch(process.env.AIDO_BROWSER_SYNC_URL || DEFAULT_SYNC_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, date, dryRun }),
    signal: AbortSignal.timeout(900_000),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`DRW Prime sync returned HTTP ${response.status}`);
  }
  if (![200, 422].includes(response.status)) {
    throw new Error(body?.error || `DRW Prime sync returned HTTP ${response.status}`);
  }
  return { body, reviewRequired: response.status === 422 };
}

async function run() {
  const date = argValue('--date') || previousJakartaDate();
  const dryRun = process.argv.includes('--dry-run');
  const patientsOnly = process.argv.includes('--patients-only');
  const allowReview = process.argv.includes('--allow-review');

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await ensureLogin();
      const payload = await fetchAidoPayload(date, patientsOnly);
      const result = await postPayload(payload, date, dryRun);
      if (result.reviewRequired && !allowReview) {
        throw new Error('AIDO sync completed with review-required rows');
      }
      console.log(JSON.stringify({
        success: true,
        date,
        patientsFetched: payload.patients.length,
        incomeFetched: payload.income.length,
        reviewRequired: result.reviewRequired,
        summary: result.body.summary || null,
      }, null, 2));
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 30_000));
    }
  }
  throw lastError || new Error('AIDO browser job failed');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'AIDO browser job failed');
  process.exit(1);
});
