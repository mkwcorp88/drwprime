import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOpsLoginOtpWhatsApp, sendTreatmentCompletedNotification } from './whatsapp';

const originalEnv = {
  accessToken: process.env.OPS_WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.OPS_WHATSAPP_PHONE_NUMBER_ID,
  graphVersion: process.env.OPS_WHATSAPP_API_VERSION,
  template: process.env.OPS_WHATSAPP_TEMPLATE,
  language: process.env.OPS_WHATSAPP_TEMPLATE_LANG,
  memberAccessToken: process.env.MEMBER_WHATSAPP_ACCESS_TOKEN,
  memberPhoneNumberId: process.env.MEMBER_WHATSAPP_PHONE_NUMBER_ID,
  memberGraphVersion: process.env.MEMBER_WHATSAPP_API_VERSION,
  memberLanguage: process.env.MEMBER_WHATSAPP_TEMPLATE_LANG,
  memberTemplate: process.env.MEMBER_WHATSAPP_TREATMENT_MEMBER_TEMPLATE,
  walkInTemplate: process.env.MEMBER_WHATSAPP_TREATMENT_WALKIN_TEMPLATE,
};

beforeEach(() => {
  process.env.OPS_WHATSAPP_ACCESS_TOKEN = 'test-access-token';
  process.env.OPS_WHATSAPP_PHONE_NUMBER_ID = 'phone-number-id';
  process.env.OPS_WHATSAPP_API_VERSION = 'v25.0';
  process.env.OPS_WHATSAPP_TEMPLATE = 'drwprime_login_otp';
  process.env.OPS_WHATSAPP_TEMPLATE_LANG = 'id';
  process.env.MEMBER_WHATSAPP_ACCESS_TOKEN = 'member-access-token';
  process.env.MEMBER_WHATSAPP_PHONE_NUMBER_ID = '1234567890';
  process.env.MEMBER_WHATSAPP_API_VERSION = 'v25.0';
  process.env.MEMBER_WHATSAPP_TEMPLATE_LANG = 'id';
  process.env.MEMBER_WHATSAPP_TREATMENT_MEMBER_TEMPLATE = 'treatment_completed_member';
  process.env.MEMBER_WHATSAPP_TREATMENT_WALKIN_TEMPLATE = 'treatment_completed_walkin';
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, value] of Object.entries({
    OPS_WHATSAPP_ACCESS_TOKEN: originalEnv.accessToken,
    OPS_WHATSAPP_PHONE_NUMBER_ID: originalEnv.phoneNumberId,
    OPS_WHATSAPP_API_VERSION: originalEnv.graphVersion,
    OPS_WHATSAPP_TEMPLATE: originalEnv.template,
    OPS_WHATSAPP_TEMPLATE_LANG: originalEnv.language,
    MEMBER_WHATSAPP_ACCESS_TOKEN: originalEnv.memberAccessToken,
    MEMBER_WHATSAPP_PHONE_NUMBER_ID: originalEnv.memberPhoneNumberId,
    MEMBER_WHATSAPP_API_VERSION: originalEnv.memberGraphVersion,
    MEMBER_WHATSAPP_TEMPLATE_LANG: originalEnv.memberLanguage,
    MEMBER_WHATSAPP_TREATMENT_MEMBER_TEMPLATE: originalEnv.memberTemplate,
    MEMBER_WHATSAPP_TREATMENT_WALKIN_TEMPLATE: originalEnv.walkInTemplate,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('WhatsApp treatment completion templates', () => {
  it('sends the member template with every body parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      messages: [{ id: 'wamid.member' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await sendTreatmentCompletedNotification({
      memberPhone: '0812-3456-7890',
      hasAccount: true,
      treatment: 'Facial Glow',
      amount: 125_000,
      pointsEarned: 12,
      totalPoints: 98,
      tier: 'Silver',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v25.0/1234567890/messages');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer member-access-token' });
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '6281234567890',
      type: 'template',
      template: {
        name: 'treatment_completed_member',
        language: { code: 'id' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: 'Facial Glow' },
            { type: 'text', text: 'Rp 125.000' },
            { type: 'text', text: '12' },
            { type: 'text', text: '98' },
            { type: 'text', text: 'Silver' },
          ],
        }],
      },
    });
  });

  it('sends the walk-in template with the dynamic sign-up URL parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      messages: [{ id: 'wamid.walkin' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await sendTreatmentCompletedNotification({
      memberPhone: '+62 812 3456 7890',
      hasAccount: false,
      treatment: 'Laser Rejuvenation',
      amount: 1_500_000,
      pointsEarned: 150,
      totalPoints: 150,
      tier: 'Silver',
    });

    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '6281234567890',
      type: 'template',
      template: {
        name: 'treatment_completed_walkin',
        language: { code: 'id' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Laser Rejuvenation' },
              { type: 'text', text: 'Rp 1.500.000' },
              { type: 'text', text: '150' },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: '6281234567890' }],
          },
        ],
      },
    });
  });

  it('fails closed when the dedicated notification sender is not configured', async () => {
    delete process.env.MEMBER_WHATSAPP_ACCESS_TOKEN;
    vi.stubGlobal('fetch', vi.fn());

    await sendTreatmentCompletedNotification({
      memberPhone: '081234567890',
      hasAccount: true,
      amount: 100_000,
      pointsEarned: 10,
      totalPoints: 10,
      tier: 'Silver',
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces a rejected template request without provider payload data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"rejected"}', { status: 400 })));

    await expect(sendTreatmentCompletedNotification({
      memberPhone: '081234567890',
      hasAccount: true,
      amount: 100_000,
      pointsEarned: 10,
      totalPoints: 10,
      tier: 'Silver',
    })).rejects.toThrow('WhatsApp treatment template API error 400');
  });
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

  it('fails closed when the dedicated OTP configuration is incomplete', async () => {
    delete process.env.OPS_WHATSAPP_ACCESS_TOKEN;
    vi.stubGlobal('fetch', vi.fn());

    await expect(sendOpsLoginOtpWhatsApp('081234567890', '123456'))
      .rejects.toThrow('Konfigurasi WhatsApp OTP (Meta) belum lengkap.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces a rejected Meta API request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"rejected"}', { status: 400 })));

    await expect(sendOpsLoginOtpWhatsApp('081234567890', '123456'))
      .rejects.toThrow('WhatsApp OTP API error 400');
  });
});
