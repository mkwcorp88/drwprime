import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOpsLoginOtpWhatsApp } from './whatsapp';

const originalEnv = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  graphVersion: process.env.WHATSAPP_API_VERSION,
  template: process.env.WHATSAPP_OPS_OTP_TEMPLATE,
  language: process.env.WHATSAPP_OPS_OTP_TEMPLATE_LANG,
};

beforeEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-number-id';
  process.env.WHATSAPP_API_VERSION = 'v25.0';
  process.env.WHATSAPP_OPS_OTP_TEMPLATE = 'drwprime_login_otp';
  process.env.WHATSAPP_OPS_OTP_TEMPLATE_LANG = 'id';
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, value] of Object.entries({
    WHATSAPP_ACCESS_TOKEN: originalEnv.accessToken,
    WHATSAPP_PHONE_NUMBER_ID: originalEnv.phoneNumberId,
    WHATSAPP_API_VERSION: originalEnv.graphVersion,
    WHATSAPP_OPS_OTP_TEMPLATE: originalEnv.template,
    WHATSAPP_OPS_OTP_TEMPLATE_LANG: originalEnv.language,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('WhatsApp operational login OTP', () => {
  it('sends the approved authentication template with copy-code parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      messages: [{ id: 'wamid.test' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await sendOpsLoginOtpWhatsApp('0812-3456-7890', '123456');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v25.0/phone-number-id/messages');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-access-token' });
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '6281234567890',
      type: 'template',
      template: {
        name: 'drwprime_login_otp',
        language: { code: 'id' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: '123456' }] },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: '123456' }],
          },
        ],
      },
    });
  });

  it('fails closed when Meta configuration is incomplete', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    vi.stubGlobal('fetch', vi.fn());

    await expect(sendOpsLoginOtpWhatsApp('081234567890', '123456'))
      .rejects.toThrow('Konfigurasi WhatsApp OTP belum lengkap.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces a rejected Meta API request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"rejected"}', { status: 400 })));

    await expect(sendOpsLoginOtpWhatsApp('081234567890', '123456'))
      .rejects.toThrow('WhatsApp OTP API error 400');
  });
});
