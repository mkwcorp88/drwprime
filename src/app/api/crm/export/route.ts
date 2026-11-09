import { crmError, CrmError, requireCrm } from '@/lib/crm/auth';
import { adsReservationTracker, report, reservations } from '@/lib/crm/reports';
import { CRM_PLATFORMS, CRM_SOURCES, CRM_TRACKER_ROLES } from '@/lib/crm/constants';

export const dynamic = 'force-dynamic';
function csv(values: unknown[]): string {
  return values.map((value) => {
    let s = String(value ?? '');
    if (/^[\s]*[=+\-@]/u.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  }).join(',');
}
export async function GET(request: Request) {
  try {
    await requireCrm();
    const params = new URL(request.url).searchParams, type = params.get('type');
    let rows: unknown[][];
    if (type === 'reservations') {
      const entries = await reservations(0);
      rows = [['ID','Nama','WhatsApp','Sumber','Event','Campaign','Tanggal','Jam','Status','Hasil','Pembayaran']];
      for (const entry of entries) rows.push([entry.reservationId, entry.lead.name, entry.lead.phone, CRM_SOURCES[entry.source as keyof typeof CRM_SOURCES] || entry.source, entry.event?.name, entry.campaign?.name, entry.reservation.reservationDate.toISOString().slice(0,10), entry.reservation.reservationTime, entry.reservation.status, entry.visitResult, entry.reservation.status === 'completed' ? entry.reservation.finalPrice : '']);
    } else if (type === 'ads-reservations') {
      await requireCrm(CRM_TRACKER_ROLES);
      const data=await adsReservationTracker({from:params.get('from')||'',to:params.get('to')||'',campaignId:params.get('campaignId')||'',status:params.get('status')||'',q:params.get('q')||'',page:1,perPage:5000});
      const all=data.rows;
      rows=[['ID Reservasi','Nama Pasien','WhatsApp','Treatment','Campaign','Platform','Booking Dibuat','Tanggal Reservasi','Jam','Status','Hasil Kunjungan','Pembayaran Aktual (Rp)']];
      for(const entry of all) rows.push([entry.reservationId,entry.lead.name,entry.lead.phone,entry.reservation.treatment.name,entry.campaign?.name||'',CRM_PLATFORMS[entry.campaign?.platform as keyof typeof CRM_PLATFORMS]||entry.campaign?.platform||'',entry.createdAt.toISOString(),entry.reservation.reservationDate.toISOString().slice(0,10),entry.reservation.reservationTime,entry.reservation.status,entry.visitResult,entry.reservation.status==='completed'?entry.reservation.finalPrice:'']);
    } else if (type === 'report') {
      const data = await report({ from: params.get('from') || '', to: params.get('to') || '', campaignId: params.get('campaignId') || '', platform: params.get('platform') || '' });
      rows = [['Campaign','Platform','Biaya','Reservasi','Hadir','Treatment','Omzet','ROAS']];
      for (const group of data.groups) rows.push([group.name, CRM_PLATFORMS[group.platform as keyof typeof CRM_PLATFORMS] || group.platform, group.spendEntries ? group.spend : '', group.reservations, group.attended, group.treatment, group.revenue, group.spend ? (group.revenue / group.spend).toFixed(2) : '']);
    } else throw new CrmError('Jenis ekspor tidak dikenal.');
    return new Response('\uFEFF' + rows.map(csv).join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="crm-prime-${type}.csv"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return crmError(error); }
}
