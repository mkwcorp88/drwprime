import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateCommission } from '@/lib/policies/commission';
import { cancelReservation, completeReservation, confirmReservation, rescheduleCrmReservation } from '@/lib/services/reservation';
import { CrmError } from './auth';
import { CRM_INITIAL_ADMINS, CRM_ROLES, type CrmRole } from './constants';
import { amountValue, dateValue, phoneNumber, platformValue, roleValue, sourceValue, statusValue, text } from './validation';

type Db = Prisma.TransactionClient | typeof prisma;
type Actor = { id: string; role: CrmRole };

export function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export async function contextValue(db: Db, input: Record<string, unknown>, previousCampaign?: string | null) {
  const source = sourceValue(input.source);
  const eventId = source === 'EVENT' ? text(input.eventId, 'Event', 100, true) : null;
  const campaignId = source === 'ADS' ? text(input.campaignId, 'Campaign', 100, true) : null;
  const assignedTo = text(input.assignedTo, 'PIC', 100) || null;
  if (eventId && !await db.crmEvent.findUnique({ where: { id: eventId }, select: { id: true } })) throw new CrmError('Pilih event yang tersedia.');
  if (campaignId) {
    const campaign = await db.crmCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (!campaign || (campaign.status !== 'ACTIVE' && campaignId !== previousCampaign)) throw new CrmError('Pilih campaign aktif.');
  }
  if (assignedTo && !await db.crmGrant.findFirst({ where: { staffId: assignedTo, active: true, role: { in: ['ADMIN','MARKETING','FRONT_OFFICE'] }, staff: { active: true } }, select: { staffId: true } })) throw new CrmError('Pilih PIC CRM yang aktif.');
  return { source, eventId, campaignId, assignedTo };
}

export function leadValue(input: Record<string, unknown>) {
  const name = text(input.name, 'Nama', 100, true);
  const phone = text(input.phone, 'Nomor WhatsApp', 40, true);
  return { name, phone, phoneNormalized: phoneNumber(phone), interest: text(input.interest, 'Layanan diminati', 150) || null, notes: text(input.notes, 'Catatan', 2000) || null };
}

export async function bootstrap(actor: Actor) {
  const [events, campaigns, grants, treatments] = await Promise.all([
    prisma.crmEvent.findMany({ orderBy: [{ eventDate: 'desc' }, { name: 'asc' }] }),
    prisma.crmCampaign.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] }),
    prisma.crmGrant.findMany({ where: { active: true, staff: { active: true }, role: { in: ['ADMIN','MARKETING','FRONT_OFFICE'] } }, select: { staffId: true, role: true, staff: { select: { name: true } } }, orderBy: { staff: { name: 'asc' } } }),
    prisma.treatment.findMany({ where: { active: true }, select: { id: true, name: true, price: true }, orderBy: { name: 'asc' } }),
  ]);
  return { events, campaigns, assignees: grants.map((grant) => ({ id: grant.staffId, name: grant.staff.name, role: grant.role })), treatments, role: actor.role, ocrReady: Boolean(process.env.CRM_GEMINI_API_KEY) };
}

