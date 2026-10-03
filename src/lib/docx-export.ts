/*
 * Word export, built in the browser (nothing leaves the device).
 * Arabic: paragraphs are bidirectional, Arabic runs are right-to-left with a complex-script font,
 * so Word lays them out RTL. Placeholders are highlighted so they can't be missed.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HighlightColor,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import type { MapResponse } from "../../shared/api";
import type { Claim, Lang, TailorDraft } from "../../shared/schemas";
import { claimStatus } from "../../shared/verify";
import type { Dict } from "../i18n/en";

const AR_RE = /[؀-ۿ]/;
const AR_COMMA = "، ";
const DOT = " · ";
const FONT = { ascii: "Calibri", hAnsi: "Calibri", cs: "Arial", eastAsia: "Calibri" };

interface Opt {
  lang: Lang;
}

function runs(text: string, o: Opt, style: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}): TextRun[] {
  const size = style.size ?? 21;
  const parts = text.split(/(\[\[[^[\]]{1,160}\]\])/g).filter((p) => p !== "");
  return parts.map((p) => {
    const isPh = p.startsWith("[[") && p.endsWith("]]");
    const t = isPh ? `[${p.slice(2, -2).trim()}]` : p;
    return new TextRun({
      text: t,
      bold: style.bold,
      boldComplexScript: style.bold,
      italics: style.italics,
      size,
      sizeComplexScript: size,
      color: style.color,
      font: FONT,
      rightToLeft: o.lang === "ar" && AR_RE.test(t),
      highlight: isPh ? HighlightColor.YELLOW : undefined,
      language: { value: "en-US", bidirectional: "ar-SA" },
    });
  });
}

function para(children: ParagraphChild[], o: Opt, extra: Partial<ConstructorParameters<typeof Paragraph>[0] & object> = {}): Paragraph {
  return new Paragraph({
    children,
    bidirectional: o.lang === "ar",
    alignment: AlignmentType.START,
    spacing: { after: 60, line: 264 },
    ...extra,
  });
}

function heading(text: string, o: Opt): Paragraph {
  return para(runs(text, o, { bold: true, size: 23, color: "14305A" }), o, {
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C9C4B8", space: 2 } },
    keepNext: true,
  });
}

function bullet(text: string, o: Opt): Paragraph {
  return para(runs(text, o), o, { bullet: { level: 0 }, spacing: { after: 40, line: 259 } });
}

function link(url: string): ExternalHyperlink {
  return new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, style: "Hyperlink", size: 19, font: FONT })] });
}

const live = (cs: Claim[]) => cs.filter((c) => claimStatus(c) !== "removed");
const listSep = (o: Opt) => (o.lang === "ar" ? AR_COMMA : ", ");

function makeDoc(children: Array<Paragraph | Table>, title: string): Document {
  return new Document({
    creator: "Bosla",
    title,
    styles: { default: { document: { run: { font: FONT, size: 21, sizeComplexScript: 21 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 820, right: 820 } } },
        children,
      },
    ],
  });
}

// ---------------- CV ----------------

export async function cvDocx(d: TailorDraft, t: Dict): Promise<Blob> {
  const o: Opt = { lang: d.outputLanguage };
  const cv = d.cv;
  const L = labelsFor(d.outputLanguage, t);
  const out: Paragraph[] = [];

  out.push(para(runs(cv.name, o, { bold: true, size: 36, color: "0F1A2E" }), o, { alignment: AlignmentType.CENTER, spacing: { after: 20 } }));
  out.push(para(runs(cv.headline, o, { size: 23, color: "1B3D70" }), o, { alignment: AlignmentType.CENTER, spacing: { after: 40 } }));
  // Location (often an Arabic placeholder) on its own line, so bidi reordering can't glue it to a URL.
  if (cv.location) out.push(para(runs(cv.location, o, { size: 19, color: "4D5667" }), o, { alignment: AlignmentType.CENTER, spacing: { after: 10 } }));
  out.push(para(runs(cv.contact.join("  |  "), o, { size: 19, color: "4D5667" }), o, { alignment: AlignmentType.CENTER, spacing: { after: 120 } }));

  const summary = live(cv.summary);
  if (summary.length) {
    out.push(heading(L.summary, o));
    out.push(para(runs(summary.map((c) => c.text).join(" "), o), o));
  }
  if (cv.skills.length) {
    out.push(heading(L.skills, o));
    for (const g of cv.skills) {
      out.push(para([...runs(`${g.group}: `, o, { bold: true }), ...runs(g.items.join(listSep(o)), o)], o, { spacing: { after: 40 } }));
    }
  }
  if (cv.experience.length) {
    out.push(heading(L.experience, o));
    for (const e of cv.experience) {
      out.push(entryLine([e.role, e.org, e.location].filter(Boolean).join(listSep(o)), e.dates, o));
      for (const b of live(e.bullets)) out.push(bullet(b.text, o));
    }
  }
  if (cv.projects.length) {
    out.push(heading(L.projects, o));
    for (const p of cv.projects) {
      out.push(entryLine([p.name, p.context].filter(Boolean).join(DOT), p.dates, o));
      for (const b of live(p.bullets)) out.push(bullet(b.text, o));
    }
  }
  if (cv.education.length) {
    out.push(heading(L.education, o));
    for (const e of cv.education) {
      out.push(entryLine([e.degree, e.institution].join(listSep(o)), e.dates, o));
      for (const b of live(e.details)) out.push(bullet(b.text, o));
    }
  }
  if (cv.certifications.length) {
    out.push(heading(L.certifications, o));
    for (const c of cv.certifications) out.push(bullet([c.name, c.issuer, c.date].filter(Boolean).join(listSep(o)), o));
  }
  const langs = live(cv.languages);
  if (langs.length) {
    out.push(heading(L.languages, o));
    out.push(para(runs(langs.map((c) => c.text).join(listSep(o)), o), o));
  }
  return Packer.toBlob(makeDoc(out, `CV - ${cv.name}`));
}

// A4 width (11906 twips) minus the 820-twip side margins.
const TEXT_WIDTH = 11906 - 2 * 820;

/** Title, then the dates pushed to the far edge by an end-aligned tab (left edge in Arabic, right in English). */
function entryLine(title: string, dates: string | null, o: Opt): Paragraph {
  const children: ParagraphChild[] = [...runs(title, o, { bold: true })];
  if (dates) children.push(new TextRun({ children: [new Tab()] }), ...runs(dates, o, { color: "4D5667" }));
  return para(children, o, { spacing: { before: 80, after: 40 }, keepNext: true, tabStops: [{ type: TabStopType.END, position: TEXT_WIDTH }] });
}

