/**
 * SEO audit history — read-only view of what /api/cron/seo-audit records.
 *
 * The audit job (Cronicle .159, daily 08:00 WIB) writes one `SeoAuditRun` per
 * run; this page shows the latest snapshot plus the trend behind it.
 */
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type PageCheck = {
  path: string;
  status: number;
  hasTitle: boolean;
  hasDescription: boolean;
  hasCanonical: boolean;
  hasOgImage: boolean;
  noindex: boolean;
};

type AuditChecks = {
  pages?: PageCheck[];
  sitemapUrls?: number | null;
  robotsOk?: boolean;
  robotsBlocksBlog?: boolean;
  postsPublished?: number;
  latestPostAgeDays?: number | null;
  onPage?: {
    onPageScore: number | null;
    loadTimeMs: number | null;
    failedChecks: string[];
  } | null;
  dataforseoBalance?: number | null;
};

type RankRow = { keyword: string; rank: number | null; previous: number | null };

function scoreTone(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-primary';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(value);
}

export default async function AdminSeoPage() {
  if (!(await isUserAdmin())) redirect('/my-prime');

  const runs = await prisma.seoAuditRun
    .findMany({ orderBy: { runAt: 'desc' }, take: 30 })
    .catch(() => []);

  const latest = runs[0];
  const checks = (latest?.checks ?? {}) as AuditChecks;
  const rankings = (Array.isArray(latest?.rankings) ? latest.rankings : []) as unknown as RankRow[];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Audit SEO</h1>
        <p className="mt-2 text-sm text-white/60">
          Dijalankan otomatis tiap hari 08:00 WIB lewat Cronicle. Auto-blog terbit tiap hari dan
          hasilnya ikut terpantau di sini.
        </p>
      </header>

      {!latest ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          Belum ada hasil audit. Job pertama akan mengisi halaman ini — atau jalankan manual lewat
          Cronicle (<span className="text-primary">DRW Prime — SEO Audit</span>).
        </div>
      ) : (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">Skor kesehatan</p>
              <p className={`mt-1 text-4xl font-bold ${scoreTone(latest.healthScore)}`}>
                {latest.healthScore}
                <span className="text-lg text-white/40">/100</span>
              </p>
              <p className="mt-1 text-xs text-white/50">{formatDate(latest.runAt)} WIB</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">Artikel terbit</p>
              <p className="mt-1 text-4xl font-bold text-white">{checks.postsPublished ?? '-'}</p>
              <p className="mt-1 text-xs text-white/50">
                Terbaru{' '}
                {checks.latestPostAgeDays === null || checks.latestPostAgeDays === undefined
                  ? '-'
                  : `${checks.latestPostAgeDays} hari lalu`}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">Sitemap</p>
              <p className="mt-1 text-4xl font-bold text-white">{checks.sitemapUrls ?? '-'}</p>
              <p className="mt-1 text-xs text-white/50">
                robots.txt{' '}
                {checks.robotsBlocksBlog
                  ? '❌ memblokir /blog'
                  : checks.robotsOk
                    ? '✅ ok'
                    : '⚠️ gagal ambil'}
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-white">Halaman kunci</h2>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/50">
                  <tr>
                    <th className="px-4 py-3">Halaman</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Canonical</th>
                    <th className="px-4 py-3">og:image</th>
                    <th className="px-4 py-3">Index</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {(checks.pages ?? []).map((page) => (
                    <tr key={page.path}>
                      <td className="px-4 py-3 font-medium text-white">{page.path}</td>
                      <td className="px-4 py-3">
                        <span className={page.status === 200 ? 'text-emerald-400' : 'text-red-400'}>
                          {page.status || 'gagal'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{page.hasTitle ? '✅' : '❌'}</td>
                      <td className="px-4 py-3">{page.hasDescription ? '✅' : '❌'}</td>
                      <td className="px-4 py-3">{page.hasCanonical ? '✅' : '❌'}</td>
                      <td className="px-4 py-3">{page.hasOgImage ? '✅' : '❌'}</td>
                      <td className="px-4 py-3">
                        {page.noindex ? <span className="text-red-400">noindex</span> : '✅'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-white">Ranking Google (Indonesia)</h2>
            {rankings.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
                Ranking dilewati pada run terakhir — DataForSEO tidak aktif atau saldo di bawah
                ambang.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/50">
                    <tr>
                      <th className="px-4 py-3">Keyword</th>
                      <th className="px-4 py-3">Posisi</th>
                      <th className="px-4 py-3">Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white/80">
                    {rankings.map((row) => {
                      const delta =
                        row.rank !== null && row.previous !== null ? row.previous - row.rank : null;
                      return (
                        <tr key={row.keyword}>
                          <td className="px-4 py-3 text-white">{row.keyword}</td>
                          <td className="px-4 py-3">
                            {row.rank ? `#${row.rank}` : 'di luar top 100'}
                          </td>
                          <td className="px-4 py-3">
                            {delta === null || delta === 0 ? (
                              <span className="text-white/40">—</span>
                            ) : delta > 0 ? (
                              <span className="text-emerald-400">🔼 +{delta}</span>
                            ) : (
                              <span className="text-red-400">🔽 {delta}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {checks.dataforseoBalance !== null && checks.dataforseoBalance !== undefined && (
              <p className="mt-2 text-xs text-white/50">
                Saldo DataForSEO: ${checks.dataforseoBalance.toFixed(2)}
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">Riwayat</h2>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/50">
                  <tr>
                    <th className="px-4 py-3">Waktu (WIB)</th>
                    <th className="px-4 py-3">Skor</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3">{formatDate(run.runAt)}</td>
                      <td className={`px-4 py-3 font-semibold ${scoreTone(run.healthScore)}`}>
                        {run.healthScore}
                      </td>
                      <td className="px-4 py-3">{run.ok ? '✅ sehat' : '⚠️ perlu dicek'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
