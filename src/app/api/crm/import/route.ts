import { assertCrmOrigin, crmError, requireCrm } from '@/lib/crm/auth';
import { CRM_WRITE_ROLES } from '@/lib/crm/constants';
import { prepareImport } from '@/lib/crm/import-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    assertCrmOrigin(request);
    const { staff } = await requireCrm(CRM_WRITE_ROLES);
    return Response.json(await prepareImport(request, staff.id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return crmError(error); }
}
