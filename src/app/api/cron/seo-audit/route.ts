/**
 * SEO audit cron: health-check drwprime.com and report to Telegram + DB.
 *
 * Called daily 08:00 WIB by Cronicle (.159). Runs fine without a Gemini key;
 * DataForSEO ranking checks are skipped when there is no credential or budget.
 *
 *   POST /api/cron/seo-audit
 *
 * Env: CRON_SECRET, DATAFORSEO_AUTH (optional), TELEGRAM_BOT_TOKEN/CHAT_ID (optional).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayloadClient } from '@/lib/payload';
import { SITE_URL } from '@/lib/seo';
import { guardCron } from '@/lib/seo-engine/cron-auth';
import { balance, hasBudget, onPageInstant, serpRank } from '@/lib/seo-engine/dataforseo';
import { KEYWORD_CLUSTER } from '@/lib/seo-engine/facts';
import { escapeHtml, telegramSend } from '@/lib/seo-engine/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const DOMAIN = SITE_URL.replace(/^https?:\/\//, '');
const USER_AGENT = 'DRWPrime-SEO-Monitor/1.0';

/** Pages whose meta tags materially affect indexing — checked on every run. */
const KEY_PAGES = ['/', '/treatments', '/products', '/blog'];

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
  pages: PageCheck[];
  sitemapUrls: number | null;
  robotsOk: boolean;
  robotsBlocksBlog: boolean;
  postsPublished: number;
  latestPostAgeDays: number | null;
  onPage: Awaited<ReturnType<typeof onPageInstant>>;
  dataforseoBalance: number | null;
};

type RankRow = { keyword: string; rank: number | null; previous: number | null };

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
    return { status: res.status, body: await res.text() };
  } catch {
    return { status: 0, body: '' };
  }
}

