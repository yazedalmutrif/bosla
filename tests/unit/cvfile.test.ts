import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Document, Packer, Paragraph, TextRun } from "docx";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { classifyFile, cleanText, extractDocxText, extractPdfText, looksScrambled, sniff } from "../../shared/cvfile";
import { SAMPLE_CV_AR, SAMPLE_CV_EN } from "../../shared/samples";

const ab = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("classifyFile", () => {
  it("accepts PDF and DOCX by extension or MIME type", () => {
    expect(classifyFile("cv.pdf", "", 1000)).toEqual({ ok: true, kind: "pdf" });
    expect(classifyFile("CV.DOCX", "", 1000)).toEqual({ ok: true, kind: "docx" });
    expect(classifyFile("x", "application/pdf", 1000)).toEqual({ ok: true, kind: "pdf" });
  });
  it("rejects old .doc, other types, empty and oversized files", () => {
    expect(classifyFile("cv.doc", "", 1000)).toEqual({ ok: false, reason: "legacy_doc" });
    expect(classifyFile("cv.txt", "text/plain", 1000)).toEqual({ ok: false, reason: "type" });
    expect(classifyFile("cv.pdf", "", 0)).toEqual({ ok: false, reason: "empty" });
    expect(classifyFile("cv.pdf", "", 6 * 1024 * 1024)).toEqual({ ok: false, reason: "size" });
  });
});

describe("sniff", () => {
  it("detects real PDF and ZIP headers, rejects others", () => {
    expect(sniff(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(sniff(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))).toBe("docx");
    expect(sniff(new TextEncoder().encode("<html>"))).toBeNull();
  });
});

describe("cleanText", () => {
  it("folds Arabic presentation forms and strips bidi controls", () => {
    // U+FEE3 U+FEE8 = presentation forms of meem and noon
    expect(cleanText("ﻣﻨ ‏test‫  x\n\n\n\ny")).toBe("من test x\n\ny");
  });
});

describe("looksScrambled", () => {
  it("passes normal Arabic text", () => {
    expect(looksScrambled(SAMPLE_CV_AR)).toBe(false);
  });
  it("flags letter-reversed Arabic (visual-order PDFs)", () => {
    const reversed = SAMPLE_CV_AR.split(/\s+/)
      .map((w) => [...w].reverse().join(""))
      .join(" ");
    expect(looksScrambled(reversed)).toBe(true);
  });
  it("flags text broken into single letters", () => {
    const singles = [..."جامعة الملك عبدالعزيز خبرة في الدعم الفني والبيانات والتحليل"].filter((c) => c.trim()).join(" ");
    expect(looksScrambled(singles)).toBe(true);
  });
  it("ignores English text", () => {
    expect(looksScrambled(SAMPLE_CV_EN)).toBe(false);
  });
});

describe("extractDocxText", () => {
  it("reads Arabic and English paragraphs from a real DOCX", async () => {
    const doc = new Document({
      sections: [{ children: [...SAMPLE_CV_EN.split("\n"), ...SAMPLE_CV_AR.split("\n")].map((l) => new Paragraph({ children: [new TextRun(l)] })) }],
    });
    const buf = await Packer.toBuffer(doc);
    const text = await extractDocxText(ab(buf), mammoth as never, true);
    expect(text).toContain("King Abdulaziz University");
    expect(text).toContain("جامعة الملك عبدالعزيز");
    expect(text).toContain("50,000");
  });
});

describe("extractPdfText", () => {
  it("reads an Arabic PDF printed by Chrome (fixture from the e2e run)", async () => {
    const buf = readFileSync("tests/fixtures/sample-ar.pdf");
    const text = await extractPdfText(ab(buf), pdfjs as never);
    expect(text).toContain("جامعة الملك عبدالعزيز");
    expect(looksScrambled(text)).toBe(false);
  });
});
