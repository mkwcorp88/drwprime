import { createHmac, timingSafeEqual } from 'node:crypto';
import { applyMetaMessageStatus, type MetaMessageStatus } from '@/lib/whatsapp-otp-delivery';

export const runtime = 'nodejs';

const response = (status: number, body: string) => new Response(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
});

function matchesSecret(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const token = process.env.MEMBER_WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!token) return response(503, 'Webhook belum dikonfigurasi.');
  const params = new URL(request.url).searchParams;
  const supplied = params.get('hub.verify_token') || '';
  const challenge = params.get('hub.challenge');
  if (params.get('hub.mode') !== 'subscribe' || !challenge || !matchesSecret(supplied, token)) {
    return response(403, 'Verifikasi webhook gagal.');
  }
  return response(200, challenge);
}

async function readBody(request: Request): Promise<Buffer | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65_536) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  const secret = process.env.MEMBER_WHATSAPP_APP_SECRET?.trim();
  if (!secret) return response(503, 'Webhook belum dikonfigurasi.');
  const raw = await readBody(request);
  if (!raw) return response(413, 'Payload terlalu besar.');
  const signature = request.headers.get('x-hub-signature-256') || '';
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  if (!matchesSecret(signature, expected)) return response(403, 'Tanda tangan tidak valid.');

  let payload: unknown;
  try { payload = JSON.parse(raw.toString('utf8')); }
  catch { return response(400, 'Payload tidak valid.'); }
  if (!payload || typeof payload !== 'object' || (payload as { object?: unknown }).object !== 'whatsapp_business_account') {
    return response(200, 'OK');
  }
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return response(200, 'OK');
  const messages: MetaMessageStatus[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!change || typeof change !== 'object' || change.field !== 'messages' || !Array.isArray(change.value?.statuses)) continue;
      for (const item of change.value.statuses) {
        if (!item || typeof item.id !== 'string' || item.id.length > 512 ||
          !['sent', 'delivered', 'read', 'failed'].includes(item.status)) continue;
        const errorCode = item.errors?.[0]?.code;
        messages.push({ id: item.id, status: item.status,
          errorCode: Number.isInteger(errorCode) ? errorCode : undefined });
      }
    }
  }
  try {
    for (const message of messages) await applyMetaMessageStatus(message);
  } catch {
    // Let Meta retry rather than silently dropping delivery evidence.
    console.error('[WHATSAPP OTP] Failed to store delivery status');
    return response(503, 'Status belum tersimpan.');
  }
  return response(200, 'OK');
}
