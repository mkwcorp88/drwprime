/**
 * DataForSEO client (shared DRW account).
 *
 * `DATAFORSEO_AUTH` is base64("login:password"). The whole engine works WITHOUT
 * it — every function degrades to null/[]/false instead of throwing, so a missing
 * credential or an empty balance never takes the cron job down with it.
 */
const AUTH = () => process.env.DATAFORSEO_AUTH;
const BASE = 'https://api.dataforseo.com';

/** Indonesia / Bahasa Indonesia — DRW Prime only ranks for local queries. */
const LOCATION_CODE = 2360;
const LANGUAGE_CODE = 'id';

async function call(path: string, task: Record<string, unknown>) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Basic ${AUTH()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([task]),
  });
  if (!res.ok) throw new Error(`dataforseo ${res.status}`);
  return res.json();
}

export function hasCredentials(): boolean {
  return Boolean(AUTH());
}

/** Remaining account balance in USD, or null when unavailable. */
export async function balance(): Promise<number | null> {
  if (!AUTH()) return null;
  try {
    const res = await fetch(BASE + '/v3/appendix/user_data', {
      headers: { Authorization: `Basic ${AUTH()}` },
    });
    const json = await res.json();
    const value = json?.tasks?.[0]?.result?.[0]?.money?.balance;
    return typeof value === 'number' ? value : null;
  } catch {
    return null;
  }
}

/** Guard: false when there is no auth or the balance is below `min` USD. Never throws. */
export async function hasBudget(min = 0.05): Promise<boolean> {
  const value = await balance();
  return value !== null && value >= min;
}

/** Organic rank of `domain` for `keyword` (1-100), or null when not found / no budget. */
export async function serpRank(
  keyword: string,
  domain: string,
  { depth = 100 }: { depth?: number } = {}
): Promise<number | null> {
  if (!AUTH()) return null;
  try {
    const json = await call('/v3/serp/google/organic/live/advanced', {
      keyword,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      depth,
    });
    const items = json?.tasks?.[0]?.result?.[0]?.items ?? [];
    const target = domain.replace(/^www\./, '');
    for (const item of items) {
      if (item.type !== 'organic') continue;
      const found = String(item.domain || item.url || '')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '');
      if (found.startsWith(target)) return item.rank_absolute || item.rank_group || null;
    }
    return null;
  } catch {
    return null;
  }
}

export type KeywordIdea = { keyword: string; volume: number };

/** Keyword ideas around a seed (search volume > 50). Returns [] on any failure. */
export async function keywordIdeas(
  seed: string,
  { limit = 20 }: { limit?: number } = {}
): Promise<KeywordIdea[]> {
  if (!AUTH()) return [];
  try {
    const json = await call('/v3/dataforseo_labs/google/keyword_ideas/live', {
      keywords: [seed],
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      limit,
    });
    const items = json?.tasks?.[0]?.result?.[0]?.items ?? [];
    return items
      .map((item: Record<string, never>) => ({
        keyword: String((item as Record<string, unknown>).keyword ?? ''),
        volume: Number(
          (item as { keyword_info?: { search_volume?: number } }).keyword_info?.search_volume ?? 0
        ),
      }))
      .filter((k: KeywordIdea) => k.keyword && k.volume > 50)
      .sort((a: KeywordIdea, b: KeywordIdea) => b.volume - a.volume);
  } catch {
    return [];
  }
}

/**
 * DataForSEO's `checks` map is mostly negative-framed — `true` means the problem
 * is PRESENT. These keys are the exceptions where `true` means the page PASSES,
 * so reporting them as failures would be backwards. Verified against a live
 * `instant_pages` response for https://drwprime.com.
 */
const POSITIVE_CHECKS = new Set([
  'canonical',
  'from_sitemap',
  'has_html_doctype',
  'has_meta_title',
  'has_micromarkup',
  'is_https',
  'meta_charset_consistency',
  'seo_friendly_url',
  'seo_friendly_url_characters_check',
  'seo_friendly_url_dynamic_check',
  'seo_friendly_url_keywords_check',
  'seo_friendly_url_relative_length_check',
]);

export type OnPageSummary = {
  /** DataForSEO's own 0-100 on-page score. */
  onPageScore: number | null;
  loadTimeMs: number | null;
  /** Checks that FAILED, e.g. "no_description", "large_page_size". */
  failedChecks: string[];
};

/**
 * Instant on-page audit of a single URL (title/description/duplicate/size/speed).
 * DataForSEO returns `checks` as a flat boolean map where `true` means the
 * problem is PRESENT, so we surface the true ones as failures.
 */
export async function onPageInstant(url: string): Promise<OnPageSummary | null> {
  if (!AUTH()) return null;
  try {
    const json = await call('/v3/on_page/instant_pages', {
      url,
      enable_javascript: true,
    });
    const item = json?.tasks?.[0]?.result?.[0]?.items?.[0];
    if (!item) return null;

    const checks: Record<string, unknown> = item.checks ?? {};
    const failedChecks = Object.entries(checks)
      .filter(([key, value]) => value === true && !POSITIVE_CHECKS.has(key))
      .map(([key]) => key)
      .sort();

    return {
      onPageScore: typeof item.onpage_score === 'number' ? Math.round(item.onpage_score) : null,
      loadTimeMs:
        typeof item.page_timing?.duration_time === 'number' ? item.page_timing.duration_time : null,
      failedChecks,
    };
  } catch {
    return null;
  }
}
