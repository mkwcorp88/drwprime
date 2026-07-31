const CATEGORY_THEMES: Record<string, { color: string; bg: string }> = {
  all: { color: '#B8860B', bg: '#fef9c3' },
  acne: { color: '#0D9488', bg: '#ccfbf1' },
  lumiera: { color: '#C2185B', bg: '#fce7f3' },
  antiaging: { color: '#B8860B', bg: '#fef9c3' },
  premium: { color: '#A16207', bg: '#fef9c3' },
};

const FALLBACK = { color: '#B8860B', bg: '#fef9c3' };

export function getCategoryColor(catId: string): string {
  return CATEGORY_THEMES[catId]?.color ?? FALLBACK.color;
}

export function getCategoryBG(catId: string): string {
  return CATEGORY_THEMES[catId]?.bg ?? FALLBACK.bg;
}

export function resolveCategoryTheme(catId: string): { color: string; bg: string } {
  return CATEGORY_THEMES[catId] ?? FALLBACK;
}