async function checkPage(path: string): Promise<PageCheck> {
  const { status, body } = await fetchText(`${SITE_URL}${path}`);
  const head = body.slice(0, 60_000);
  return {
    path,
    status,
    hasTitle: /<title[^>]*>\s*\S/i.test(head),
    hasDescription: /<meta[^>]+name=["']description["'][^>]+content=["']\s*\S/i.test(head),
    hasCanonical: /<link[^>]+rel=["']canonical["']/i.test(head),
    hasOgImage: /<meta[^>]+property=["']og:image["']/i.test(head),
    noindex: /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(head),
  };
}

/**
 * 0-100 health score. Page availability dominates because a 404 or a stray
 * noindex costs far more traffic than a missing OG tag.
 */
function healthScore(checks: AuditChecks): number {
  let score = 100;

  for (const page of checks.pages) {
    if (page.status !== 200) score -= 15;
    if (page.noindex) score -= 15;
    if (!page.hasTitle) score -= 5;
    if (!page.hasDescription) score -= 4;
    if (!page.hasCanonical) score -= 3;
    if (!page.hasOgImage) score -= 2;
  }

  if (!checks.robotsOk) score -= 5;
  if (checks.robotsBlocksBlog) score -= 15;
  if (checks.sitemapUrls === null) score -= 10;
  else if (checks.sitemapUrls < KEY_PAGES.length) score -= 5;

  // Stale blog: the whole point of the auto-blog job is that this stays low.
  if (checks.latestPostAgeDays === null) score -= 5;
  else if (checks.latestPostAgeDays > 14) score -= 8;
  else if (checks.latestPostAgeDays > 7) score -= 4;

  return Math.max(0, Math.min(100, score));
}

async function handler(request: Request) {
  const denied = guardCron(request);
  if (denied) return denied;

  // --- Pages -------------------------------------------------------------
  const pages = await Promise.all(KEY_PAGES.map(checkPage));

  // --- Sitemap + robots --------------------------------------------------
  const sitemap = await fetchText(`${SITE_URL}/sitemap.xml`);
  const sitemapUrls =
    sitemap.status === 200 ? (sitemap.body.match(/<loc>/g) ?? []).length : null;

  const robots = await fetchText(`${SITE_URL}/robots.txt`);
  const robotsOk = robots.status === 200;
  const robotsBlocksBlog = robotsOk && /^\s*Disallow:\s*\/blog/im.test(robots.body);

  // --- Content freshness -------------------------------------------------
  let postsPublished = 0;
  let latestPostAgeDays: number | null = null;
  try {
    const payload = await getPayloadClient();
    const { totalDocs, docs } = await payload.find({
      collection: 'posts',
      where: { _status: { equals: 'published' } },
      sort: '-publishedAt',
      limit: 1,
      depth: 0,
    });
    postsPublished = totalDocs;
    const latest = (docs[0] as { publishedAt?: string | null } | undefined)?.publishedAt;
    if (latest) {
      latestPostAgeDays = Math.max(
        0,
        Math.round((Date.now() - new Date(latest).getTime()) / 86_400_000)
      );
    }
  } catch (error) {
    console.error('[seo-audit] gagal baca posts:', error);
  }

  // --- DataForSEO (optional) ---------------------------------------------
  const rankings: RankRow[] = [];
  let onPage: AuditChecks['onPage'] = null;
  const dataforseoBalance = await balance();

  const previous = await prisma.seoAuditRun
    .findFirst({ orderBy: { runAt: 'desc' } })
    .catch(() => null);
  const previousRanks = new Map<string, number | null>(
    Array.isArray(previous?.rankings)
      ? (previous.rankings as unknown as RankRow[]).map((row) => [row.keyword, row.rank])
      : []
  );

  if (await hasBudget(0.05)) {
    const keywords = [KEYWORD_CLUSTER.primary, ...KEYWORD_CLUSTER.secondary.slice(0, 4)];
    for (const keyword of keywords) {
      const rank = await serpRank(keyword, DOMAIN);
      rankings.push({ keyword, rank, previous: previousRanks.get(keyword) ?? null });
    }
    onPage = await onPageInstant(SITE_URL);
  }

  const checks: AuditChecks = {
    pages,
    sitemapUrls,
    robotsOk,
    robotsBlocksBlog,
    postsPublished,
    latestPostAgeDays,
    onPage,
    dataforseoBalance,
  };
  const score = healthScore(checks);
  const ok = score >= 80 && pages.every((page) => page.status === 200);

  // --- Persist -----------------------------------------------------------
  let runId: string | null = null;
  try {
    const run = await prisma.seoAuditRun.create({
      data: {
        ok,
        healthScore: score,
        checks: checks as unknown as object,
        rankings: rankings as unknown as object,
      },
    });
    runId = run.id;
  } catch (error) {
    console.error('[seo-audit] gagal simpan SeoAuditRun:', error);
  }

  // --- Report ------------------------------------------------------------
  const lines: string[] = [
    `📊 <b>SEO Digest — DRW Prime</b>`,
    `<i>${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</i>`,
    '',
    `${ok ? '✅' : '⚠️'} Skor kesehatan: <b>${score}/100</b>`,
    '',
    '<b>Halaman kunci:</b>',
  ];

  for (const page of pages) {
    const flags: string[] = [];
    if (page.noindex) flags.push('noindex!');
    if (!page.hasTitle) flags.push('tanpa title');
    if (!page.hasDescription) flags.push('tanpa description');
    if (!page.hasCanonical) flags.push('tanpa canonical');
    if (!page.hasOgImage) flags.push('tanpa og:image');
    const mark = page.status === 200 ? '✅' : '❌';
    lines.push(
      `${mark} ${page.path} — ${page.status || 'gagal'}${flags.length ? ` <i>(${flags.join(', ')})</i>` : ''}`
    );
  }

  lines.push('');
  lines.push(`🗺️ Sitemap: ${sitemapUrls === null ? '⚠️ gagal ambil' : `${sitemapUrls} URL`}`);
  lines.push(
    `🤖 robots.txt: ${robotsOk ? (robotsBlocksBlog ? '❌ memblokir /blog' : '✅ ok') : '⚠️ gagal ambil'}`
  );
  lines.push(
    `📝 Artikel: ${postsPublished} publish · terbaru ${latestPostAgeDays === null ? '-' : `${latestPostAgeDays} hari lalu`}`
  );

  if (onPage) {
    lines.push(
      `⚙️ On-page score: ${onPage.onPageScore ?? '-'} · load ${onPage.loadTimeMs ?? '-'}ms`
    );
    if (onPage.failedChecks.length) {
      lines.push(`   <i>${escapeHtml(onPage.failedChecks.slice(0, 6).join(', '))}</i>`);
    }
  }

  if (rankings.length) {
    lines.push('', '<b>Ranking Google (ID):</b>');
    for (const row of rankings) {
      let delta = '';
      if (row.rank !== null && row.previous !== null && row.rank !== row.previous) {
        const change = row.previous - row.rank;
        delta = change > 0 ? ` 🔼 +${change}` : ` 🔽 ${change}`;
      }
      lines.push(
        `• ${escapeHtml(row.keyword)}: ${row.rank ? `#${row.rank}` : 'di luar top 100'}${delta}`
      );
    }
  } else {
    lines.push('', '<i>Ranking dilewati (DataForSEO tidak aktif / saldo kurang).</i>');
  }

  if (dataforseoBalance !== null) {
    lines.push('', `💳 Saldo DataForSEO: $${dataforseoBalance.toFixed(2)}`);
  }

  const text = lines.join('\n');
  console.log(text.replace(/<[^>]+>/g, ''));
  const sent = await telegramSend(text);

  return NextResponse.json({
    ok,
    runId,
    healthScore: score,
    checks,
    rankings,
    telegram: sent,
  });
}

export async function POST(request: Request) {
  return handler(request);
}

/** Cronicle's shellplug uses a plain curl, so GET is supported too. */
export async function GET(request: Request) {
  return handler(request);
}
