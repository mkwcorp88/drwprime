import { ReservationError } from '@/lib/services/reservation';
import { assertCrmOrigin, crmError, CrmError, requireCrm } from '@/lib/crm/auth';
import { CRM_AD_ROLES, CRM_BOOKING_ROLES, CRM_WRITE_ROLES } from '@/lib/crm/constants';
import { bootstrap, createReservation, followUp, handleDbError, leadDetail, listLeads, saveCampaign, saveEvent, saveLead, saveSpend, setGrant, updateReservation, users } from '@/lib/crm/service';
import { dashboard, eventSummary, report, reservations } from '@/lib/crm/reports';
import { discardImport, importPreview, saveImport } from '@/lib/crm/import-service';
import { readCrmJson, text } from '@/lib/crm/validation';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const response = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });

export async function GET(request: Request) {
  try {
    const { staff, role } = await requireCrm();
    const params = new URL(request.url).searchParams, view = params.get('view') || 'dashboard';
    const actor = { id: staff.id, role };
    if (view === 'bootstrap') return response({ ...(await bootstrap(actor)), actor: { id: staff.id, name: staff.name } });
    if (view === 'dashboard') return response(await dashboard());
    if (view === 'events') return response(await eventSummary());
    if (view === 'reservations') return response(await reservations());
    if (view === 'lead') return response(await leadDetail(text(params.get('id'), 'Kontak', 100, true)));
    if (view === 'report') return response(await report({ from: params.get('from') || '', to: params.get('to') || '', campaignId: params.get('campaignId') || '', platform: params.get('platform') || '' }));
    if (view === 'spend') {
      await requireCrm(CRM_AD_ROLES);
      return response(await prisma.crmSpend.findMany({ include: { campaign: true }, orderBy: [{ spendDate: 'desc' }, { createdAt: 'desc' }], take: 200 }));
    }
    if (view === 'users') { await requireCrm(['ADMIN']); return response(await users()); }
    if (view === 'import') { await requireCrm(CRM_WRITE_ROLES); return response(await importPreview(text(params.get('id'), 'Pratinjau', 100, true), staff.id)); }
    throw new CrmError('Halaman tidak ditemukan.', 404);
  } catch (error) { return crmError(error); }
}

export async function POST(request: Request) {
  try {
    assertCrmOrigin(request);
    const { staff, role } = await requireCrm();
    const input = await readCrmJson(request), action = text(input.action, 'Tindakan', 60, true);
    const actor = { id: staff.id, role };
    if (action === 'list_leads') return response(await listLeads(input, actor));
    if (action === 'save_lead') { await requireCrm(CRM_WRITE_ROLES); return response(await saveLead(input, actor)); }
    if (action === 'follow_up') { await requireCrm(CRM_WRITE_ROLES); return response(await followUp(input, actor)); }
    if (action === 'save_event') { await requireCrm(CRM_WRITE_ROLES); return response(await saveEvent(input, actor)); }
    if (action === 'save_campaign') { await requireCrm(CRM_AD_ROLES); return response(await saveCampaign(input, actor)); }
    if (action === 'save_spend') { await requireCrm(CRM_AD_ROLES); return response(await saveSpend(input, actor)); }
    if (action === 'set_grant') { await requireCrm(['ADMIN']); return response(await setGrant(input, actor)); }
    if (action === 'create_reservation') { await requireCrm(CRM_BOOKING_ROLES); return response(await createReservation(input, actor)); }
    if (action === 'update_reservation') { await requireCrm(CRM_BOOKING_ROLES); return response(await updateReservation(input, actor)); }
    if (action === 'save_import') { await requireCrm(CRM_WRITE_ROLES); return response(await saveImport(input, staff.id)); }
    if (action === 'discard_import') { await requireCrm(CRM_WRITE_ROLES); return response(await discardImport(text(input.id, 'Pratinjau', 100, true), staff.id)); }
    throw new CrmError('Tindakan tidak dikenal.', 404);
  } catch (error) {
    if (error instanceof ReservationError) return crmError(new CrmError(error.message, 409));
    try { handleDbError(error); } catch (mapped) { return crmError(mapped); }
  }
}