// ---------------- cover letter ----------------

export async function letterDocx(d: TailorDraft): Promise<Blob> {
  const o: Opt = { lang: d.outputLanguage };
  const L = d.coverLetter;
  const out: Paragraph[] = [];
  out.push(para(runs(d.cv.name, o, { bold: true, size: 28, color: "0F1A2E" }), o, { spacing: { after: 20 } }));
  out.push(para(runs(d.cv.contact.join("  |  "), o, { size: 19, color: "4D5667" }), o, { spacing: { after: 360 } }));
  out.push(para(runs(L.greeting, o), o, { spacing: { after: 200 } }));
  for (const p of live(L.paragraphs)) out.push(para(runs(p.text, o), o, { spacing: { after: 200, line: 288 } }));
  out.push(para(runs(L.closing, o), o, { spacing: { before: 120, after: 60 } }));
  out.push(para(runs(L.signature, o, { bold: true }), o));
  return Packer.toBlob(makeDoc(out, `Cover letter - ${d.cv.name}`));
}

// ---------------- job map ----------------

export async function mapDocx(r: MapResponse, t: Dict): Promise<Blob> {
  const lang = r.draft.outputLanguage;
  const o: Opt = { lang };
  const L = labelsFor(lang, t);
  const R = t.result;
  const d = r.draft;
  const out: Array<Paragraph | Table> = [];
  const fmt = (x: number) => x.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en");

  out.push(para(runs(L.mapTitle, o, { bold: true, size: 36, color: "0F1A2E" }), o, { spacing: { after: 120 } }));
  out.push(heading(R.profile, o));
  out.push(para(runs(live(d.profile.summary).map((c) => c.text).join(" "), o), o));
  if (claimStatus(d.keyAlert) !== "removed") {
    out.push(para([...runs(`${R.keyAlert}: `, o, { bold: true, color: "7F4D00" }), ...runs(d.keyAlert.text, o)], o, { spacing: { before: 80, after: 80 } }));
  }

  out.push(heading(R.titles, o));
  d.titles.forEach((x, i) => out.push(para([...runs(`${i + 1}. ${x.title}`, { lang: "en" }, { bold: true }), ...runs(`  (${x.gloss})`, o, { color: "4D5667" })], o, { spacing: { after: 40 } })));

  out.push(heading(R.companies, o));
  for (const c of d.companies) {
    const co = r.companies.find((x) => x.id === c.companyId);
    if (!co) continue;
    const cities = co.cities.map((id) => r.cities.find((ci) => ci.id === id)?.[lang] ?? id).join(listSep(o));
    out.push(para([...runs(co.name[lang], o, { bold: true, size: 22 }), ...runs(`  ${cities}${DOT}${R.priority[c.priority]}`, o, { color: "4D5667" })], o, { spacing: { before: 120, after: 20 }, keepNext: true }));
    if (claimStatus(c.fit) !== "removed") out.push(para(runs(c.fit.text, o), o, { spacing: { after: 20 } }));
    if (co.salary) out.push(para(runs(`${R.estSalary} (${R.estimateBadge}): ${fmt(co.salary.min)} - ${fmt(co.salary.max)} ${R.perMonth}`, o, { color: "4D5667", size: 19 }), o, { spacing: { after: 20 } }));
    out.push(para([link(co.careersUrl), ...runs(`   ${R.dataAsOf(co.asOf)}`, o, { color: "5F6675", size: 18 })], o));
  }

  if (r.salaryRows.length) {
    out.push(heading(R.salaryTable, o));
    out.push(salaryTable(r, o, R, fmt));
  }
  if (r.programs.length) {
    out.push(heading(R.programs, o));
    for (const p of r.programs) {
      out.push(para([...runs(p.name[lang], o, { bold: true }), ...runs(p.deadline ? `${DOT}${R.deadline(p.deadline)}` : "", o, { color: "4D5667" })], o, { spacing: { before: 80, after: 20 } }));
      out.push(para(runs(p.requirements[lang], o, { size: 19 }), o, { spacing: { after: 20 } }));
      out.push(para([link(p.url)], o));
    }
  }
  out.push(heading(R.platforms, o));
  for (const p of r.platforms) {
    out.push(para([...runs(`${p.name[lang]}: `, o, { bold: true }), ...runs(p.goodFor[lang] + "  ", o), link(p.url)], o, { spacing: { after: 40 } }));
  }
  out.push(heading(R.fixes, o));
  d.cvFixes.forEach((f, i) => {
    if (claimStatus(f.detail) === "removed") return;
    out.push(para(runs(`${i + 1}. ${f.title}`, o, { bold: true }), o, { spacing: { before: 60, after: 20 }, keepNext: true }));
    out.push(para(runs(f.detail.text, o), o));
  });
  out.push(heading(R.sourcesTitle, o));
  out.push(para(runs(`${r.salaryDisclaimer[lang]} ${R.compiled(r.compiledOn)}`, o, { size: 18, color: "4D5667" }), o));
  for (const s of r.sources) out.push(para(runs(`${s.id}: ${s.title} (${s.date})`, { lang: "en" }, { size: 18, color: "4D5667" }), o, { spacing: { after: 20 } }));

  return Packer.toBlob(makeDoc(out, L.mapTitle));
}

