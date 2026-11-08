import Link from 'next/link';

export const metadata = { title: 'Keluar dari CRM', robots: { index: false, follow: false } };
export default function SignedOutPage() {
  return <main className="min-h-screen bg-[#f7f8f7] flex items-center justify-center p-6"><section className="max-w-md rounded-2xl border border-[#e8e6df] bg-white p-8 text-[#1c252e]"><h1 className="text-2xl font-semibold">Anda sudah keluar dari CRM</h1><p className="mt-3 text-sm text-[#65717a]">Sesi CRM berakhir. Sesi staf pada website DRW Prime dapat tetap aktif.</p><Link href="/crm" className="mt-6 inline-block rounded-xl bg-[#ad812d] px-5 py-3 text-sm font-semibold text-white">Masuk kembali</Link></section></main>;
}
