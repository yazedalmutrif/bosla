/*
 * The accuracy pipeline, identical for both tools:
 *   1. extract  - CV text -> fact sheet (then a deterministic self-check drops any fact not in the CV)
 *   2. generate - output built only from the fact sheet, every claim citing fact ids
 *   3. verify   - an LLM judge checks every claim, then the deterministic verifier (shared/verify.ts)
 *                 applies the verdicts and its own checks. The deterministic pass always runs.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { MapResponse, StepId, TailorResponse } from "../shared/api";
import type { Dataset } from "../shared/dataset";
import {
  FactSheetSchema,
  TailorDraftSchema,
  VerdictListSchema,
  makeMapDraftSchema,
  type FactSheet,
  type Lang,
  type MapDraft,
  type TailorDraft,
  type Verdict,
} from "../shared/schemas";
import { detectLang } from "../shared/text";
import { checkFactSheet, collectMapClaims, collectTailorClaims, verifyMap, verifyTailor, type ClaimRef } from "../shared/verify";
import { PRICES } from "../shared/pricing";
import { PipelineError, callStructured, structuredFormat, type StructuredFormat } from "./claude";
import { EXTRACT_SYSTEM, TAILOR_SYSTEM, VERIFY_SYSTEM, mapSystem } from "./prompts";
import type { ValidMapRequest, ValidTailorRequest } from "./validate";
import * as mock from "./mock";

export const MAX_TOKENS = { extract: 12_000, generate: 16_000, verify: 8_000 } as const;

export interface Deps {
  client: Anthropic | null; // null in mock mode
  model: string;
  dataset: Dataset;
  mockDelayMs: number;
  progress: (step: StepId, status: "start" | "done") => Promise<void>;
}

// Structured-output formats are built once per isolate (keeps per-request CPU low).
const FACT_FORMAT = structuredFormat(FactSheetSchema);
const TAILOR_FORMAT = structuredFormat(TailorDraftSchema);
const VERDICT_FORMAT = structuredFormat(VerdictListSchema);
let mapFormatCache: { ds: Dataset; format: StructuredFormat<MapDraft>; system: string } | null = null;

function mapFormat(ds: Dataset) {
  if (mapFormatCache?.ds !== ds) {
    const nonEmpty = (xs: string[], fallback: string): [string, ...string[]] => (xs.length ? (xs as [string, ...string[]]) : [fallback]);
    const schema = makeMapDraftSchema({
      companyIds: nonEmpty(ds.companies.map((c) => c.id), "none"),
      programIds: nonEmpty(ds.programs.map((p) => p.id), "none"),
      salaryRowIds: nonEmpty(ds.salaryTable.map((r) => r.id), "none"),
      platformIds: nonEmpty(ds.platforms.map((p) => p.id), "none"),
      patternIds: nonEmpty(ds.cvPatterns.map((p) => p.id), "none"),
      fieldIds: nonEmpty(ds.fields.map((f) => f.id), "general"),
    });
    mapFormatCache = { ds, format: structuredFormat(schema) as StructuredFormat<MapDraft>, system: mapSystem(ds) };
  }
  return mapFormatCache;
}

/** Worst-case cost of one run in micro-USD, used to reserve budget before calling the API. */
export function estimateRunMicroUsd(model: string, cvChars: number, postingChars: number, tool: "tailor" | "map", ds: Dataset): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5"];
  const tok = (chars: number) => Math.ceil(chars / 2.5); // conservative: Arabic uses more tokens per character
  const genSystem = tool === "map" ? mapFormat(ds).system.length : TAILOR_SYSTEM.length;
  const schemaAllowance = 3_000; // structured-output schema + framing, per call
  const extractIn = tok(EXTRACT_SYSTEM.length + cvChars) + schemaAllowance;
  const generateIn = tok(genSystem + 2 * cvChars + postingChars) + schemaAllowance; // fact sheet ~2x CV (with translations)
  const verifyIn = tok(VERIFY_SYSTEM.length + 2 * cvChars) + MAX_TOKENS.generate + schemaAllowance; // claims <= generated output
  const totalIn = extractIn + generateIn + verifyIn;
  const totalOut = MAX_TOKENS.extract + MAX_TOKENS.generate + MAX_TOKENS.verify; // thinking is billed as output
  return Math.ceil(totalIn * p.input + totalOut * p.output); // tokens x $/MTok = micro-USD
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Meter {
  cost = 0;
  add(c: number) {
    this.cost += c;
  }
}

