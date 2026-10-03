// Text helpers shared by the verifier, the parser and the renderers. Pure functions, no DOM.

const ARABIC_INDIC = /[٠-٩]/g; // ٠-٩
const EXT_ARABIC_INDIC = /[۰-۹]/g; // ۰-۹ (Persian/Urdu)
const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

/** Convert Arabic-Indic digits and separators to ASCII so "٣٫٥" and "3.5" compare equal. */
export function normalizeDigits(s: string): string {
  return s
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXT_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".") // Arabic decimal separator
    .replace(/٬/g, ","); // Arabic thousands separator
}

/** Loose form for matching names/skills: lower case, no Arabic diacritics, unified letter variants, no punctuation. */
export function looseText(s: string): string {
  return normalizeDigits(s.normalize("NFKC"))
    .toLowerCase()
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}+#.\s]/gu, " ")
    .replace(/(?<!\p{L})\.|\.(?!\p{L})/gu, " ") // keep dots inside words like node.js
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "and", "or", "of", "the", "a", "an", "in", "at", "for", "to", "with", "on", "by", "from",
  "و", "في", "من", "الى", "على", "عن", "مع", "ال",
]);

export function tokens(s: string): string[] {
  return looseText(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Placeholder syntax used everywhere: [[confirm: GPA]] / [[أكمل: المعدل]]. */
export const PLACEHOLDER_RE = /\[\[([^[\]]{1,160})\]\]/g;

export function findPlaceholders(s: string): string[] {
  return [...s.matchAll(PLACEHOLDER_RE)].map((m) => m[1].trim());
}

export function stripPlaceholders(s: string): string {
  return s.replace(PLACEHOLDER_RE, " ");
}

/**
 * Numbers in a sentence, canonicalised ("1,200" -> "1200", "٣٫٥" -> "3.5", "3.50" -> "3.5").
 * Placeholders are ignored. Single digits 0-9 are ignored when written as words are not; digits are kept.
 */
export function extractNumbers(s: string): string[] {
  const clean = normalizeDigits(stripPlaceholders(s));
  const out: string[] = [];
  for (const m of clean.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    out.push(canonicalNumber(m[0]));
  }
  return out;
}

export function canonicalNumber(raw: string): string {
  const noThousands = raw.replace(/,/g, "");
  const n = Number(noThousands);
  return Number.isFinite(n) ? String(n) : noThousands;
}

/** Does `needle` appear in `haystack`, ignoring case, diacritics and punctuation? Falls back to token overlap. */
export function appearsIn(needle: string, haystack: string, minOverlap = 0.6): boolean {
  const n = looseText(needle);
  const h = looseText(haystack);
  if (!n) return true;
  if (h.includes(n)) return true;
  const nt = tokens(needle);
  if (nt.length === 0) return false;
  const hs = new Set(tokens(haystack));
  const hit = nt.filter((t) => hs.has(t) || [...hs].some((x) => x.length >= 4 && t.length >= 4 && (x.startsWith(t) || t.startsWith(x)))).length;
  return hit / nt.length >= minOverlap;
}

export function wordCount(s: string): number {
  return stripPlaceholders(s).trim().split(/\s+/).filter(Boolean).length;
}

/** Detect the dominant script of a text. */
export function detectLang(s: string): "ar" | "en" {
  const ar = (s.match(/[؀-ۿ]/g) ?? []).length;
  const la = (s.match(/[A-Za-z]/g) ?? []).length;
  return ar > la ? "ar" : "en";
}
