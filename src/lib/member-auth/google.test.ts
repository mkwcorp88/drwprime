import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('google-auth-library', () => ({ OAuth2Client: class { verifyIdToken = verifyIdToken; } }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { verifyGoogleCredential } from './google';

describe('Google ID token verification', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'web-client.apps.googleusercontent.com');
    verifyIdToken.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('accepts only a verified Google subject for this application audience', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub-123', email: 'member@example.com', email_verified: true, given_name: 'Ayu', family_name: 'Prime' }) });
    expect(await verifyGoogleCredential('x'.repeat(120))).toEqual({ sub: 'google-sub-123', email: 'member@example.com', firstName: 'Ayu', lastName: 'Prime' });
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'x'.repeat(120), audience: 'web-client.apps.googleusercontent.com' });
  });

  it('rejects invalid signatures and incomplete or unverified identities', async () => {
    verifyIdToken.mockRejectedValueOnce(new Error('bad signature'));
    await expect(verifyGoogleCredential('x'.repeat(120))).rejects.toMatchObject({ code: 'GOOGLE_CREDENTIAL_INVALID' });
    verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ email: 'patient@example.com', email_verified: true }) });
    await expect(verifyGoogleCredential('x'.repeat(120))).rejects.toMatchObject({ code: 'GOOGLE_CREDENTIAL_INVALID' });
    verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ sub: 'google-sub', email: 'patient@example.com', email_verified: false }) });
    await expect(verifyGoogleCredential('x'.repeat(120))).rejects.toMatchObject({ code: 'GOOGLE_CREDENTIAL_INVALID' });
  });

  it('fails closed without configuration or a token', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '');
    await expect(verifyGoogleCredential('x'.repeat(120))).rejects.toMatchObject({ code: 'GOOGLE_NOT_CONFIGURED' });
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'web-client.apps.googleusercontent.com');
    await expect(verifyGoogleCredential('')).rejects.toMatchObject({ code: 'GOOGLE_CREDENTIAL_INVALID' });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