// ---------------- step 1 ----------------

async function extract(cvText: string, deps: Deps, meter: Meter): Promise<FactSheet> {
  await deps.progress("extract", "start");
  let sheet: FactSheet;
  let source = cvText;
  if (!deps.client) {
    await sleep(deps.mockDelayMs);
    sheet = mock.factSheet();
    source = mock.SAMPLE_CV_TEXT; // mock facts describe the bundled sample CV
  } else {
    const r = await callStructured(deps.client, deps.model, {
      system: EXTRACT_SYSTEM,
      user: `<cv>\n${cvText}\n</cv>`,
      format: FACT_FORMAT,
      maxTokens: MAX_TOKENS.extract,
      effort: "low",
    });
    meter.add(r.costMicroUsd);
    sheet = r.data;
  }
  if (!sheet.isCv) throw new PipelineError("not_a_cv", meter.cost);
  const checked = checkFactSheet(sheet, source).sheet;
  if (checked.facts.length < 2) throw new PipelineError("not_a_cv", meter.cost);
  await deps.progress("extract", "done");
  return checked;
}

// ---------------- step 3 helper ----------------

async function judge(sheet: FactSheet, postingSummary: string, claims: ClaimRef[], deps: Deps, meter: Meter): Promise<Verdict[] | null> {
  if (claims.length === 0) return [];
  if (!deps.client) {
    await sleep(Math.round(deps.mockDelayMs * 0.8));
    return mock.verdicts(claims);
  }
  try {
    const r = await callStructured(deps.client, deps.model, {
      system: VERIFY_SYSTEM,
      user: [
        `<fact_sheet>\n${JSON.stringify(sheet.facts)}\n</fact_sheet>`,
        `<posting_summary>\n${postingSummary}\n</posting_summary>`,
        `<claims>\n${JSON.stringify(claims.map((c) => ({ id: c.path, text: c.claim.text, factIds: c.claim.factIds })))}\n</claims>`,
      ].join("\n"),
      format: VERDICT_FORMAT,
      maxTokens: MAX_TOKENS.verify,
      effort: "low",
    });
    meter.add(r.costMicroUsd);
    return r.data.verdicts;
  } catch (e) {
    // The deterministic verifier still runs; the report shows the LLM cross-check was skipped.
    if (e instanceof PipelineError) meter.add(e.costMicroUsd);
    return null;
  }
}

// ---------------- tool A ----------------

export async function runTailor(req: ValidTailorRequest, deps: Deps): Promise<{ data: TailorResponse; cost: number }> {
  const meter = new Meter();
  try {
    const sheet = await extract(req.cvText, deps, meter);
    const lang: Lang = req.outputLang === "auto" ? detectLang(req.postingText) : req.outputLang;

    await deps.progress("generate", "start");
    let draft: TailorDraft;
    if (!deps.client) {
      await sleep(Math.round(deps.mockDelayMs * 1.5));
      draft = mock.tailorDraft(lang);
    } else {
      const r = await callStructured(deps.client, deps.model, {
        system: TAILOR_SYSTEM,
        user: [
          `Output language: ${lang === "ar" ? "Arabic" : "English"}`,
          `<fact_sheet>\n${JSON.stringify({ person: sheet.person, headline: sheet.headline, facts: sheet.facts, gaps: sheet.gaps })}\n</fact_sheet>`,
          `<job_posting>\n${req.postingText}\n</job_posting>`,
        ].join("\n"),
        format: TAILOR_FORMAT,
        maxTokens: MAX_TOKENS.generate,
        effort: "medium",
      });
      meter.add(r.costMicroUsd);
      draft = r.data;
    }
    draft.outputLanguage = lang;
    await deps.progress("generate", "done");

    await deps.progress("verify", "start");
    const summary = [draft.posting.title, draft.posting.company, draft.posting.location, ...draft.posting.mustHaves, ...draft.posting.niceToHaves]
      .filter(Boolean)
      .join("\n");
    const verdicts = await judge(sheet, summary, collectTailorClaims(draft), deps, meter);
    const { result, report } = verifyTailor(draft, sheet, deps.client ? req.postingText : mock.SAMPLE_POSTING_TEXT, verdicts);
    await deps.progress("verify", "done");

    return { data: { factSheet: sheet, draft: result, report, mock: !deps.client }, cost: meter.cost };
  } catch (e) {
    if (e instanceof PipelineError) {
      e.costMicroUsd = Math.max(e.costMicroUsd, meter.cost);
      throw e;
    }
    throw new PipelineError("internal", meter.cost);
  }
}

