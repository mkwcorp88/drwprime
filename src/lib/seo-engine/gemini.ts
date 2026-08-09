/**
 * Gemini calls for the SEO engine — article text and cover image.
 *
 * Plain `fetch` against the REST API on purpose: no SDK dependency, and the
 * same shape already proven in the drwtrans blog engine.
 *
 * Env: GEMINI_API_KEY (or GOOGLE_API_KEY),
 *      GEO_GEN_GEMINI_MODEL   (default gemini-flash-latest),
 *      GEO_IMAGE_GEMINI_MODEL (default gemini-2.5-flash-image).
 *
 * NOTE: do not "pin" the text model back to `gemini-2.5-flash` — Google now
 * refuses it for newly issued API keys ("no longer available to new users"),
 * even though it still appears in the models list. `gemini-flash-latest`
 * resolves to the current Flash and is verified working with this project's key.
 */
import { COMPANY, factSheet, SOURCE_PHOTOS } from './facts';
import type { ArticleBlock } from './lexical';

const KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const TEXT_MODEL = process.env.GEO_GEN_GEMINI_MODEL || 'gemini-flash-latest';
const IMAGE_MODELS = [
  process.env.GEO_IMAGE_GEMINI_MODEL || 'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
];

export function hasGeminiKey(): boolean {
  return Boolean(KEY());
}

// ---------------------------------------------------------------------------
// Article
// ---------------------------------------------------------------------------

export type GeneratedArticle = {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyphrase: string;
  tags: string[];
  blocks: ArticleBlock[];
};

const BLOCK_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['h2', 'h3', 'p', 'ul'] },
    text: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } },
  },
  required: ['type'],
};

const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    slug: { type: 'string' },
    excerpt: { type: 'string' },
    seoTitle: { type: 'string' },
    seoDescription: { type: 'string' },
    focusKeyphrase: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    blocks: { type: 'array', items: BLOCK_SCHEMA },
  },
  required: [
    'title',
    'slug',
    'excerpt',
    'seoTitle',
    'seoDescription',
    'focusKeyphrase',
    'tags',
    'blocks',
  ],
};

/**
 * The production prompt. Rules are deliberately strict: these articles publish
 * without human review on a medical-aesthetics site, so anything the model is
 * unsure about must be omitted rather than guessed.
 */
const SYSTEM = `Kamu penulis konten SEO untuk ${COMPANY.legalName}, klinik kecantikan dan estetika di ${COMPANY.region}.
Tulis SATU artikel blog berbahasa Indonesia yang hangat, informatif, dan akurat.

ATURAN KETAT (wajib dipatuhi, artikel ini terbit otomatis tanpa review manusia):
- HANYA gunakan fakta dari blok DATA. DILARANG mengarang nama treatment, harga, durasi, promo, atau fasilitas yang tidak ada di DATA.
- DILARANG membuat klaim medis, diagnosis, atau janji hasil ("pasti hilang", "permanen", "sembuh total", "100% aman"). Gunakan bahasa berhati-hati: "membantu", "umumnya", "hasil bervariasi tiap orang".
- Selalu arahkan keputusan medis ke konsultasi dokter di klinik. Jangan menyarankan tindakan mandiri di rumah untuk prosedur medis.
- Kalau sebuah informasi tidak ada di DATA, tulis netral atau lewati — jangan diisi tebakan.

GAYA & STRUKTUR:
- Panjang 700-1000 kata. Sisipkan target keyword secara natural: di judul, paragraf pertama, dan 1-2 subjudul.
- Tulis seperti manusia: variasikan panjang kalimat, sapa pembaca dengan "Anda", hindari kalimat pembuka klise ("Di era modern ini", "Dalam dunia yang serba cepat").
- Hindari pola khas AI: jangan pakai "Selain itu," berulang, jangan tiap paragraf diawali kata penghubung, jangan bullet yang isinya cuma satu frasa.
- Alur: pembuka (hook + keyword) -> penjelasan bermanfaat -> treatment DRW Prime yang relevan (sebut harga PERSIS seperti di DATA) -> FAQ 3-5 pertanyaan -> CTA konsultasi ke ${COMPANY.contact}.

FORMAT OUTPUT (field "blocks"):
- Array blok berurutan. "h2" = subjudul utama, "h3" = pertanyaan FAQ, "p" = paragraf, "ul" = daftar (isi di "items").
- JANGAN pakai tag HTML, JANGAN pakai markdown heading (#). Untuk penekanan boleh **tebal** di dalam teks.
- Blok pertama HARUS "p" (paragraf pembuka), bukan heading. Jangan membuat h1 — judul sudah terpisah di field "title".

FIELD LAIN:
- seoTitle maksimal 60 karakter, seoDescription maksimal 155 karakter, keduanya mengandung keyword.
- slug: huruf kecil, dipisah tanda hubung, tanpa tahun/tanggal.
- excerpt 1-2 kalimat ringkas.
- tags: 3-6 tag pendek yang relevan.`;

