/**
 * Auto-blog cron: generate and publish blog articles for DRW Prime.
 *
 * Called hourly by Cronicle (.159). Idempotent per day — it counts what has
 * already been published today and only writes the shortfall, so an hourly
 * schedule catches up after downtime without ever double-posting.
 *
 *   POST /api/cron/seo-blog            respect BLOG_ARTICLES_PER_DAY
 *   POST /api/cron/seo-blog?force=1    generate one regardless of the target
 *   POST /api/cron/seo-blog?draft=1    write as a draft instead of publishing
 *
 * `draft=1` is the safe switch: use it for the first run after a prompt change,
 * review the result in /cms, and only then let the schedule publish for real.
 *
 * Env: CRON_SECRET, GEMINI_API_KEY, BLOG_ARTICLES_PER_DAY (default 1),
 *      DATAFORSEO_AUTH (optional), TELEGRAM_BOT_TOKEN/CHAT_ID (optional).
 */
import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import { SITE_URL } from '@/lib/seo';
import { guardCron } from '@/lib/seo-engine/cron-auth';
import { generateArticle, generateCover, hasGeminiKey } from '@/lib/seo-engine/gemini';
import { blocksToLexical, blocksToPlainText } from '@/lib/seo-engine/lexical';
import { escapeHtml, telegramSend, telegramSendPhoto } from '@/lib/seo-engine/notify';
import { pickTopic } from '@/lib/seo-engine/topics';

export const dynamic = 'force-dynamic';
export const maxDuration = 800;

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70)
    .replace(/^-|-$/g, '');
}

type Payload = Awaited<ReturnType<typeof getPayloadClient>>;

async function slugExists(payload: Payload, slug: string): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: 'posts',
    where: { slug: { equals: slug } },
  });
  return totalDocs > 0;
}

async function uniqueSlug(payload: Payload, base: string): Promise<string> {
  const slug = slugify(base) || 'artikel';
  if (!(await slugExists(payload, slug))) return slug;
  for (let i = 2; i < 20; i++) {
    const candidate = `${slug}-${i}`.slice(0, 70);
    if (!(await slugExists(payload, candidate))) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`.slice(0, 70);
}

async function publishedToday(payload: Payload): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { totalDocs } = await payload.count({
    collection: 'posts',
    where: { createdAt: { greater_than_equal: startOfDay.toISOString() } },
  });
  return totalDocs;
}

async function generateOne(payload: Payload, { draft }: { draft: boolean }) {
  const topic = await pickTopic();
  console.log(`[seo-blog] generating "${topic.topic}" (kw=${topic.keyword}, src=${topic.source})`);

  const article = await generateArticle(topic.topic, topic.keyword);
  const slug = await uniqueSlug(payload, article.slug || article.title);
  const content = blocksToLexical(article.blocks);
  const wordCount = blocksToPlainText(article.blocks).split(/\s+/).filter(Boolean).length;

  // Cover is best-effort: a failed image must not block the article.
  let heroImageId: number | string | null = null;
  let heroImageUrl: string | null = null;
  const cover = await generateCover({ title: article.title, keyword: topic.keyword, slug });
  if (cover) {
    try {
      const extension = cover.mime.includes('png')
        ? 'png'
        : cover.mime.includes('webp')
          ? 'webp'
          : 'jpg';
      const media = await payload.create({
        collection: 'media',
        data: { alt: article.title },
        file: {
          data: cover.buffer,
          mimetype: cover.mime,
          name: `${slug}-cover.${extension}`,
          size: cover.buffer.length,
        },
      });
      heroImageId = media.id;
      heroImageUrl = (media as { url?: string | null }).url ?? null;
    } catch (error) {
      console.error('[seo-blog] upload cover gagal:', error);
    }
  }

  const post = await payload.create({
    collection: 'posts',
    data: {
      title: article.title,
      slug,
      excerpt: article.excerpt,
      content,
      tags: article.tags,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      ...(heroImageId ? { heroImage: heroImageId } : {}),
      publishedAt: new Date().toISOString(),
      _status: draft ? 'draft' : 'published',
    },
  });

  return {
    id: post.id,
    slug,
    draft,
    title: article.title,
    url: `${SITE_URL}/blog/${slug}`,
    keyword: topic.keyword,
    topicSource: topic.source,
    wordCount,
    heroImageUrl: heroImageUrl ? `${SITE_URL}${heroImageUrl}` : null,
  };
}

async function handler(request: Request) {
  const denied = guardCron(request);
  if (denied) return denied;

  if (!hasGeminiKey()) {
    return NextResponse.json(
      { ok: false, error: 'GEMINI_API_KEY belum diset' },
      { status: 503 }
    );
  }

  const params = new URL(request.url).searchParams;
  const force = params.get('force') === '1';
  const draft = params.get('draft') === '1';
  const target = Number.parseInt(process.env.BLOG_ARTICLES_PER_DAY || '1', 10) || 1;

  const payload = await getPayloadClient();
  const doneToday = await publishedToday(payload);
  let toGenerate = Math.max(0, target - doneToday);
  if (force) toGenerate = Math.max(toGenerate, 1);

  if (toGenerate === 0) {
    console.log(`[seo-blog] target ${target}/hari sudah tercapai (${doneToday}). Skip.`);
    return NextResponse.json({ ok: true, skipped: true, target, doneToday, generated: [] });
  }

  const generated = [];
  const failures = [];

  for (let i = 0; i < toGenerate; i++) {
    try {
      const result = await generateOne(payload, { draft });
      generated.push(result);
      console.log(
        `[seo-blog] ${draft ? 'draft' : 'published'} ${result.url} (${result.wordCount} kata)`
      );

      const caption =
        `📝 <b>Artikel ${draft ? 'draft dibuat' : 'baru terbit'} — DRW Prime</b>\n\n` +
        `<b>${escapeHtml(result.title)}</b>\n` +
        `🔗 ${result.url}\n` +
        `🎯 ${escapeHtml(result.keyword)} <i>(${result.topicSource})</i>\n` +
        `📄 ${result.wordCount} kata · 🖼️ ${result.heroImageUrl ? 'cover AI ✅' : 'tanpa cover'}`;

      if (result.heroImageUrl) await telegramSendPhoto(result.heroImageUrl, caption);
      else await telegramSend(caption);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 400);
      console.error(`[seo-blog] FAILED: ${message}`);
      failures.push(message);
      await telegramSend(
        `⚠️ <b>Auto-blog GAGAL — DRW Prime</b>\n\n${escapeHtml(message)}`
      );
    }
  }

  return NextResponse.json(
    { ok: failures.length === 0, target, doneToday, generated, failures },
    { status: failures.length && !generated.length ? 500 : 200 }
  );
}

export async function POST(request: Request) {
  return handler(request);
}

/** Cronicle's shellplug uses a plain curl, so GET is supported too. */
export async function GET(request: Request) {
  return handler(request);
}
