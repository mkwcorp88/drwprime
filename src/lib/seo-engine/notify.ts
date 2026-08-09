/**
 * Telegram notifications for the SEO cron jobs.
 *
 * Both helpers skip silently when the token or chat id is missing so a
 * notification outage never fails the job — but they log it, because a silent
 * skip is exactly how the drwskincare ClickUp reports went missing for weeks.
 */
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type SendResult = { ok: boolean; skipped?: boolean; error?: string };

async function post(method: string, payload: Record<string, unknown>): Promise<SendResult> {
  if (!TOKEN() || !CHAT_ID()) {
    console.warn('[seo-engine] telegram dilewati: TELEGRAM_BOT_TOKEN/CHAT_ID belum diset');
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID(), parse_mode: 'HTML', ...payload }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: String(json.description ?? res.status) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error instanceof Error ? error.message : error) };
  }
}

export function telegramSend(text: string): Promise<SendResult> {
  return post('sendMessage', { text, disable_web_page_preview: false });
}

export function telegramSendPhoto(photoUrl: string, caption: string): Promise<SendResult> {
  return post('sendPhoto', { photo: photoUrl, caption });
}
