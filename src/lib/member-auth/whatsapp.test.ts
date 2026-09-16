import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMemberOtp, memberOtpConfigured } from './whatsapp';

beforeEach(() => {
  vi.stubEnv('MEMBER_WHATSAPP_ACCESS_TOKEN', 'member-test-token');
  vi.stubEnv('MEMBER_WHATSAPP_PHONE_NUMBER_ID', '1289265457605367');
  vi.stubEnv('MEMBER_WHATSAPP_TEMPLATE', 'drwprime_member_login_otp');
  vi.stubEnv('MEMBER_WHATSAPP_TEMPLATE_LANG', 'id');
  vi.stubEnv('MEMBER_WHATSAPP_API_VERSION', 'v25.0');
  vi.stubEnv('MEMBER_OTP_SECRET', 'test-only-secret-at-least-thirty-two-characters');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('member WhatsApp sender', () => {
  it('uses the dedicated sender and supplies the dynamic code to body and copy button', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ messages: [{ id: 'wamid.test' }] }));
    vi.stubGlobal('fetch', fetchMock);
    await sendMemberOtp('6281234567890', '012345');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v25.0/1289265457605367/messages');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer member-test-token' });
    expect(JSON.parse(options.body as string)).toMatchObject({ to: '6281234567890', template: {
      name: 'drwprime_member_login_otp', language: { code: 'id' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: '012345' }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '012345' }] },
      ],
    } });
  });
  it('does not fall back to OPS or general notification credentials', async () => {
    vi.stubEnv('MEMBER_WHATSAPP_ACCESS_TOKEN', '');
    vi.stubEnv('OPS_WHATSAPP_ACCESS_TOKEN', 'ops-secret');
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'general-secret');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect(memberOtpConfigured()).toBe(false);
    await expect(sendMemberOtp('6281234567890', '123456')).rejects.toMatchObject({ code: 'OTP_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('redacts a provider failure and rejects an empty successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { message: 'secret token and phone here' } }, { status: 403 })));
    await expect(sendMemberOtp('6281234567890', '123456')).rejects.toMatchObject({ code: 'OTP_SEND_FAILED', message: 'Kode belum dapat dikirim. Tunggu sebentar lalu coba lagi.' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})));
    await expect(sendMemberOtp('6281234567890', '123456')).rejects.toMatchObject({ code: 'OTP_SEND_FAILED' });
  });
});
