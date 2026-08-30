import { beforeEach, describe, expect, it, vi } from 'vitest';

const aido = vi.hoisted(() => ({
  fromEnv: vi.fn(),
  login: vi.fn(),
  getAllPatients: vi.fn(),
}));

vi.mock('@/lib/aido/client', () => ({
  AidoClient: { fromEnv: aido.fromEnv },
}));

const session = {
  accessToken: 'test-token',
  hospitalId: 'hospital-1',
  hospitalGroupId: 'group-1',
  hospitalName: 'Test Clinic',
};

describe('AIDO patient directory', () => {
  beforeEach(() => {
    vi.resetModules();
    aido.fromEnv.mockReset();
    aido.login.mockReset();
    aido.getAllPatients.mockReset();
    aido.fromEnv.mockReturnValue({ login: aido.login, getAllPatients: aido.getAllPatients });
    aido.login.mockResolvedValue(session);
    aido.getAllPatients.mockResolvedValue([
      { uuid: 'patient-1', firstName: 'Sari', lastName: 'Utami', mrNumber: 'RM-001', waNumber: '081234567890' },
      { uuid: 'patient-2', firstName: 'Budi', lastName: 'Santoso', mrNumber: 'RM-002' },
    ]);
  });

  it('maps and filters by name or medical record number', async () => {
    const { searchAidoPatients } = await import('@/lib/aido/patient-directory');

    await expect(searchAidoPatients('rm-001')).resolves.toMatchObject([
      { externalPatientId: 'patient-1', firstName: 'Sari', mrNumber: 'RM-001', phone: '6281234567890' },
    ]);
  });

  it('shares one authenticated directory request between concurrent searches', async () => {
    const { searchAidoPatients } = await import('@/lib/aido/patient-directory');

    await Promise.all([searchAidoPatients('sari'), searchAidoPatients('budi')]);

    expect(aido.fromEnv).toHaveBeenCalledTimes(1);
    expect(aido.login).toHaveBeenCalledTimes(1);
    expect(aido.getAllPatients).toHaveBeenCalledTimes(1);
  });
});
