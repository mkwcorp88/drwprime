import { crmError, requireCrm } from '@/lib/crm/auth';
import { CRM_WRITE_ROLES } from '@/lib/crm/constants';
import { importFile } from '@/lib/crm/import-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string; fileId: string }> }) {
  try {
    const { staff } = await requireCrm(CRM_WRITE_ROLES);
    const { batchId, fileId } = await params;
    const file = await importFile(batchId, fileId, staff.id);
    return new Response(new Uint8Array(file.data), { headers: { 'Content-Type': file.mime, 'Content-Disposition': 'inline; filename="dokumen-event"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch (error) { return crmError(error); }
}
