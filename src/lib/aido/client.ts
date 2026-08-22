type JsonRecord = Record<string, unknown>;

export type AidoSession = {
  accessToken: string;
  hospitalId: string;
  hospitalGroupId: string;
  hospitalName: string | null;
};

export type AidoClientConfig = {
  baseUrl: string;
  email: string;
  password: string;
  hospitalId: string;
  hospitalGroupId: string;
  timeoutMs?: number;
};

export class AidoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AidoConfigurationError';
  }
}

export class AidoRequestError extends Error {
  constructor(endpoint: string, status?: number) {
    super(`AIDO request failed for ${endpoint}${status ? ` (${status})` : ''}`);
    this.name = 'AidoRequestError';
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split('.')) {
    if (!isRecord(current)) return undefined;
    const matchingKey = Object.keys(current).find((key) => key === part)
      || Object.keys(current).find((key) => key.toLowerCase() === part.toLowerCase());
    if (!matchingKey) return undefined;
    current = current[matchingKey];
  }
  return current;
}

function readString(value: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const candidate = readPath(value, path);
    if (candidate === null || candidate === undefined) continue;
    if (typeof candidate !== 'string' && typeof candidate !== 'number') continue;
    if (typeof candidate === 'number' && !Number.isFinite(candidate)) continue;
    const text = String(candidate).trim();
    if (text) return text;
  }
  return null;
}

