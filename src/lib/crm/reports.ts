import { prisma } from '@/lib/prisma';
import { CrmError } from './auth';
import { dateValue, platformValue, text } from './validation';
import { jakartaToday } from './service';

export async function eventSummary() {
  const events = await prisma.crmEvent.findMany({
    orderBy: [{ eventDate: 'desc' }, { name: 'asc' }],
    include: { leads: { select: { leadId: true } }, followUps: { select: { leadId: true } }, reservations: { include: { reservation: { select: { status: true, finalPrice: true } } } } },
  });
  return events.map((event) => ({ id: event.id, name: event.name, eventDate: event.eventDate,
    leads: event.leads.length, contacted: new Set(event.followUps.map((f) => f.leadId)).size,
    reservations: new Set(event.reservations.map((r) => r.leadId)).size,
    attended: event.reservations.filter((r) => r.reservation.status === 'completed').length,
    revenue: event.reservations.reduce((sum, r) => sum + (r.reservation.status === 'completed' ? Number(r.reservation.finalPrice) : 0), 0),
  }));
}

export async function report(input: Record<string, unknown>) {
  const today = jakartaToday(), fromText = text(input.from, 'Tanggal awal', 10) || `${today.slice(0, 7)}-01`, toText = text(input.to, 'Tanggal akhir', 10) || today;
  const campaignId = text(input.campaignId, 'Campaign', 100), platform = text(input.platform, 'Platform', 30);
  if (platform) platformValue(platform);
  const from = dateValue(fromText, 'Tanggal awal', true)!, to = dateValue(toText, 'Tanggal akhir', true)!;
  if (from > to) throw new CrmError('Tanggal awal harus sebelum tanggal akhir.');
  const start = new Date(`${fromText}T00:00:00+07:00`), end = new Date(new Date(`${toText}T00:00:00+07:00`).getTime() + 86400_000);
  const nextDate = new Date(to.getTime() + 86400_000);
  const [campaigns, spend, links] = await Promise.all([
    prisma.crmCampaign.findMany({ orderBy: { name: 'asc' } }),
    prisma.crmSpend.findMany({ where: { spendDate: { gte: from, lt: nextDate } } }),
    prisma.crmReservationLink.findMany({ where: { source: 'ADS', createdAt: { gte: start, lt: end } }, include: { reservation: { select: { status: true, finalPrice: true, reservationDate: true, reservationTime: true } } } }),
  ]);
  const groups = campaigns.filter((campaign) => (!campaignId || campaign.id === campaignId) && (!platform || campaign.platform === platform)).map((campaign) => {
    const costs = spend.filter((s) => s.campaignId === campaign.id);
    const reservations = links.filter((l) => l.campaignId === campaign.id);
    const revenue = reservations.reduce((sum, l) => sum + (l.reservation.status === 'completed' ? Number(l.reservation.finalPrice) : 0), 0);
    return { id: campaign.id, name: campaign.name, platform: campaign.platform, spend: costs.reduce((sum, s) => sum + Number(s.amount), 0), spendEntries: costs.length,
      reservations: reservations.length, attended: reservations.filter((r) => r.reservation.status === 'completed').length,
      treatment: reservations.filter((r) => r.reservation.status === 'completed' && r.visitResult === 'TREATMENT').length,
      resultComplete: reservations.filter((r) => r.reservation.status === 'completed' && ['CONSULTATION','TREATMENT'].includes(r.visitResult)).length,
      incomplete: reservations.filter((r) => r.reservation.status === 'completed' && (r.visitResult === 'PENDING' || Number(r.reservation.finalPrice) <= 0)).length,
      due: reservations.filter((r) => (r.reservation.status !== 'cancelled' || r.visitResult === 'NO_SHOW') && new Date(`${r.reservation.reservationDate.toISOString().slice(0,10)}T${r.reservation.reservationTime}:00+07:00`) <= new Date()).length,
      cancelled: reservations.filter((r) => r.reservation.status === 'cancelled' && r.visitResult !== 'NO_SHOW').length,
      noShow: reservations.filter((r) => r.visitResult === 'NO_SHOW').length, revenue };
  });
  const total = groups.reduce((sum, group) => ({ spend: sum.spend + group.spend, spendEntries: sum.spendEntries + group.spendEntries,
    reservations: sum.reservations + group.reservations, attended: sum.attended + group.attended, treatment: sum.treatment + group.treatment,
    cancelled: sum.cancelled + group.cancelled, noShow: sum.noShow + group.noShow, revenue: sum.revenue + group.revenue,
    resultComplete: sum.resultComplete + group.resultComplete, incomplete: sum.incomplete + group.incomplete, due: sum.due + group.due }),
    { spend: 0, spendEntries: 0, reservations: 0, attended: 0, treatment: 0, cancelled: 0, noShow: 0, revenue: 0, resultComplete: 0, incomplete: 0, due: 0 });
  return { from: fromText, to: toText, total, groups };
}

export async function dashboard() {
  const today = jakartaToday();
  const [all, fresh, due, unassigned, activeReservations, results, ads] = await Promise.all([
    prisma.crmLead.count(), prisma.crmLead.count({ where: { status: 'NEW' } }),
    prisma.crmLead.count({ where: { nextFollowUp: { lte: dateValue(today, 'Tanggal')! }, status: { not: 'NOT_INTERESTED' } } }),
    prisma.crmLead.count({ where: { assignedTo: null } }),
    prisma.crmReservationLink.count({ where: { reservation: { status: { in: ['pending','confirmed'] } } } }),
    prisma.crmReservationLink.count({ where: { reservation: { status: 'completed' } } }),
    report({}),
  ]);
  return { all, fresh, due, unassigned, activeReservations, completed: results, ads: ads.total };
}

export async function reservations(limit: number | undefined = 200) {
  return prisma.crmReservationLink.findMany({ include: { lead: { select: { id: true, name: true, phone: true } }, campaign: true, event: true, reservation: { include: { treatment: true } } }, orderBy: { createdAt: 'desc' }, take: limit || undefined });
}
