import { MemberAuthError } from './policy';
import type { MetaOtpSubmission } from '@/lib/whatsapp-otp-delivery';

export function memberOtpConfigured(): boolean {
  return Boolean(
    process.env.MEMBER_WHATSAPP_ACCESS_TOKEN?.trim()
    && /^\d+$/.test(process.env.MEMBER_WHATSAPP_PHONE_NUMBER_ID?.trim() || '')
    && (process.env.MEMBER_OTP_SECRET?.trim().length || 0) >= 32
  );
}

export function requireMemberOtpConfig() {
  if (!memberOtpConfigured()) {
    throw new MemberAuthError(503, 'Layanan login WhatsApp sedang disiapkan. Silakan coba lagi nanti.', 'OTP_NOT_CONFIGURED');
  }
  const version = process.env.MEMBER_WHATSAPP_API_VERSION?.trim() || 'v25.0';
  if (!/^v\d+\.0$/.test(version)) throw new MemberAuthError(503, 'Konfigurasi layanan WhatsApp belum valid.', 'OTP_NOT_CONFIGURED');
  return {
    version,
    token: process.env.MEMBER_WHATSAPP_ACCESS_TOKEN!.trim(),
    phoneNumberId: process.env.MEMBER_WHATSAPP_PHONE_NUMBER_ID!.trim(),
    template: process.env.MEMBER_WHATSAPP_TEMPLATE?.trim() || 'drwprime_member_login_otp',
    language: process.env.MEMBER_WHATSAPP_TEMPLATE_LANG?.trim() || 'id',
  };
}

export async function sendMemberOtp(phone: string, code: string): Promise<MetaOtpSubmission> {
  const config = requireMemberOtpConfig();
  try {
    const response = await fetch(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'template',
        template: {
          name: config.template,
          language: { code: config.language },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || typeof result?.messages?.[0]?.id !== 'string') {
      logMetaOtpFailure(response.status, result, config.template);
      throw new Error('Meta rejected OTP');
    }
    return {
      messageId: result.messages[0].id,
      messageStatus: result.message_status === 'accepted' || result.message_status === 'held_for_quality_assessment'
        ? result.message_status : 'unspecified',
    };
  } catch (error) {
    if (error instanceof Error && error.message !== 'Meta rejected OTP') {
      console.error('[MEMBER OTP] Gagal menghubungi Meta:', error.name);
    }
    // Provider payloads can contain phone numbers, tokens or message text.
    throw new MemberAuthError(502, 'Kode belum dapat dikirim. Tunggu sebentar lalu coba lagi.', 'OTP_SEND_FAILED', 60);
  }
}

// Logs only Meta's numeric/enum error fields. Provider `message` and
// `error_data` can echo phone numbers or template text, so they are omitted.
function logMetaOtpFailure(status: number, result: unknown, template: string) {
  const err = (result as { error?: Record<string, unknown> } | null)?.error;
  console.error('[MEMBER OTP] Meta menolak OTP', {
    status,
    template,
    code: typeof err?.code === 'number' ? err.code : undefined,
    subcode: typeof err?.error_subcode === 'number' ? err.error_subcode : undefined,
    type: typeof err?.type === 'string' ? err.type : undefined,
    fbtrace_id: typeof err?.fbtrace_id === 'string' ? err.fbtrace_id : undefined,
  });
}
