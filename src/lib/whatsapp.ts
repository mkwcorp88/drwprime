export type ProductOrderItem = {
  name: string;
  price: number;
  quantity: number;
};

export type ProductOrderWhatsappPayload = {
  items: ProductOrderItem[];
  totalPrice: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
};

type ReservationWhatsappPayload = {
  reservationId: string;
  treatmentName: string;
  treatmentPrice: number;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  reservationDate: Date;
  reservationTime: string;
  patientNotes?: string | null;
  referredBy?: string | null;
};

// ===== Membership Notification Payloads =====

type SpendingPayload = {
  memberName: string;
  memberPhone: string;
  isWalkIn: boolean;
  isFirstTransaction: boolean;
  amount: number;
  pointsEarned: number;
  totalPoints: number;
  totalSpending: number;
  tier: string;
  treatment?: string | null;
  transactionCount?: number;
};

type TierUpgradePayload = {
  memberName: string;
  memberPhone: string;
  previousTier: string;
  newTier: string;
  totalPoints: number;
  totalSpending: number;
  benefits: string[];
};

type InactivityPayload = {
  memberName: string;
  memberPhone: string;
  points: number;
  tier: string;
  lastTransactionDate: string;
  daysSinceLastVisit: number;
};

type NearTierPayload = {
  memberName: string;
  memberPhone: string;
  currentTier: string;
  nextTier: string;
  remaining: number;
  progressPercent: number;
  benefits: string[];
};

type InvitationPayload = {
  memberName: string;
  memberPhone: string;
  points: number;
  totalSpending: number;
  tier: string;
  transactionCount: number;
  inviteLink: string;
};

// ===== Meta WhatsApp Cloud API Config =====

function getWhatsAppConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const adminPhone = normalizePhoneNumber(
    process.env.WHATSAPP_ADMIN_PHONE?.trim() || DEFAULT_WHATSAPP_ADMIN_PHONE
  );
  const graphVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v22.0';

  return { accessToken, phoneNumberId, adminPhone, graphVersion };
}

const DEFAULT_WHATSAPP_ADMIN_PHONE = '6281138800071';

// ===== Helpers =====

function normalizePhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDateId(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function tierLabel(tier: string): string {
  return tier === 'PLATINUM' ? 'Platinum' : tier === 'GOLD' ? 'Gold' : 'Silver';
}

/**
 * Compute member tier from totalSpending.
 */
export function computeMemberTier(totalSpending: number): 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (totalSpending >= 5_000_000) return 'PLATINUM';
  if (totalSpending >= 1_000_000) return 'GOLD';
  return 'SILVER';
}

/**
 * Cek apakah member sudah > 60% menuju tier berikutnya.
 */
function getNearTierText(totalSpending: number): string | null {
  if (totalSpending >= 5_000_000) return null;
  if (totalSpending >= 1_000_000) {
    const remaining = 5_000_000 - totalSpending;
    const pct = Math.round((totalSpending / 5_000_000) * 100);
    if (pct >= 60 && totalSpending > 0) {
      return `Tinggal ${formatRupiah(remaining)} lagi ke tier Platinum.`;
    }
    return null;
  }
  const remaining = 1_000_000 - totalSpending;
  const pct = Math.round((totalSpending / 1_000_000) * 100);
  if (pct >= 60 && totalSpending > 0) {
    return `Tinggal ${formatRupiah(remaining)} lagi ke tier Gold.`;
  }
  return null;
}

function getAppUrl(phone?: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://drwprime.com';
  return phone ? `${base}/sign-up?phone=${encodeURIComponent(phone)}` : `${base}/sign-up`;
}

// ===== Meta WhatsApp Cloud API — Send =====

