/*
 * CV file handling that doesn't depend on the browser, so it can be unit-tested in Node.
 * The PDF / DOCX libraries are passed in (browser build in the app, Node build in tests).
 */
import { LIMITS } from "./api";

export type FileKind = "pdf" | "docx";
export type FileCheck = { ok: true; kind: FileKind } | { ok: false; reason: "type" | "size" | "legacy_doc" | "empty" };

export function classifyFile(name: string, mime: string, size: number): FileCheck {
  const lower = name.toLowerCase();
  if (size === 0) return { ok: false, reason: "empty" };
  if (size > LIMITS.fileMaxBytes) return { ok: false, reason: "size" };
  if (lower.endsWith(".pdf") || mime === "application/pdf") return { ok: true, kind: "pdf" };
  if (lower.endsWith(".docx") || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return { ok: true, kind: "docx" };
  if (lower.endsWith(".doc") || mime === "application/msword") return { ok: false, reason: "legacy_doc" };
  return { ok: false, reason: "type" };
}

/** Check the file's first bytes, so a renamed file can't pretend to be a PDF or DOCX. */
export function sniff(bytes: Uint8Array): FileKind | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "pdf"; // %PDF-
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "docx"; // ZIP
  return null;
}

/** Tidy extracted text: NFKC folds Arabic presentation forms to normal letters; collapse spacing. */
export function cleanText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/ی/g, "ي") // Persian yeh (some PDF fonts map Arabic yeh to it) -> Arabic yeh
    .replace(/ک/g, "ك") // keheh -> kaf
    .replace(/ھ|ہ/g, "ه") // heh doachashmee / heh goal -> heh
    .replace(/ /g, " ")
    .replace(/[​‎‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Common Arabic words and their letter-reversed forms (what visual-order PDFs produce).
const COMMON_AR = ["في", "من", "على", "إلى", "الى", "جامعة", "خبرة", "مهارات", "شركة", "التعليم", "بكالوريوس", "الخبرات", "المهارات", "عن", "مع"];

/**
 * Some Arabic PDFs store text in visual order or as isolated letters, which comes out scrambled.
 * Heuristics: many reversed common words, or many single Arabic letters separated by spaces.
 */
export function looksScrambled(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => /[؀-ۿ]/.test(w));
  if (words.length < 15) return false;
  const reversed = new Set(COMMON_AR.map((w) => [...w].reverse().join("")));
  const normal = new Set(COMMON_AR);
  let rev = 0;
  let norm = 0;
  let singles = 0;
  for (const w of words) {
    const core = w.replace(/[^؀-ۿ]/g, "");
    if (normal.has(core)) norm++;
    else if (reversed.has(core)) rev++;
    if (core.length === 1) singles++;
  }
  if (rev >= 3 && rev > norm) return true;
  return singles / words.length > 0.35;
}

// ---------- PDF ----------

export interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
}
interface PdfLike {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean; disableFontFace?: boolean; useSystemFonts?: boolean }): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }> }>;
    destroy(): Promise<void>;
  };
}

export async function extractPdfText(data: ArrayBuffer, pdfjs: PdfLike, maxPages = 12): Promise<string> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, disableFontFace: true, useSystemFonts: false });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(layoutLines(content.items as PdfTextItem[]).join("\n"));
    }
    return cleanText(pages.join("\n\n"));
  } finally {
    await task.destroy();
  }
}

