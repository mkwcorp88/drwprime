import { MemberAuthError } from './policy';

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

export async function sendMemberOtp(phone: string, code: string): Promise<void> {
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
    const result = await response.json();
    if (!response.ok || typeof result.messages?.[0]?.id !== 'string') throw new Error('Meta rejected OTP');
  } catch {
    // Provider payloads can contain phone numbers, tokens or message text.
    throw new MemberAuthError(502, 'Kode belum dapat dikirim. Tunggu sebentar lalu coba lagi.', 'OTP_SEND_FAILED', 60);
  }
}