/**
 * Kirim pesan teks via Meta WhatsApp Cloud API.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
async function sendWhatsApp(to: string, message: string) {
  const { accessToken, phoneNumberId, graphVersion } = getWhatsAppConfig();

  if (!accessToken || !phoneNumberId) {
    console.warn('[WA] Config tidak lengkap — skip pengiriman');
    return;
  }

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`WhatsApp API error ${response.status}: ${JSON.stringify(result)}`);
  }

  return result;
}

// ===== Message Builders =====

function buildReservationMessage(payload: ReservationWhatsappPayload) {
  return [
    '*Reservasi Baru DRW Prime*',
    '',
    `ID: ${payload.reservationId}`,
    `Treatment: ${payload.treatmentName}`,
    `Harga Awal: ${formatRupiah(payload.treatmentPrice)}`,
    '',
    '*Data Pasien*',
    `Nama: ${payload.patientName}`,
    `Email: ${payload.patientEmail}`,
    `Telepon: ${payload.patientPhone}`,
    '',
    '*Jadwal*',
    `Tanggal: ${formatDateId(payload.reservationDate)}`,
    `Jam: ${payload.reservationTime}`,
    `Kode Affiliate: ${payload.referredBy || '-'}`,
    `Catatan: ${payload.patientNotes || '-'}`,
  ].join('\n');
}

function buildWalkInFirstMessage(p: SpendingPayload): string {
  return [
    `Halo Kak ${p.memberName},`,
    '',
    `Terima kasih sudah treatment di DRW Prime.`,
    '',
    `Rincian hari ini:`,
    `${p.treatment ? `Treatment : ${p.treatment}` : ''}`,
    `Spending  : ${formatRupiah(p.amount)}`,
    `Poin      : +${p.pointsEarned} poin`,
    '',
    `Status membership Kakak saat ini:`,
    `Tier    : ${tierLabel(p.tier)}`,
    `Poin    : ${p.totalPoints}`,
    `Spending: ${formatRupiah(p.totalSpending)}`,
    '',
    `Supaya poin dan history treatment tersimpan rapi, Kakak bisa daftar akun DRW Prime lewat:`,
    `${getAppUrl(p.memberPhone)}`,
    '',
    `Kalau ada yang mau ditanya, balas aja WA ini ya.`,
    '',
    `Salam,`,
    `DRW Prime`,
    `0811-3880-0071`,
  ].filter(Boolean).join('\n');
}

function buildWalkInRepeatMessage(p: SpendingPayload): string {
  const lines = [
    `Halo Kak ${p.memberName},`,
    '',
    `Poin sudah bertambah.`,
    '',
    `Rincian hari ini:`,
    `${p.treatment ? `Treatment : ${p.treatment}` : ''}`,
    `Poin      : +${p.pointsEarned}`,
    '',
    `Total Kakak sekarang:`,
    `Poin    : ${p.totalPoints}`,
    `Spending: ${formatRupiah(p.totalSpending)}`,
    `Tier    : ${tierLabel(p.tier)}`,
    '',
  ].filter(Boolean);

  const nearTier = getNearTierText(p.totalSpending);
  if (nearTier) {
    lines.push(nearTier, '');
  }

  if (p.transactionCount && p.transactionCount >= 3) {
    lines.push(
      `Oh iya, Kakak sudah ${p.transactionCount}x treatment nih.`,
      `Kalau daftar akun, semua history ini langsung masuk ya.`,
      `${getAppUrl(p.memberPhone)}`,
      '',
    );
  }

  lines.push('Salam,', 'DRW Prime');

  return lines.join('\n');
}

function buildMemberSpendingMessage(p: SpendingPayload): string {
  const lines = [
    `Halo Kak ${p.memberName},`,
    '',
    `Poin berhasil ditambahkan.`,
    '',
    `Rincian:`,
    `Poin hari ini : +${p.pointsEarned}`,
    `${p.treatment ? `Treatment     : ${p.treatment}` : ''}`,
    `Total poin    : ${p.totalPoints}`,
    `Tier          : ${tierLabel(p.tier)}`,
    '',
  ].filter(Boolean);

  const nearTier = getNearTierText(p.totalSpending);
  if (nearTier) {
    lines.push(nearTier, '');
  }

  lines.push(
    `Detail lengkap bisa dicek di dashboard:`,
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://drwprime.com'}/my-prime`,
    '',
    'Salam,',
    'DRW Prime',
  );

  return lines.join('\n');
}

function buildTierUpgradeMessage(p: TierUpgradePayload): string {
  return [
    `Halo Kak ${p.memberName},`,
    '',
    `Selamat! Membership Kakak naik ke *${tierLabel(p.newTier)}*.`,
    '',
    `Benefit baru yang Kakak dapat:`,
    ...p.benefits.map((b) => `- ${b}`),
    '',
    `Spending: ${formatRupiah(p.totalSpending)}`,
    `Poin    : ${p.totalPoints}`,
    '',
    `Terima kasih sudah jadi bagian DRW Prime.`,
    '',
    `Salam,`,
    `DRW Prime`,
    `0811-3880-0071`,
  ].join('\n');
}

function buildInvitationMessage(p: InvitationPayload): string {
  return [
    `Halo Kak ${p.memberName},`,
    '',
    `Tim DRW Prime di sini. Kami lihat Kakak sudah ${p.transactionCount}x treatment bersama kami.`,
    '',
    `Ringkasan membership Kakak:`,
    `Poin    : ${p.points}`,
    `Spending: ${formatRupiah(p.totalSpending)}`,
    `Tier    : ${tierLabel(p.tier)}`,
    '',
    `Supaya poin dan riwayat treatment tidak tercecer, Kakak bisa daftar akun di sini (cuma 1 menit):`,
    `${p.inviteLink}`,
    '',
    `Data Kakak tetap utuh, langsung masuk semua.`,
    '',
    `Kalau butuh bantuan, balas WA ini atau datang langsung ke klinik ya.`,
    '',
    `Salam,`,
    `DRW Prime`,
    `0811-3880-0071`,
  ].join('\n');
}

function buildInactivityMessage(p: InactivityPayload): string {
  return [
    `Halo Kak ${p.memberName},`,
    '',
    `Sudah ${p.daysSinceLastVisit} hari sejak kunjungan terakhir Kakak (${p.lastTransactionDate}).`,
    '',
    `Status membership Kakak masih aktif:`,
    `Poin : ${p.points}`,
    `Tier : ${tierLabel(p.tier)}`,
    '',
    `Kalau ada rencana treatment lagi, kami siap bantu.`,
    `Bisa reservasi lewat:`,
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://drwprime.com'}/reservation`,
    '',
    `Atau langsung hubungi kami di 0811-3880-0071.`,
    '',
    `Salam,`,
    `DRW Prime`,
  ].join('\n');
}

function buildNearTierMessage(p: NearTierPayload): string {
  return [
    `Halo Kak ${p.memberName},`,
    '',
    `Sekadar info, Kakak tinggal *${formatRupiah(p.remaining)}* lagi untuk naik ke tier *${tierLabel(p.nextTier)}*.`,
    '',
    `Progress: ${p.progressPercent}%`,
    '',
    `Benefit ${tierLabel(p.nextTier)}:`,
    ...p.benefits.map((b) => `- ${b}`),
    '',
    `Semoga bisa segera upgrade ya.`,
    '',
    `Salam,`,
    `DRW Prime`,
  ].join('\n');
}

// ===== Public API =====

/** Kirim WA ke admin — notifikasi reservasi baru. */
export async function sendReservationToAdminWhatsApp(payload: ReservationWhatsappPayload) {
  const { accessToken, phoneNumberId, adminPhone } = getWhatsAppConfig();
  if (!accessToken || !phoneNumberId) return;

  const message = buildReservationMessage(payload);
  try {
    await sendWhatsApp(adminPhone, message);
  } catch (err) {
    console.error('[WA] Gagal kirim notifikasi reservasi ke admin:', err);
  }
}

