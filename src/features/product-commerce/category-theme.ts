const CATEGORY_THEMES: Record<string, { color: string; bg: string }> = {
  all: { color: '#D4AF37', bg: 'rgba(212,175,55,0.15)' },
  acne: { color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
  lumiera: { color: '#C2185B', bg: 'rgba(194,24,91,0.10)' },
  antiaging: { color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  premium: { color: '#B8860B', bg: 'rgba(184,134,11,0.12)' },
};

const FALLBACK = { color: '#D4AF37', bg: 'rgba(212,175,55,0.15)' };

export function getCategoryColor(catId: string): string {
  return CATEGORY_THEMES[catId]?.color ?? FALLBACK.color;
}

export function getCategoryBG(catId: string): string {
  return CATEGORY_THEMES[catId]?.bg ?? FALLBACK.bg;
}

export function resolveCategoryTheme(catId: string): { color: string; bg: string } {
  return CATEGORY_THEMES[catId] ?? FALLBACK;
}
