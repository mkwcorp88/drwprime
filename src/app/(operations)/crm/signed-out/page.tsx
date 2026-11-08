import Link from 'next/link';
import '../crm.css';

export const metadata = { title: 'Keluar dari CRM', robots: { index: false, follow: false } };
export default function SignedOutPage() {
  return <main className="crm-standalone"><section className="crm-standalone-card"><span className="crm-eyebrow">DRW Prime · CRM</span><h1>Anda sudah keluar dari CRM</h1><p>Sesi CRM berakhir. Sesi staf pada website DRW Prime dapat tetap aktif.</p><Link href="/crm">Masuk kembali →</Link></section></main>;
}