export async function listLeads(input: Record<string, unknown>, actor: Actor) {
  const q = text(input.q, 'Pencarian', 100);
  const status = text(input.status, 'Status', 30);
  const source = text(input.source, 'Sumber', 30);
  const eventId = text(input.eventId, 'Event', 100);
  const work = text(input.work, 'Prioritas', 30);
  const page = Math.min(Math.max(Number(input.page) || 1, 1), 100_000);
  const where: Prisma.CrmLeadWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { phoneNormalized: { contains: q.replace(/\D/g, '') || q } }];
  if (status) where.status = statusValue(status);
  if (source) where.source = sourceValue(source);
  if (eventId) where.events = { some: { eventId } };
  if (work === 'due') where.AND = [{ nextFollowUp: { lte: dateValue(jakartaToday(), 'Tanggal')! } }, { status: { not: 'NOT_INTERESTED' } }];
  else if (work === 'unassigned') where.assignedTo = null;
  else if (work === 'mine') where.assignedTo = actor.id;
  else if (work === 'reserved') where.reservations = { some: {} };
  else if (work === 'not_reserved') where.reservations = { none: {} };
  else if (work) throw new CrmError('Filter prioritas tidak valid.');
  const [rows, total, assignees, all, fresh, due, unassigned] = await Promise.all([
    prisma.crmLead.findMany({ where, include: { event: true, campaign: true, _count: { select: { reservations: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, skip: (page - 1) * 50 }),
    prisma.crmLead.count({ where }), prisma.staffAccount.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.crmLead.count(), prisma.crmLead.count({ where: { status: 'NEW' } }),
    prisma.crmLead.count({ where: { nextFollowUp: { lte: dateValue(jakartaToday(), 'Tanggal')! }, status: { not: 'NOT_INTERESTED' } } }),
    prisma.crmLead.count({ where: { assignedTo: null } }),
  ]);
  const names = new Map(assignees.map((s) => [s.id, s.name]));
  return { rows: rows.map((row) => ({ ...row, picName: row.assignedTo ? names.get(row.assignedTo) || 'Tidak aktif' : null })), total, page, summary: { all, fresh, due, unassigned } };
}

export async function leadDetail(id: string) {
  const lead = await prisma.crmLead.findUnique({ where: { id }, include: { event: true, campaign: true, events: { include: { event: true }, orderBy: { createdAt: 'desc' } }, followUps: { include: { event: true }, orderBy: { createdAt: 'desc' }, take: 50 }, reservations: { include: { reservation: { include: { treatment: true } }, event: true, campaign: true, history: { orderBy: { createdAt: 'desc' }, take: 30 } }, orderBy: { createdAt: 'desc' }, take: 50 } } });
  if (!lead) throw new CrmError('Kontak tidak ditemukan.', 404);
  const actorIds = [...new Set([...lead.followUps.map((f) => f.actorId), ...lead.reservations.flatMap((r) => r.history.map((h) => h.actorId))])];
  const actors = await prisma.staffAccount.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return { ...lead, followUps: lead.followUps.map((f) => ({ ...f, actorName: names.get(f.actorId) || 'Petugas' })), reservations: lead.reservations.map((r) => ({ ...r, history: r.history.map((h) => ({ ...h, action: h.action === 'RESCHEDULED' ? 'Dijadwalkan ulang' : h.action === 'RESULT_UPDATED' ? 'Hasil diperbarui' : h.action, actorName: names.get(h.actorId) || 'Petugas' })) })) };
}

export async function saveLead(input: Record<string, unknown>, actor: Actor) {
  const id = text(input.id, 'Kontak', 100);
  const old = id ? await prisma.crmLead.findUnique({ where: { id } }) : null;
  if (id && !old) throw new CrmError('Kontak tidak ditemukan.', 404);
  const data = leadValue(input);
  const context = await contextValue(prisma, input, old?.campaignId);
  const revision = Number(input.revision);
  return prisma.$transaction(async (tx) => {
    let leadId = id;
    if (old) {
      if (!Number.isInteger(revision) || revision < 1) throw new CrmError('Versi data tidak valid.');
      const changed = await tx.crmLead.updateMany({ where: { id, revision }, data: { ...data, ...context, revision: { increment: 1 }, updatedBy: actor.id } });
      if (changed.count !== 1) throw new CrmError('Data telah diubah petugas lain. Muat ulang sebelum menyimpan.', 409);
    } else {
      leadId = (await tx.crmLead.create({ data: { ...data, ...context, createdBy: actor.id, updatedBy: actor.id } })).id;
    }
    if (context.eventId) await tx.crmLeadEvent.upsert({ where: { leadId_eventId: { leadId, eventId: context.eventId } }, create: { leadId, eventId: context.eventId }, update: {} });
    return { id: leadId };
  });
}

export async function followUp(input: Record<string, unknown>, actor: Actor) {
  const id = text(input.id, 'Kontak', 100, true), status = statusValue(input.status), note = text(input.note, 'Catatan', 2000, true);
  if (status === 'NEW') throw new CrmError('Pilih hasil tindak lanjut.');
  const next = dateValue(input.nextFollowUp, 'Tanggal tindak lanjut', status === 'FOLLOW_UP');
  const eventId = text(input.eventId, 'Event', 100) || null;
  if (eventId && !await prisma.crmLeadEvent.findUnique({ where: { leadId_eventId: { leadId: id, eventId } } })) throw new CrmError('Pilih event yang terhubung dengan kontak.');
  const revision = Number(input.revision);
  if (!Number.isInteger(revision) || revision < 1) throw new CrmError('Versi data tidak valid.');
  return prisma.$transaction(async (tx) => {
    const nextFollowUp = status === 'NOT_INTERESTED' ? null : next;
    const updated = await tx.crmLead.updateMany({ where: { id, revision }, data: { status, nextFollowUp, updatedBy: actor.id, revision: { increment: 1 } } });
    if (updated.count !== 1) throw new CrmError('Kontak tidak ditemukan atau telah diubah. Muat ulang.', 409);
    await tx.crmFollowUp.create({ data: { leadId: id, eventId, actorId: actor.id, status, note, nextFollowUp } });
    return { ok: true };
  });
}

export async function saveEvent(input: Record<string, unknown>, actor: Actor) {
  const name = text(input.name, 'Nama event', 150, true), eventDate = dateValue(input.eventDate, 'Tanggal event', true)!;
  return prisma.crmEvent.create({ data: { name, eventDate, createdBy: actor.id } });
}

export async function saveCampaign(input: Record<string, unknown>, actor: Actor) {
  const id = text(input.id, 'Campaign', 100);
  if (id) {
    const status = text(input.status, 'Status', 20, true);
    if (!['ACTIVE','ARCHIVED'].includes(status)) throw new CrmError('Status campaign tidak valid.');
    const changed = await prisma.crmCampaign.updateMany({ where: { id }, data: { status } });
    if (!changed.count) throw new CrmError('Campaign tidak ditemukan.', 404);
    return { id };
  }
  return prisma.crmCampaign.create({ data: { name: text(input.name, 'Nama campaign', 150, true), platform: platformValue(input.platform), createdBy: actor.id } });
}

export async function saveSpend(input: Record<string, unknown>, actor: Actor) {
  const campaignId = text(input.campaignId, 'Campaign', 100, true), spendDate = dateValue(input.spendDate, 'Tanggal biaya', true)!;
  const amount = amountValue(input.amount);
  if (spendDate > dateValue(jakartaToday(), 'Tanggal')!) throw new CrmError('Tanggal biaya tidak boleh di masa depan.');
  return prisma.$transaction(async (tx) => {
    if (!await tx.crmCampaign.findUnique({ where: { id: campaignId } })) throw new CrmError('Campaign tidak ditemukan.');
    // Serializes updates and creation for the same campaign/day, including the first insert.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`crm-spend:${campaignId}:${spendDate.toISOString().slice(0,10)}`}, 0))::text`;
    const previous = await tx.crmSpend.findUnique({ where: { campaignId_spendDate: { campaignId, spendDate } } });
    const entry = await tx.crmSpend.upsert({ where: { campaignId_spendDate: { campaignId, spendDate } }, create: { campaignId, spendDate, amount, updatedBy: actor.id }, update: { amount, updatedBy: actor.id } });
    await tx.crmSpendHistory.create({ data: { campaignId, spendDate, previous: previous?.amount, amount, actorId: actor.id } });
    return entry;
  });
}

export async function setGrant(input: Record<string, unknown>, actor: Actor) {
  const staffId = text(input.staffId, 'Akun staf', 100, true), role = roleValue(input.role), active = input.active === true;
  const staff = await prisma.staffAccount.findUnique({ where: { id: staffId } });
  if (!staff?.active) throw new CrmError('Pilih akun staf yang aktif.');
  if (CRM_INITIAL_ADMINS.includes((staff.email || '').toLowerCase() as typeof CRM_INITIAL_ADMINS[number]) && (!active || role !== 'ADMIN')) throw new CrmError('Akun admin utama tidak dapat dinonaktifkan melalui CRM.');
  if (actor.id === staffId && (!active || role !== 'ADMIN')) throw new CrmError('Anda tidak dapat menonaktifkan akses admin sendiri.');
  return prisma.crmGrant.upsert({ where: { staffId }, create: { staffId, role, active }, update: { role, active } });
}

export async function createReservation(input: Record<string, unknown>, actor: Actor) {
  const leadId = text(input.leadId, 'Kontak', 100, true), treatmentId = text(input.treatmentId, 'Treatment', 100, true);
  const requestKey = text(input.requestKey, 'Kode permintaan', 80, true);
  if (!/^[0-9a-f-]{36}$/i.test(requestKey)) throw new CrmError('Formulir tidak valid. Muat ulang dan coba lagi.');
  const email = text(input.email, 'Email', 254, true), time = text(input.time, 'Jam reservasi', 5, true);
  const date = dateValue(input.date, 'Tanggal reservasi', true)!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new CrmError('Isi email dan jam reservasi yang valid.');
  const previous = await prisma.crmReservationLink.findUnique({ where: { requestKey } });
  if (previous) {
    if (previous.leadId !== leadId || previous.createdBy !== actor.id) throw new CrmError('Formulir sudah digunakan.', 409);
    return { id: previous.reservationId };
  }
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  const treatment = await prisma.treatment.findFirst({ where: { id: treatmentId, active: true } });
  if (!lead || !treatment) throw new CrmError('Kontak atau treatment tidak ditemukan.');
  const eventId = lead.source === 'EVENT' ? text(input.eventId, 'Event', 100, true) : null;
  if (eventId && !await prisma.crmLeadEvent.findUnique({ where: { leadId_eventId: { leadId, eventId } } })) throw new CrmError('Pilih event yang terkait dengan kontak.');
  const referral = text(input.referral, 'Kode affiliate', 10).toUpperCase();
  if (referral && !/^[A-Z0-9]{5,10}$/.test(referral)) throw new CrmError('Kode affiliate tidak valid.');
  const referrer = referral ? await prisma.user.findFirst({ where: { affiliateCode: referral }, select: { id: true } }) : null;
  try {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({ data: { treatmentId, patientName: lead.name, patientEmail: email, patientPhone: lead.phoneNormalized, patientNotes: lead.notes, reservationDate: date, reservationTime: time, originalPrice: treatment.price, finalPrice: treatment.price, referredBy: referral || null, referrerId: referrer?.id || null, commissionAmount: referral ? calculateCommission(Number(treatment.price)) : 0 } });
      await tx.crmReservationLink.create({ data: { reservationId: reservation.id, requestKey, leadId, source: lead.source, campaignId: lead.campaignId, eventId, createdBy: actor.id } });
      await tx.crmReservationHistory.create({ data: { reservationId: reservation.id, actorId: actor.id, action: 'CREATED', details: { source: lead.source, eventId, campaignId: lead.campaignId } } });
      return { id: reservation.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.crmReservationLink.findUnique({ where: { requestKey } });
      if (existing?.leadId === leadId && existing.createdBy === actor.id) return { id: existing.reservationId };
    }
    throw error;
  }
}

export async function updateReservation(input: Record<string, unknown>, actor: Actor) {
  const id = text(input.id, 'Reservasi', 100, true), operation = text(input.operation, 'Tindakan', 30, true);
  const link = await prisma.crmReservationLink.findUnique({ where: { reservationId: id }, include: { reservation: true } });
  if (!link) throw new CrmError('Reservasi tidak ditemukan.', 404);
  if (operation === 'confirm') await confirmReservation(id, actor.id);
  else if (operation === 'reschedule') {
    const date = dateValue(input.newDate, 'Tanggal baru', true)!;
    const time = text(input.newTime, 'Jam baru', 5, true);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new CrmError('Jam baru tidak valid.');
    await rescheduleCrmReservation(id, date, time, actor.id);
  }
  else if (operation === 'cancel' || operation === 'no_show') {
    const reason = text(input.reason, 'Alasan pembatalan', 255);
    if (operation === 'no_show') {
      const date = link.reservation.reservationDate.toISOString().slice(0, 10);
      if (new Date(`${date}T${link.reservation.reservationTime}:00+07:00`) > new Date()) throw new CrmError('Tidak hadir hanya dapat dicatat setelah jadwal kunjungan.');
    }
    await cancelReservation(id, { reason, noShow: operation === 'no_show', actorId: actor.id });
  } else if (operation === 'complete') {
    const result = text(input.visitResult, 'Hasil kunjungan', 20, true);
    if (!['CONSULTATION','TREATMENT'].includes(result)) throw new CrmError('Pilih hasil kunjungan.');
    const amount = amountValue(input.amount);
    if (amount <= 0) throw new CrmError('Pembayaran harus lebih dari Rp0.');
    await completeReservation(id, { finalPrice: amount, adminNotes: text(input.notes, 'Catatan', 2000) || undefined, crmVisitResult: result as 'CONSULTATION' | 'TREATMENT', crmActorId: actor.id });
  } else if (operation === 'visit_result') {
    const result = text(input.visitResult, 'Hasil kunjungan', 20, true);
    if (!['CONSULTATION','TREATMENT'].includes(result)) throw new CrmError('Pilih hasil kunjungan.');
    await prisma.$transaction(async (tx) => {
      const updated = await tx.crmReservationLink.updateMany({ where: { reservationId: id, reservation: { status: 'completed' } }, data: { visitResult: result } });
      if (!updated.count) throw new CrmError('Hasil hanya dapat diisi pada reservasi yang sudah selesai.');
      await tx.crmReservationHistory.create({ data: { reservationId: id, actorId: actor.id, action: 'RESULT_UPDATED', details: { visitResult: result } } });
    });
  } else throw new CrmError('Tindakan reservasi tidak dikenal.');
  return { ok: true };
}

export function handleDbError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new CrmError('Data sudah ada. Periksa nomor WhatsApp, nama event, atau campaign.', 409);
  throw error;
}

export async function users() {
  const staff = await prisma.staffAccount.findMany({ where: { active: true }, select: { id: true, name: true, email: true, phone: true, crmGrant: true }, orderBy: { name: 'asc' } });
  return { staff, roles: CRM_ROLES };
}
