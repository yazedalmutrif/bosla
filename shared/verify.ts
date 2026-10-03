/*
 * Verification pass. Every sentence about the person must be backed by the fact sheet
 * extracted from their own CV. This module is deterministic and runs on every result
 * (after the optional LLM judge), so it is the final gate before anything reaches the user.
 *
 * Policy:
 *  - LLM verdict "unsupported"          -> claim removed (listed in the report)
 *  - LLM verdict "partly" + fixedText   -> claim rewritten, original kept for the report
 *  - unknown fact ids                   -> dropped from the claim
 *  - number not found in the facts      -> replaced by a visible [[confirm: N]] placeholder
 *  - any placeholder                    -> status "needs_input" + entry in the needs-input list
 *  - employer / institution / certificate not in the facts -> whole entry removed
 *  - skill not in the facts             -> skill removed
 */
import type { Claim, FactSheet, Gap, Lang, MapDraft, TailorDraft, Verdict } from "./schemas";
import { appearsIn, extractNumbers, findPlaceholders, looseText, stripPlaceholders, wordCount } from "./text";

export type ClaimStatus = "verified" | "needs_input" | "removed";

export interface VerifiedClaim extends Claim {
  status?: ClaimStatus;
  issues?: string[];
  original?: string;
}

export interface ReportItem {
  path: string;
  text: string;
  status: Exclude<ClaimStatus, "verified">;
  reason: ReportReason;
  detail?: string;
  original?: string;
}

export type ReportReason =
  | "llm_unsupported"
  | "llm_rewritten"
  | "number_not_in_cv"
  | "unknown_fact"
  | "placeholder"
  | "org_not_in_cv"
  | "skill_not_in_cv"
  | "cert_not_in_cv"
  | "keyword_not_in_cv"
  | "over_word_limit";

export interface VerificationReport {
  checkedClaims: number;
  verified: number;
  needsInput: number;
  removed: number;
  llmPass: boolean;
  items: ReportItem[];
}

export const PLACEHOLDER_LABEL: Record<Lang, string> = { en: "confirm", ar: "تأكد" };

export function claimStatus(c: Claim): ClaimStatus {
  return (c as VerifiedClaim).status ?? "verified";
}

// ---------------- fact index ----------------

export class FactIndex {
  readonly byId = new Map<string, string>();
  readonly allText: string;
  readonly allNumbers: Set<string>;

  constructor(sheet: FactSheet) {
    for (const f of sheet.facts) {
      this.byId.set(f.id, [f.text, f.org, f.role, f.start, f.end, f.alt].filter(Boolean).join(" | "));
    }
    const person = sheet.person;
    const personText = [person.name, person.email, person.phone, person.location, ...person.links, sheet.headline]
      .filter(Boolean)
      .join(" | ");
    this.allText = [...this.byId.values(), personText].join("\n");
    this.allNumbers = new Set(extractNumbers(this.allText));
  }

  text(ids: string[]): string {
    return ids.map((id) => this.byId.get(id) ?? "").join("\n");
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }
}

// ---------------- single claim ----------------

export interface ClaimCheck {
  unknownIds: string[];
  unsupportedNumbers: string[];
  placeholders: string[];
}

/** Check one claim against the facts. `extraNumberSources` lets posting numbers through (e.g. in the cover letter). */
export function checkClaim(claim: Claim, idx: FactIndex, extraNumberSources: string[] = []): ClaimCheck {
  const unknownIds = claim.factIds.filter((id) => !idx.has(id));
  const known = claim.factIds.filter((id) => idx.has(id));
  const cited = new Set(extractNumbers(idx.text(known)));
  const extra = new Set(extraNumberSources.flatMap((s) => extractNumbers(s)));
  const unsupportedNumbers = extractNumbers(claim.text).filter(
    (n) => !cited.has(n) && !idx.allNumbers.has(n) && !extra.has(n),
  );
  return { unknownIds, unsupportedNumbers: [...new Set(unsupportedNumbers)], placeholders: findPlaceholders(claim.text) };
}

/** Replace unsupported numbers with visible placeholders. Works on ASCII and Arabic-Indic digits. */
export function neutralizeNumbers(text: string, numbers: string[], lang: Lang): string {
  if (numbers.length === 0) return text;
  const label = PLACEHOLDER_LABEL[lang];
  const wanted = new Set(numbers);
  // Walk the text outside placeholders, replacing number tokens whose canonical form is unsupported.
  return text.replace(/(\[\[[^[\]]*\]\])|([\d٠-٩۰-۹]+(?:[.,٫٬][\d٠-٩۰-۹]+)*%?)/g, (m, ph: string | undefined) => {
    if (ph) return m;
    const [canon] = extractNumbers(m.replace("%", ""));
    return canon !== undefined && wanted.has(canon) ? `[[${label}: ${m}]]` : m;
  });
}