/** Kirim WA ke member — poin bertambah. */
export async function sendSpendingNotification(payload: SpendingPayload) {
  const target = normalizePhoneNumber(payload.memberPhone);
  if (!target) return;

  let message: string;
  if (payload.isWalkIn) {
    message = payload.isFirstTransaction
      ? buildWalkInFirstMessage(payload)
      : buildWalkInRepeatMessage(payload);
  } else {
    message = buildMemberSpendingMessage(payload);
  }

  try {
    await sendWhatsApp(target, message);
  } catch (err) {
    console.error('[WA] Gagal kirim notifikasi spending:', err);
  }
}

/** Kirim WA ke member — tier naik. */
export async function sendTierUpgradeNotification(payload: TierUpgradePayload) {
  const target = normalizePhoneNumber(payload.memberPhone);
  if (!target) return;
  try {
    await sendWhatsApp(target, buildTierUpgradeMessage(payload));
  } catch (err) {
    console.error('[WA] Gagal kirim notifikasi tier upgrade:', err);
  }
}

/** Kirim WA ke walk-in — undangan daftar (manual FO). */
export async function sendManualInvitation(payload: InvitationPayload) {
  const target = normalizePhoneNumber(payload.memberPhone);
  if (!target) return;
  try {
    await sendWhatsApp(target, buildInvitationMessage(payload));
  } catch (err) {
    console.error('[WA] Gagal kirim undangan daftar:', err);
  }
}

/** Kirim WA — reminder inaktivitas > 30 hari. */
export async function sendInactivityReminder(payload: InactivityPayload) {
  const target = normalizePhoneNumber(payload.memberPhone);
  if (!target) return;
  try {
    await sendWhatsApp(target, buildInactivityMessage(payload));
  } catch (err) {
    console.error('[WA] Gagal kirim reminder inaktivitas:', err);
  }
}

/** Kirim WA — motivasi upgrade tier (mendekati threshold). */
export async function sendNearTierReminder(payload: NearTierPayload) {
  const target = normalizePhoneNumber(payload.memberPhone);
  if (!target) return;
  try {
    await sendWhatsApp(target, buildNearTierMessage(payload));
  } catch (err) {
    console.error('[WA] Gagal kirim reminder near tier:', err);
  }
}

function buildProductOrderMessage(payload: ProductOrderWhatsappPayload) {
  const itemsList = payload.items
    .map(
      (item, i) =>
        `${i + 1}. ${item.name}\n   ${item.quantity}x ${formatRupiah(item.price)} = ${formatRupiah(item.price * item.quantity)}`
    )
    .join('\n');

  return [
    '*Pesanan Produk Baru DRW Prime*',
    '',
    '*Data Pemesan*',
    `Nama: ${payload.customerName}`,
    `Telepon: ${payload.customerPhone}`,
    `Email: ${payload.customerEmail || '-'}`,
    '',
    '*Pesanan*',
    itemsList,
    '',
    `Total: *${formatRupiah(payload.totalPrice)}*`,
    `Catatan: ${payload.notes || '-'}`,
  ].join('\n');
}

export async function sendProductOrderToAdminWhatsApp(
  payload: ProductOrderWhatsappPayload
) {
  const { token, adminPhone, apiUrl } = getWhatsAppConfig();

  if (!token || !adminPhone) {
    return;
  }

  const message = buildProductOrderMessage(payload);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({
      target: adminPhone,
      message,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${raw}`);
  }
}
