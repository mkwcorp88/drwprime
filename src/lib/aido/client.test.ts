import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AidoClient,
  AidoConfigurationError,
  AidoRequestError,
  AidoSession,
} from '@/lib/aido/client';

const session: AidoSession = {
  accessToken: 'test-token',
  hospitalId: 'hospital-1',
  hospitalGroupId: 'group-1',
  hospitalName: 'Test Clinic',
};

function createClient() {
  return new AidoClient({
    baseUrl: 'https://klinika.aido.id',
    email: 'sync@example.test',
    password: 'test-password',
    hospitalId: 'hospital-1',
    hospitalGroupId: 'group-1',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AIDO pagination validation', () => {
  it('returns a complete patient page with a verified total', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      totalData: 2,
      data: { patients: [{ uuid: 'one' }, { uuid: 'two' }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(createClient().getAllPatients(session)).resolves.toHaveLength(2);
  });

  it('prefers the nested source total when the top-level total is zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      totalData: 0,
      data: { totalData: 2, patients: [{ uuid: 'one' }, { uuid: 'two' }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(createClient().getAllPatients(session)).resolves.toHaveLength(2);
  });

  it('fails closed when the source total is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      data: { patients: [] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(createClient().getAllPatients(session)).rejects.toBeInstanceOf(AidoRequestError);
  });

  it('fails closed when a short page disagrees with the source total', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      totalData: 10,
      data: { patients: [{ uuid: 'one' }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(createClient().getAllPatients(session)).rejects.toBeInstanceOf(AidoRequestError);
  });

  it('fails closed when source rows repeat an identifier', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      totalData: 2,
      data: { patients: [{ uuid: 'same' }, { uuid: 'same' }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(createClient().getAllPatients(session)).rejects.toBeInstanceOf(AidoRequestError);
  });

  it('fails closed when the source total is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      totalData: null,
      data: { patients: [] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(createClient().getAllPatients(session)).rejects.toBeInstanceOf(AidoRequestError);
  });

  it('loads every page and invokes the lease heartbeat', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ uuid: `patient-${index}` }));
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 200,
        totalData: 101,
        data: { patients: firstPage },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 200,
        totalData: 101,
        data: { patients: [{ uuid: 'patient-100' }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const heartbeat = vi.fn().mockResolvedValue(undefined);

    await expect(createClient().getAllPatients(session, heartbeat)).resolves.toHaveLength(101);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });
});

describe('AIDO hospital selection', () => {
  it('uses only the explicitly configured hospital role', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      data: {
        accessToken: 'access-token',
        user: {
          group: { id: 'group-1' },
          roles: [{ hospital: { id: 'hospital-1', name: 'Test Clinic' } }],
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(createClient().login()).resolves.toMatchObject({
      hospitalId: 'hospital-1',
      hospitalGroupId: 'group-1',
    });
  });

  it('rejects an account without the configured hospital role', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      data: {
        accessToken: 'access-token',
        user: {
          group: { id: 'group-1' },
          roles: [{ hospital: { id: 'another-hospital' } }],
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(createClient().login()).rejects.toBeInstanceOf(AidoConfigurationError);
  });
});