// ---------------- applying verdicts + checks ----------------

interface Ctx {
  idx: FactIndex;
  lang: Lang;
  verdicts: Map<string, Verdict>;
  report: VerificationReport;
  needs: Gap[];
  extraNumbers: string[];
  /** Posting keywords that must not appear in a claim unless the fact sheet has them. */
  keywords?: string[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Posting keywords used in the claim that the person's facts don't support. */
export function unsupportedKeywords(text: string, keywords: string[], idx: FactIndex): string[] {
  const hay = ` ${looseText(stripPlaceholders(text))} `;
  return keywords.filter((k) => {
    const lk = looseText(k);
    return lk.length >= 2 && hay.includes(` ${lk} `) && !appearsIn(k, idx.allText, 1);
  });
}

/** Wrap each unsupported keyword in a visible placeholder (first occurrence, outside existing placeholders). */
export function flagKeywords(text: string, kws: string[], lang: Lang): string {
  let out = text;
  for (const k of kws) {
    const re = new RegExp(`(\\[\\[[^[\\]]*\\]\\])|(?<![\\p{L}\\p{N}])(${escapeRe(k)})(?![\\p{L}\\p{N}])`, "iu");
    let done = false;
    out = out.replace(new RegExp(re.source, "giu"), (m, ph: string | undefined, word: string | undefined) => {
      if (ph || done || !word) return m;
      done = true;
      return `[[${PLACEHOLDER_LABEL[lang]}: ${word}]]`;
    });
    if (!done) out = `${out} [[${PLACEHOLDER_LABEL[lang]}: ${k}]]`;
  }
  return out;
}

function processClaim(path: string, claim: Claim, ctx: Ctx, allowNoFacts = true): void {
  const c = claim as VerifiedClaim;
  c.issues = [];
  ctx.report.checkedClaims++;

  const v = ctx.verdicts.get(path);
  if (v?.verdict === "unsupported") {
    c.status = "removed";
    c.issues.push("llm_unsupported");
    ctx.report.items.push({ path, text: c.text, status: "removed", reason: "llm_unsupported", detail: v.problem ?? undefined });
    ctx.report.removed++;
    return;
  }
  if (v?.verdict === "partly" && v.fixedText && v.fixedText.trim()) {
    c.original = c.text;
    c.text = v.fixedText.trim();
    c.issues.push("llm_rewritten");
    ctx.report.items.push({
      path,
      text: c.text,
      status: "needs_input",
      reason: "llm_rewritten",
      detail: v.problem ?? undefined,
      original: c.original,
    });
  }

  const chk = checkClaim(c, ctx.idx, ctx.extraNumbers);
  if (chk.unknownIds.length) {
    c.factIds = c.factIds.filter((id) => ctx.idx.has(id));
    c.issues.push("unknown_fact");
  }
  // In CV sections every sentence is about the person, so one that cites no fact is not trusted.
  if (!allowNoFacts && c.factIds.length === 0 && stripPlaceholders(c.text).trim() !== "") {
    c.status = "removed";
    c.issues.push("unknown_fact");
    ctx.report.items.push({ path, text: c.text, status: "removed", reason: "unknown_fact" });
    ctx.report.removed++;
    return;
  }
  if (chk.unsupportedNumbers.length) {
    c.text = neutralizeNumbers(c.text, chk.unsupportedNumbers, ctx.lang);
    c.issues.push("number_not_in_cv");
    ctx.report.items.push({ path, text: c.text, status: "needs_input", reason: "number_not_in_cv", detail: chk.unsupportedNumbers.join(", ") });
  }
  if (ctx.keywords?.length) {
    const kws = unsupportedKeywords(c.text, ctx.keywords, ctx.idx);
    if (kws.length) {
      c.text = flagKeywords(c.text, kws, ctx.lang);
      c.issues.push("keyword_not_in_cv");
      ctx.report.items.push({ path, text: c.text, status: "needs_input", reason: "keyword_not_in_cv", detail: kws.join(", ") });
    }
  }
  const ph = findPlaceholders(c.text);
  if (ph.length) {
    c.status = "needs_input";
    if (!chk.unsupportedNumbers.length && !c.issues.includes("llm_rewritten") && !c.issues.includes("keyword_not_in_cv")) {
      ctx.report.items.push({ path, text: c.text, status: "needs_input", reason: "placeholder" });
    }
    for (const p of ph) addNeed(ctx, p, c.text);
    ctx.report.needsInput++;
  } else {
    c.status = "verified";
    ctx.report.verified++;
  }
}

function addNeed(ctx: Ctx, item: string, context: string): void {
  const clean = item.replace(/^(confirm|تأكد|أكمل|add|fill in)\s*:\s*/i, "").trim();
  if (ctx.needs.some((n) => n.item === clean)) return;
  ctx.needs.push({ item: clean, why: context.length > 140 ? context.slice(0, 137) + "..." : context });
}

function newCtx(sheet: FactSheet, lang: Lang, verdicts: Verdict[] | null, extraNumbers: string[]): Ctx {
  return {
    idx: new FactIndex(sheet),
    lang,
    verdicts: new Map((verdicts ?? []).map((v) => [v.id, v])),
    report: { checkedClaims: 0, verified: 0, needsInput: 0, removed: 0, llmPass: verdicts !== null, items: [] },
    needs: [],
    extraNumbers,
  };
}

function mergeNeeds(existing: Gap[], added: Gap[]): Gap[] {
  const out = [...existing];
  for (const n of added) if (!out.some((o) => o.item === n.item)) out.push(n);
  return out;
}

// ---------------- claim collection (ids sent to the LLM judge) ----------------

export interface ClaimRef {
  path: string;
  claim: Claim;
}

export function collectTailorClaims(d: TailorDraft): ClaimRef[] {
  const out: ClaimRef[] = [{ path: "leadWith", claim: d.leadWith }];
  d.fit.forEach((f, i) => out.push({ path: `fit.${i}.evidence`, claim: f.evidence }));
  d.cv.summary.forEach((c, i) => out.push({ path: `cv.summary.${i}`, claim: c }));
  d.cv.experience.forEach((e, i) => e.bullets.forEach((c, j) => out.push({ path: `cv.experience.${i}.bullets.${j}`, claim: c })));
  d.cv.projects.forEach((p, i) => p.bullets.forEach((c, j) => out.push({ path: `cv.projects.${i}.bullets.${j}`, claim: c })));
  d.cv.education.forEach((e, i) => e.details.forEach((c, j) => out.push({ path: `cv.education.${i}.details.${j}`, claim: c })));
  d.cv.languages.forEach((c, i) => out.push({ path: `cv.languages.${i}`, claim: c }));
  d.coverLetter.paragraphs.forEach((c, i) => out.push({ path: `coverLetter.paragraphs.${i}`, claim: c }));
  return out;
}

export function collectMapClaims(d: MapDraft): ClaimRef[] {
  const out: ClaimRef[] = [];
  d.profile.summary.forEach((c, i) => out.push({ path: `profile.summary.${i}`, claim: c }));
  out.push({ path: "keyAlert", claim: d.keyAlert });
  d.titles.forEach((t, i) => out.push({ path: `titles.${i}.why`, claim: t.why }));
  d.companies.forEach((c, i) => out.push({ path: `companies.${i}.fit`, claim: c.fit }));
  d.cvFixes.forEach((f, i) => out.push({ path: `cvFixes.${i}.detail`, claim: f.detail }));
  return out;
}

// ---------------- tailored CV ----------------

export const COVER_LETTER_MAX_WORDS = 350;

export function verifyTailor(
  draft: TailorDraft,
  sheet: FactSheet,
  postingText: string,
  verdicts: Verdict[] | null,
): { result: TailorDraft; report: VerificationReport } {
  const lang = draft.outputLanguage;
  // Numbers quoted from the posting (e.g. "3 years") may appear in the fit table and cover letter.
  const ctx = newCtx(sheet, lang, verdicts, []);
  const postingCtx = { ...ctx, extraNumbers: [postingText] };
  // CV sentences may only use a posting keyword if the person's facts contain it.
  const cvCtx: Ctx = { ...ctx, keywords: draft.posting.keywords };
  const idx = ctx.idx;

  processClaim("leadWith", draft.leadWith, postingCtx);
  draft.fit.forEach((f, i) => {
    if (f.evidence.text.trim()) processClaim(`fit.${i}.evidence`, f.evidence, ctx);
    else (f.evidence as VerifiedClaim).status = "verified";
  });

  const cv = draft.cv;
  if (sheet.person.name) cv.name = sheet.person.name;
  cv.contact = cv.contact.filter((c, i) => {
    if (appearsIn(c, idx.allText, 0.8)) return true;
    ctx.report.items.push({ path: `cv.contact.${i}`, text: c, status: "removed", reason: "unknown_fact" });
    ctx.report.removed++;
    return false;
  });
  cv.headline = checkLine(cv.headline, idx, lang, ctx, "cv.headline") ?? "";
  const headKws = unsupportedKeywords(cv.headline, draft.posting.keywords, idx);
  if (headKws.length) {
    cv.headline = flagKeywords(cv.headline, headKws, lang);
    ctx.report.items.push({ path: "cv.headline", text: cv.headline, status: "needs_input", reason: "keyword_not_in_cv", detail: headKws.join(", ") });
    for (const p of findPlaceholders(cv.headline)) addNeed(ctx, p, cv.headline);
  }
  cv.location = checkLine(cv.location, idx, lang, ctx, "cv.location");
  cv.summary.forEach((c, i) => processClaim(`cv.summary.${i}`, c, cvCtx, false));

  // Employers: must exist in the facts, otherwise the whole entry goes.
  cv.experience = cv.experience.filter((e, i) => {
    if (!appearsIn(e.org, idx.allText)) {
      ctx.report.items.push({ path: `cv.experience.${i}`, text: `${e.role} - ${e.org}`, status: "removed", reason: "org_not_in_cv" });
      ctx.report.removed++;
      return false;
    }
    e.role = checkLine(e.role, idx, lang, ctx, `cv.experience.${i}.role`) ?? "";
    e.dates = checkDates(e.dates, idx, lang, ctx, `cv.experience.${i}.dates`);
    e.bullets.forEach((c, j) => processClaim(`cv.experience.${i}.bullets.${j}`, c, cvCtx, false));
    return true;
  });
  cv.projects.forEach((p, i) => {
    p.context = checkLine(p.context, idx, lang, ctx, `cv.projects.${i}.context`);
    p.dates = checkDates(p.dates, idx, lang, ctx, `cv.projects.${i}.dates`);
    p.bullets.forEach((c, j) => processClaim(`cv.projects.${i}.bullets.${j}`, c, cvCtx, false));
  });
  cv.education = cv.education.filter((e, i) => {
    if (!appearsIn(e.institution, idx.allText)) {
      ctx.report.items.push({ path: `cv.education.${i}`, text: `${e.degree} - ${e.institution}`, status: "removed", reason: "org_not_in_cv" });
      ctx.report.removed++;
      return false;
    }
    e.dates = checkDates(e.dates, idx, lang, ctx, `cv.education.${i}.dates`);
    e.details.forEach((c, j) => processClaim(`cv.education.${i}.details.${j}`, c, cvCtx, false));
    return true;
  });
  cv.certifications = cv.certifications.filter((c, i) => {
    if (!appearsIn(c.name, idx.allText)) {
      ctx.report.items.push({ path: `cv.certifications.${i}`, text: c.name, status: "removed", reason: "cert_not_in_cv" });
      ctx.report.removed++;
      return false;
    }
    return true;
  });
  cv.skills.forEach((g, i) => {
    g.items = g.items.filter((s) => {
      if (appearsIn(s, idx.allText, 0.5)) return true;
      ctx.report.items.push({ path: `cv.skills.${i}`, text: s, status: "removed", reason: "skill_not_in_cv" });
      ctx.report.removed++;
      return false;
    });
  });
  cv.skills = cv.skills.filter((g) => g.items.length > 0);
  cv.languages.forEach((c, i) => processClaim(`cv.languages.${i}`, c, ctx));

  draft.coverLetter.paragraphs.forEach((c, i) => processClaim(`coverLetter.paragraphs.${i}`, c, postingCtx));
  enforceWordLimit(draft, ctx);

  draft.needsInput = mergeNeeds(draft.needsInput, ctx.needs);
  return { result: draft, report: ctx.report };
}

/** Short free-text fields (dates, headline, location, role): numbers must come from the facts; placeholders are collected. */
function checkLine(line: string | null, idx: FactIndex, lang: Lang, ctx: Ctx, path: string): string | null {
  if (!line) return line;
  const bad = extractNumbers(line).filter((n) => !idx.allNumbers.has(n));
  const fixed = bad.length ? neutralizeNumbers(line, bad, lang) : line;
  if (bad.length) ctx.report.items.push({ path, text: fixed, status: "needs_input", reason: "number_not_in_cv", detail: bad.join(", ") });
  for (const p of findPlaceholders(fixed)) addNeed(ctx, p, fixed);
  return fixed;
}
const checkDates = checkLine;

export function coverLetterWords(d: TailorDraft): number {
  const live = d.coverLetter.paragraphs.filter((p) => claimStatus(p) !== "removed");
  return wordCount([d.coverLetter.greeting, ...live.map((p) => p.text), d.coverLetter.closing, d.coverLetter.signature].join(" "));
}

/** Trim trailing sentences from the longest middle paragraph until the letter is within the limit. */
function enforceWordLimit(d: TailorDraft, ctx: Ctx): void {
  let guard = 50;
  while (coverLetterWords(d) > COVER_LETTER_MAX_WORDS && guard-- > 0) {
    const live = d.coverLetter.paragraphs.filter((p) => claimStatus(p) !== "removed");
    const candidates = live.length > 2 ? live.slice(1, -1) : live;
    const longest = candidates.reduce((a, b) => (wordCount(b.text) > wordCount(a.text) ? b : a));
    const sentences = longest.text.match(/[^.!?؟]+[.!?؟]+|\S[^.!?؟]*$/g) ?? [longest.text];
    if (sentences.length <= 1) {
      (longest as VerifiedClaim).status = "removed";
    } else {
      longest.text = sentences.slice(0, -1).join("").trim();
    }
    if (guard === 49) {
      ctx.report.items.push({ path: "coverLetter", text: "", status: "needs_input", reason: "over_word_limit" });
    }
  }
}

// ---------------- job map ----------------

export const MAP_LIMITS = { titles: 8, cvFixes: 6, maxCompanies: 20 } as const;

export function verifyMap(
  draft: MapDraft,
  sheet: FactSheet,
  validCompanyIds: Set<string>,
  verdicts: Verdict[] | null,
): { result: MapDraft; report: VerificationReport } {
  const ctx = newCtx(sheet, draft.outputLanguage, verdicts, []);

  // Structural limits and dataset ids (the schema enum already restricts ids; this is a second gate).
  const seen = new Set<string>();
  draft.companies = draft.companies
    .filter((c) => validCompanyIds.has(c.companyId) && !seen.has(c.companyId) && seen.add(c.companyId))
    .slice(0, MAP_LIMITS.maxCompanies);
  draft.titles = draft.titles.slice(0, MAP_LIMITS.titles);
  draft.cvFixes = draft.cvFixes.slice(0, MAP_LIMITS.cvFixes);
  draft.programIds = [...new Set(draft.programIds)];
  draft.salaryRowIds = [...new Set(draft.salaryRowIds)];
  draft.platformIds = [...new Set(draft.platformIds)];

  draft.profile.summary.forEach((c, i) => processClaim(`profile.summary.${i}`, c, ctx));
  processClaim("keyAlert", draft.keyAlert, ctx);
  draft.titles.forEach((t, i) => processClaim(`titles.${i}.why`, t.why, ctx));
  draft.companies.forEach((c, i) => processClaim(`companies.${i}.fit`, c.fit, ctx));
  draft.cvFixes.forEach((f, i) => processClaim(`cvFixes.${i}.detail`, f.detail, ctx));

  draft.needsInput = mergeNeeds(draft.needsInput, ctx.needs);
  return { result: draft, report: ctx.report };
}

// ---------------- fact sheet self-check ----------------

/**
 * The extraction step itself must not invent: every number in a fact must appear in the CV text,
 * and every org must appear in it. Facts that fail are dropped before generation.
 */
export function checkFactSheet(sheet: FactSheet, cvText: string): { sheet: FactSheet; dropped: string[] } {
  const cvNumbers = new Set(extractNumbers(cvText));
  const dropped: string[] = [];
  const facts = sheet.facts.filter((f) => {
    const nums = extractNumbers([f.text, f.start, f.end, f.alt].filter(Boolean).join(" "));
    const numbersOk = nums.every((n) => cvNumbers.has(n));
    const orgOk = !f.org || appearsIn(f.org, cvText, 0.5);
    const textOk = appearsIn(f.text, cvText, 0.35);
    if (numbersOk && orgOk && textOk) return true;
    dropped.push(f.id);
    return false;
  });
  return { sheet: { ...sheet, facts }, dropped };
}