interface Box {
  s: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const HAS_AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const HAS_LTR = /[A-Za-z0-9@]/;

/**
 * Rebuild reading-order lines from positioned text items. Many PDFs (including Chrome's) store
 * Arabic as separate glyph clusters in visual order, so items are grouped by baseline, ordered
 * right-to-left on Arabic lines (with embedded English/number runs put back left-to-right), and a
 * space is inserted only where there is a real horizontal gap.
 */
export function layoutLines(items: PdfTextItem[]): string[] {
  const boxes: Box[] = [];
  for (const it of items) {
    if (typeof it.str !== "string" || it.str === "" || !it.transform) continue;
    const [a, b, c, d, e, f] = it.transform;
    const h = it.height || Math.hypot(c, d) || Math.hypot(a, b) || 10;
    boxes.push({ s: it.str, x: e, y: f, w: it.width ?? 0, h });
  }
  boxes.sort((p, q) => q.y - p.y);
  const lines: Box[][] = [];
  for (const bx of boxes) {
    const line = lines.find((l) => Math.abs(l[0].y - bx.y) < Math.max(2, Math.min(l[0].h, bx.h) * 0.45));
    if (line) line.push(bx);
    else lines.push([bx]);
  }
  lines.sort((p, q) => q[0].y - p[0].y);

  // Paragraph direction is a property of the document: an Arabic CV's mixed lines are still RTL.
  const all = boxes.map((b) => b.s).join("");
  const pageRtl = (all.match(AR_G) ?? []).length > (all.match(/[A-Za-z]/g) ?? []).length;

  return lines.map((line) => {
    const rtl = pageRtl && line.some((b) => HAS_AR.test(b.s));
    const ordered = [...line].sort((p, q) => (rtl ? q.x + q.w - (p.x + p.w) : p.x - q.x));
    // Runs of the other direction go back into reading order (Unicode bidi: a run is opened by a
    // strong letter; digits after it join it, digits on their own don't).
    const inRun = new Set<Box>();
    const opens = rtl ? (b: Box) => LATIN.test(b.s) && !HAS_AR.test(b.s) : (b: Box) => HAS_AR.test(b.s);
    const continues = rtl ? (b: Box) => !HAS_AR.test(b.s) : (b: Box) => !LATIN.test(b.s);
    const strong = rtl ? (b: Box) => HAS_LTR.test(b.s) : (b: Box) => HAS_AR.test(b.s) || /[0-9]/.test(b.s);
    for (let i = 0; i < ordered.length; ) {
      if (opens(ordered[i])) {
        let j = i;
        while (j + 1 < ordered.length && continues(ordered[j + 1])) j++;
        while (j > i && !strong(ordered[j])) j--; // leave trailing punctuation outside the run
        const run = ordered.slice(i, j + 1).reverse();
        ordered.splice(i, run.length, ...run);
        run.forEach((b) => inRun.add(b));
        i = j + 1;
      } else i++;
    }
    // Text laid out right-to-left stores mirrored bracket glyphs: swap them back.
    for (const b of ordered) {
      const rtlText = rtl ? !inRun.has(b) : inRun.has(b);
      if (rtlText) b.s = b.s.replace(/[()[\]{}]/g, (ch) => MIRROR[ch] ?? ch);
    }
    let out = "";
    ordered.forEach((b, k) => {
      if (k > 0) {
        const p = ordered[k - 1];
        const gap = Math.max(p.x, b.x) - Math.min(p.x + p.w, b.x + b.w);
        const joinsMark = MARK_START.test(b.s);
        if (!joinsMark && gap > Math.max(0.8, Math.min(p.h, b.h) * 0.18) && !out.endsWith(" ") && !b.s.startsWith(" ")) out += " ";
      }
      out += b.s;
    });
    return out.replace(/ +([ً-ٰٟ])/g, "$1");
  });
}

const AR_G = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-ﻼ]/g;
const LATIN = /[A-Za-z]/;
const MARK_START = /^[ً-ٰٟ]/; // Arabic diacritics attach to the previous letter
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{" };

// ---------- DOCX ----------

interface MammothLike {
  extractRawText(input: { arrayBuffer: ArrayBuffer } | { buffer: Uint8Array }): Promise<{ value: string }>;
}

export async function extractDocxText(data: ArrayBuffer, mammoth: MammothLike, node = false): Promise<string> {
  const r = await mammoth.extractRawText(node ? { buffer: new Uint8Array(data) } : { arrayBuffer: data });
  return cleanText(r.value);
}
