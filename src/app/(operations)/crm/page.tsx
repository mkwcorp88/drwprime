import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { crmAccess, CrmError } from '@/lib/crm/auth';
import { StaffAuthError } from '@/lib/staff-auth/service';
import { isCrmHost } from '@/lib/crm/sso';
import CrmApp from '@/components/crm/CrmApp';
import './crm.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CRM DRW Prime', robots: { index: false, follow: false } };

export default async function CrmPage() {
  try {
    const { staff, role } = await crmAccess();
    return <CrmApp initialActor={{ id: staff.id, name: staff.name, role }} />;
  } catch (error) {
    if (error instanceof StaffAuthError) {
      const host = (await headers()).get('host')?.split(':')[0] || '';
      redirect(isCrmHost(host) ? '/api/crm/sso/start' : '/staff/sign-in?redirect_url=%2Fcrm');
    }
    if (error instanceof CrmError) return <main className="crm-denied"><h1>Akses CRM belum tersedia</h1><p>{error.message}</p><Link href="/staff/sign-in">Kembali ke login staf</Link></main>;
    throw error;
  }
}