// ---------------- tool B ----------------

export async function runMap(req: ValidMapRequest, deps: Deps): Promise<{ data: MapResponse; cost: number }> {
  const meter = new Meter();
  const ds = deps.dataset;
  try {
    const sheet = await extract(req.cvText, deps, meter);
    const lang = req.outputLang;

    await deps.progress("generate", "start");
    let draft: MapDraft;
    if (!deps.client) {
      await sleep(Math.round(deps.mockDelayMs * 1.5));
      draft = mock.mapDraft(lang, ds, req.city);
    } else {
      const { format, system } = mapFormat(ds);
      const cityLine =
        req.city === "both" ? "Riyadh and Jeddah" : req.city === "riyadh" ? "Riyadh (Jeddah only if a strong fit)" : "Jeddah (Riyadh only if a strong fit)";
      const r = await callStructured(deps.client, deps.model, {
        system,
        user: [
          `Output language: ${lang === "ar" ? "Arabic" : "English"}`,
          `Preferred city: ${cityLine}`,
          `<fact_sheet>\n${JSON.stringify({ person: { location: sheet.person.location }, headline: sheet.headline, facts: sheet.facts, gaps: sheet.gaps })}\n</fact_sheet>`,
        ].join("\n"),
        format,
        maxTokens: MAX_TOKENS.generate,
        effort: "medium",
      });
      meter.add(r.costMicroUsd);
      draft = r.data;
    }
    draft.outputLanguage = lang;
    await deps.progress("generate", "done");

    await deps.progress("verify", "start");
    const verdicts = await judge(sheet, "(job map: no single posting)", collectMapClaims(draft), deps, meter);
    const { result, report } = verifyMap(draft, sheet, new Set(ds.companies.map((c) => c.id)), verdicts);
    await deps.progress("verify", "done");

    return { data: hydrateMap(result, report, sheet, ds, !deps.client), cost: meter.cost };
  } catch (e) {
    if (e instanceof PipelineError) {
      e.costMicroUsd = Math.max(e.costMicroUsd, meter.cost);
      throw e;
    }
    throw new PipelineError("internal", meter.cost);
  }
}

/** Attach dataset records (names, salaries, links, dates, sources) to the ids the model chose. */
export function hydrateMap(
  draft: MapDraft,
  report: MapResponse["report"],
  sheet: FactSheet,
  ds: Dataset,
  isMock: boolean,
): MapResponse {
  const byId = <T extends { id: string }>(xs: T[], ids: string[]) => ids.map((id) => xs.find((x) => x.id === id)).filter((x): x is T => !!x);
  const companies = byId(ds.companies, draft.companies.map((c) => c.companyId));
  let platforms = byId(ds.platforms, draft.platformIds);
  if (platforms.length === 0) platforms = ds.platforms.filter((p) => p.fields.includes("all"));
  const programs = byId(ds.programs, draft.programIds);
  const salaryRows = byId(ds.salaryTable, draft.salaryRowIds);
  const usedSources = new Set([...companies, ...programs, ...salaryRows, ...platforms].map((x) => x.sourceId));
  return {
    factSheet: sheet,
    draft,
    report,
    companies,
    programs,
    salaryRows,
    platforms,
    cities: ds.cities,
    sectors: ds.sectors,
    sources: ds.meta.sources.filter((s) => usedSources.has(s.id)),
    salaryDisclaimer: ds.meta.salaryDisclaimer,
    compiledOn: ds.meta.compiledOn,
    mock: isMock,
  };
}
