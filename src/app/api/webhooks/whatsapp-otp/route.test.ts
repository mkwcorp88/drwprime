import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const applyStatus = vi.hoisted(() => vi.fn());
vi.mock('@/lib/whatsapp-otp-delivery', () => ({ applyMetaMessageStatus: applyStatus }));
import { GET, POST } from './route';

beforeEach(() => {
  vi.stubEnv('MEMBER_WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'verify-token-for-test');
  vi.stubEnv('MEMBER_WHATSAPP_APP_SECRET', 'app-secret-for-test');
  applyStatus.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('Meta WhatsApp OTP webhook', () => {
  it('answers Meta verification only with the configured token', async () => {
    const valid = new Request('https://drwprime.com/api/webhooks/whatsapp-otp?hub.mode=subscribe&hub.verify_token=verify-token-for-test&hub.challenge=challenge');
    expect(await (await GET(valid)).text()).toBe('challenge');
    const invalid = new Request('https://drwprime.com/api/webhooks/whatsapp-otp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge');
    expect((await GET(invalid)).status).toBe(403);
  });

  it('rejects unsigned payloads and records only signed message statuses', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
      statuses: [{ id: 'wamid.example', status: 'failed', errors: [{ code: 131031 }] }],
    } }] }] });
    const url = 'https://drwprime.com/api/webhooks/whatsapp-otp';
    expect((await POST(new Request(url, { method: 'POST', body }))).status).toBe(403);
    expect(applyStatus).not.toHaveBeenCalled();
    const signature = `sha256=${createHmac('sha256', 'app-secret-for-test').update(body).digest('hex')}`;
    const accepted = await POST(new Request(url, { method: 'POST', body, headers: { 'x-hub-signature-256': signature } }));
    expect(accepted.status).toBe(200);
    expect(applyStatus).toHaveBeenCalledWith({ id: 'wamid.example', status: 'failed', errorCode: 131031 });
  });
});