function readArray(value: unknown, paths: string[]): unknown[] | null {
  for (const path of paths) {
    const candidate = readPath(value, path);
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

function readCount(value: unknown, paths: string[]): number | null {
  for (const path of paths) {
    const candidate = readPath(value, path);
    const parsed = typeof candidate === 'number'
      ? candidate
      : typeof candidate === 'string' && /^\d+$/.test(candidate.trim())
        ? Number(candidate)
        : Number.NaN;
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

export class AidoClient {
  private readonly config: AidoClientConfig;

  constructor(config: AidoClientConfig) {
    this.config = config;
  }

  static fromEnv(): AidoClient {
    const email = process.env.AIDO_EMAIL?.trim();
    const password = process.env.AIDO_PASSWORD;
    const hospitalId = process.env.AIDO_HOSPITAL_ID?.trim();
    const hospitalGroupId = process.env.AIDO_HOSPITAL_GROUP_ID?.trim();
    if (!email || !password || !hospitalId || !hospitalGroupId) {
      throw new AidoConfigurationError(
        'AIDO_EMAIL, AIDO_PASSWORD, AIDO_HOSPITAL_ID, and AIDO_HOSPITAL_GROUP_ID must be configured'
      );
    }

    const baseUrl = process.env.AIDO_BASE_URL?.trim() || 'https://klinika.aido.id';
    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch {
      throw new AidoConfigurationError('AIDO_BASE_URL must be a valid HTTPS URL');
    }
    if (parsedBaseUrl.protocol !== 'https:' || parsedBaseUrl.hostname !== 'klinika.aido.id') {
      throw new AidoConfigurationError('AIDO_BASE_URL must use the approved AIDO HTTPS origin');
    }
    const timeoutMs = Number(process.env.AIDO_TIMEOUT_MS || 30_000);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
      throw new AidoConfigurationError('AIDO_TIMEOUT_MS must be between 1000 and 120000');
    }

    return new AidoClient({
      baseUrl: parsedBaseUrl.origin,
      email,
      password,
      hospitalId,
      hospitalGroupId,
      timeoutMs,
    });
  }

  private async request(endpoint: string, init: RequestInit = {}, accessToken?: string): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    try {
      const response = await fetch(new URL(endpoint, this.config.baseUrl), {
        ...init,
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(this.config.timeoutMs || 30_000),
      });

      if (!response.ok) throw new AidoRequestError(endpoint, response.status);
      return await response.json();
    } catch (error) {
      if (error instanceof AidoRequestError) throw error;
      throw new AidoRequestError(endpoint);
    }
  }

  async login(): Promise<AidoSession> {
    const response = await this.request('/api/iam/v1/login', {
      method: 'POST',
      body: JSON.stringify({ email: this.config.email, password: this.config.password }),
    });

    const status = readCount(response, ['status', 'statusCode']);
    const accessToken = readString(response, ['data.accessToken', 'accessToken']);
    if (status !== 200 || !accessToken) throw new AidoRequestError('/api/iam/v1/login');

    const roles = (readArray(response, ['data.user.roles', 'user.roles']) || []).filter(isRecord);
    const matchingRole = roles.find((item) => {
      const roleHospitalId = readString(item, ['hospital.id', 'hospital.hospitalId']);
      return roleHospitalId === this.config.hospitalId;
    });
    if (!matchingRole) {
      throw new AidoConfigurationError('Configured AIDO hospital is not assigned to this account');
    }
    const role = matchingRole;

    const hospitalId = readString(role, ['hospital.id', 'hospital.hospitalId']);
    const accountHospitalGroupId = readString(response, [
      'data.user.group.id',
      'data.user.hospitalGroupId',
      'user.group.id',
    ]);
    if (this.config.hospitalGroupId !== accountHospitalGroupId) {
      throw new AidoConfigurationError('Configured AIDO hospital group does not match this account');
    }
    const hospitalGroupId = accountHospitalGroupId;

    if (!hospitalId || !hospitalGroupId) {
      throw new AidoConfigurationError('AIDO hospital role is not available for this account');
    }

    return {
      accessToken,
      hospitalId,
      hospitalGroupId,
      hospitalName: readString(role, ['hospital.name', 'hospital.hospitalName']),
    };
  }

  async getAllPatients(session: AidoSession, onPage?: () => Promise<void>): Promise<unknown[]> {
    return this.getAllPages({
      endpoint: '/api/emr/v1/api/patients/search',
      session,
      rowPaths: ['data.patients', 'patients'],
      idPaths: ['uuid', 'patientUuid', 'patientsUuid', 'patient.uuid', 'id', 'patientId', 'patientsId', 'patient.id'],
      onPage,
      extraParams: {
        hospitalGroupId: session.hospitalGroupId,
        hospitalId: session.hospitalId,
        count: 'true',
      },
    });
  }

  async getIncome(session: AidoSession, date: string, onPage?: () => Promise<void>): Promise<unknown[]> {
    return this.getAllPages({
      endpoint: '/api/sales/v1/api/report/income',
      session,
      rowPaths: ['data.report', 'data.reports', 'report', 'reports'],
      idPaths: ['trxuuid', 'trxUuid', 'transactionUuid', 'uuid', 'trxnumber', 'trxNumber', 'transactionNumber', 'id'],
      onPage,
      extraParams: {
        hospitalGroupId: session.hospitalGroupId,
        hospitalId: session.hospitalId,
        periodFrom: date,
        periodTo: date,
      },
    });
  }

  private async getAllPages(options: {
    endpoint: string;
    session: AidoSession;
    rowPaths: string[];
    idPaths: string[];
    extraParams: Record<string, string>;
    onPage?: () => Promise<void>;
  }): Promise<unknown[]> {
    const limit = 100;
    const result: unknown[] = [];
    const sourceIds = new Set<string>();
    let expectedTotal: number | null = null;

    for (let page = 1; page <= 1_000; page += 1) {
      const params = new URLSearchParams({
        ...options.extraParams,
        page: String(page),
        limit: String(limit),
      });
      const endpoint = `${options.endpoint}?${params.toString()}`;
      const response = await this.request(endpoint, {}, options.session.accessToken);
      const responseStatus = readCount(response, ['status', 'statusCode']);
      if (responseStatus !== 200) {
        throw new AidoRequestError(options.endpoint);
      }
      const rows = readArray(response, options.rowPaths);
      if (!rows) throw new AidoRequestError(options.endpoint);
      const total = readCount(response, ['totalData', 'data.totalData', 'data.total']);
      if (total === null) throw new AidoRequestError(options.endpoint);
      if (expectedTotal !== null && total !== expectedTotal) throw new AidoRequestError(options.endpoint);
      expectedTotal = total;

      for (const row of rows) {
        const sourceId = readString(row, options.idPaths);
        if (!sourceId || sourceIds.has(sourceId)) throw new AidoRequestError(options.endpoint);
        sourceIds.add(sourceId);
      }
      result.push(...rows);
      await options.onPage?.();

      if (result.length === total) return result;
      if (result.length > total || rows.length === 0 || rows.length < limit) {
        throw new AidoRequestError(options.endpoint);
      }
    }

    throw new AidoRequestError(options.endpoint);
  }
}
