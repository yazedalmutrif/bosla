// Browser side of CV reading. The heavy libraries load only when a file is chosen.
import { classifyFile, extractDocxText, extractPdfText, looksScrambled, sniff } from "../../shared/cvfile";

export type ParseOutcome =
  | { ok: true; text: string; warning: "scrambled" | "short" | null }
  | { ok: false; reason: "type" | "size" | "legacy_doc" | "empty" | "read" };

export async function parseCvFile(file: File): Promise<ParseOutcome> {
  const check = classifyFile(file.name, file.type, file.size);
  if (!check.ok) return { ok: false, reason: check.reason };
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { ok: false, reason: "read" };
  }
  const kind = sniff(new Uint8Array(buf.slice(0, 8)));
  if (kind !== check.kind) return { ok: false, reason: kind ? "read" : "type" };

  let text: string;
  try {
    if (kind === "pdf") {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      text = await extractPdfText(buf, pdfjs as unknown as Parameters<typeof extractPdfText>[1]);
    } else {
      const mammoth = await import("mammoth");
      text = await extractDocxText(buf, (mammoth.default ?? mammoth) as unknown as Parameters<typeof extractDocxText>[1]);
    }
  } catch {
    return { ok: false, reason: "read" };
  }
  if (!text.trim()) return { ok: false, reason: "empty" };
  return { ok: true, text, warning: looksScrambled(text) ? "scrambled" : text.length < 400 ? "short" : null };
}