async function callGemini<T>(prompt: string, schema: object, maxOutputTokens: number): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${KEY()}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const json = await res.json();
      const candidate = json?.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .map((part: { text?: string }) => part.text ?? '')
        .join('');
      if (!text) {
        // Flash is a thinking model: reasoning tokens count against
        // maxOutputTokens, so a budget that is too small returns MAX_TOKENS with
        // no text at all rather than a short article.
        const reason = candidate?.finishReason ?? 'unknown';
        const thoughts = json?.usageMetadata?.thoughtsTokenCount ?? 0;
        throw new Error(`empty gemini response (finishReason=${reason}, thoughts=${thoughts})`);
      }
      return JSON.parse(text) as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('gemini failed');
}

export async function generateArticle(topic: string, keyword: string): Promise<GeneratedArticle> {
  if (!KEY()) throw new Error('GEMINI_API_KEY belum diset');

  const prompt = `${SYSTEM}

Topik artikel: "${topic}"
Target keyword: "${keyword}"

DATA:

${factSheet()}`;

  // 24k, not 8k: a 700-1000 word article is ~2k tokens, but Flash spends a few
  // thousand more on reasoning and both share this budget.
  const result = await callGemini<GeneratedArticle>(prompt, ARTICLE_SCHEMA, 24000);
  return {
    ...result,
    tags: Array.isArray(result.tags)
      ? result.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 6)
      : [],
    blocks: Array.isArray(result.blocks) ? result.blocks : [],
  };
}

// ---------------------------------------------------------------------------
// Cover image
// ---------------------------------------------------------------------------

/** Stable pick per slug, so a re-run grounds on the same room photo. */
function pickSourcePhoto(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return SOURCE_PHOTOS[hash % SOURCE_PHOTOS.length];
}

function coverPrompt(title: string, keyword: string): string {
  return `This is a real photo of the ${COMPANY.name} aesthetic clinic in ${COMPANY.city}, Indonesia. Create a polished 16:9 blog cover image based on it.
KEEP THE ROOM AND ITS INTERIOR RECOGNISABLE: same layout, same furniture, same colour palette and materials — do NOT redesign the space into a different clinic.
You MAY improve the lighting and staging into a warm, premium, inviting treatment-room atmosphere: soft natural light, clean and tidy surfaces, calm luxury feel, sharp and professional.
Composition: WIDE LANDSCAPE 16:9, cinematic, the treatment space is the clear subject.
STRICT: do NOT add, remove, or alter any text, letters, numbers, logos, or signage. Do NOT add any overlay logo, brand mark, watermark, caption, or text banner anywhere in the frame. Do NOT depict any identifiable human face, any medical procedure being performed on a patient, any needle, blood, or before/after comparison. Photographic realism only.
Article context (for mood only, do not render as text): "${title}" — ${keyword}.`;
}

async function fetchAsBase64(url: string): Promise<{ data: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`source photo ${res.status}`);
  const mime = res.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString('base64'), mime };
}

export type GeneratedImage = { buffer: Buffer; mime: string };

/**
 * Image-to-image: re-scene a real clinic photo, keeping the room itself intact.
 * Returns null on any failure — a missing cover must never block publishing.
 */
export async function generateCover({
  title,
  keyword,
  slug,
}: {
  title: string;
  keyword: string;
  slug: string;
}): Promise<GeneratedImage | null> {
  if (!KEY()) return null;

  try {
    const reference = await fetchAsBase64(`${COMPANY.site}${pickSourcePhoto(slug)}`);
    const prompt = coverPrompt(title, keyword);

    let lastError: unknown;
    for (const model of IMAGE_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY()}`;
      const body = {
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: reference.mime, data: reference.data } },
            ],
          },
        ],
        generationConfig: { imageConfig: { aspectRatio: '16:9' } },
      };

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.status === 404) throw new Error('model-404');
          if (!res.ok) {
            throw new Error(`gemini-image ${res.status}: ${(await res.text()).slice(0, 160)}`);
          }
          const json = await res.json();
          const parts = json?.candidates?.[0]?.content?.parts ?? [];
          const part = parts.find(
            (p: Record<string, unknown>) =>
              (p.inlineData as { data?: string })?.data ||
              (p.inline_data as { data?: string })?.data
          );
          const inline = part?.inlineData ?? part?.inline_data;
          if (!inline?.data) throw new Error('no image part in response');
          return {
            buffer: Buffer.from(inline.data, 'base64'),
            mime: inline.mimeType || inline.mime_type || 'image/png',
          };
        } catch (error) {
          lastError = error;
          // A 404 means this model id does not exist — try the next one instead
          // of burning the remaining retries on it.
          if (error instanceof Error && error.message === 'model-404') break;
          await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('image generation failed');
  } catch (error) {
    console.error(
      `[seo-engine] cover image failed: ${String(error instanceof Error ? error.message : error).slice(0, 200)}`
    );
    return null;
  }
}