function salaryTable(r: MapResponse, o: Opt, R: Dict["result"], fmt: (x: number) => string): Table {
  const lang = o.lang;
  const cell = (text: string, bold = false) =>
    new TableCell({
      children: [para(runs(text, o, { bold, size: 19 }), o, { spacing: { after: 20 } })],
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    });
  const header = new TableRow({
    tableHeader: true,
    children: [cell(R.segment, true), cell(R.start, true), cell(R.later(r.salaryRows.find((x) => x.later)?.later?.afterYears ?? 3), true), cell(R.note, true)],
  });
  const rows = r.salaryRows.map(
    (x) =>
      new TableRow({
        children: [
          cell(x.segment[lang]),
          cell(`${fmt(x.start.min)}${x.start.max !== x.start.min ? ` - ${fmt(x.start.max)}` : ""}`),
          cell(x.later ? `${fmt(x.later.min)} - ${fmt(x.later.max)}` : "-"),
          cell(x.note?.[lang] ?? ""),
        ],
      }),
  );
  return new Table({ rows: [header, ...rows], width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: lang === "ar" });
}

function labelsFor(lang: Lang, t: Dict) {
  // Section headings follow the document's language (t is the dictionary for that language).
  const R = t.result;
  return {
    summary: R.summary,
    skills: R.skills,
    experience: R.experience,
    projects: R.projects,
    education: R.education,
    certifications: R.certifications,
    languages: R.languages,
    mapTitle: lang === "ar" ? "خارطة البحث الوظيفي" : R.mapTitle,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
