import { z } from "zod";

/*
 * Structured-output schemas shared by the Worker (Claude calls) and the frontend (rendering).
 * Claude's structured outputs don't support length/count constraints, so counts
 * ("8 titles", "6 fixes") are asked for in the prompt and enforced in post-processing.
 */

export const LangSchema = z.enum(["ar", "en"]);
export type Lang = z.infer<typeof LangSchema>;

// ---------- Step 1: fact sheet ----------

export const FactCategorySchema = z.enum([
  "summary",
  "education",
  "experience",
  "project",
  "skill",
  "certification",
  "award",
  "language",
  "volunteer",
  "other",
]);

export const FactSchema = z.object({
  id: z.string().describe("Sequential id: F1, F2, F3 ..."),
  category: FactCategorySchema,
  text: z
    .string()
    .describe("One atomic fact, as close to verbatim from the CV as possible, in the CV's own language. Never add anything the CV doesn't say."),
  org: z.string().nullable().describe("Employer, institution or issuer exactly as written in the CV, or null"),
  role: z.string().nullable().describe("Job title, degree or certificate name as written, or null"),
  start: z.string().nullable().describe("Start date as written in the CV, or null"),
  end: z.string().nullable().describe("End date as written in the CV (or 'Present'), or null"),
  alt: z
    .string()
    .nullable()
    .describe("A faithful translation of text (and org) into the other language (Arabic <-> English), adding nothing. null if not needed."),
});
export type Fact = z.infer<typeof FactSchema>;

export const GapSchema = z.object({
  item: z.string().describe("What is missing or unclear, e.g. 'GPA', 'graduation date', 'city'"),
  why: z.string().describe("Why an employer would want it, one short sentence"),
});
export type Gap = z.infer<typeof GapSchema>;

export const FactSheetSchema = z.object({
  isCv: z.boolean().describe("false if the text is not a CV / resume at all"),
  cvLanguage: z.enum(["ar", "en", "mixed"]),
  person: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    links: z.array(z.string()),
  }),
  headline: z.string().nullable().describe("The CV's own title line, if it has one"),
  facts: z.array(FactSchema),
  gaps: z.array(GapSchema).describe("Things employers usually expect that this CV does not state"),
});
export type FactSheet = z.infer<typeof FactSheetSchema>;

// ---------- Claims (every sentence about the person cites facts) ----------

export const ClaimSchema = z.object({
  text: z
    .string()
    .describe("The sentence. Use [[...]] placeholders for any detail the facts don't give, e.g. [[confirm: number of users]]."),
  factIds: z.array(z.string()).describe("Ids of the facts that support this sentence. Empty only if it states nothing about the person."),
});
export type Claim = z.infer<typeof ClaimSchema>;

// ---------- Step 2A: tailored CV ----------

export const TailorDraftSchema = z.object({
  outputLanguage: LangSchema,
  posting: z.object({
    title: z.string(),
    company: z.string().nullable(),
    location: z.string().nullable(),
    mustHaves: z.array(z.string()),
    niceToHaves: z.array(z.string()),
    keywords: z.array(z.string()).describe("ATS keywords from the posting"),
  }),
  leadWith: ClaimSchema.describe("One line: which experience or project the CV leads with, and which posting requirement that answers"),
  fit: z.array(
    z.object({
      requirement: z.string(),
      level: z.enum(["strong", "partial", "missing"]),
      evidence: ClaimSchema.describe("Evidence from the facts; empty text and no factIds when missing"),
      howToAddress: z.string().describe("An honest way to handle it. Never suggest claiming a skill the person doesn't have."),
    }),
  ),
  cv: z.object({
    name: z.string(),
    headline: z.string().describe("Target title line, honest to the person's level"),
    contact: z.array(z.string()).describe("Email, phone, links exactly as in the fact sheet"),
    location: z.string().nullable().describe("Location from the CV, or a [[...]] placeholder asking the person to confirm city / relocation"),
    summary: z.array(ClaimSchema),
    skills: z.array(
      z.object({
        group: z.string(),
        items: z.array(z.string()).describe("Only skills present in the facts"),
        factIds: z.array(z.string()),
      }),
    ),
    experience: z.array(
      z.object({
        role: z.string(),
        org: z.string(),
        location: z.string().nullable(),
        dates: z.string().nullable(),
        factIds: z.array(z.string()),
        bullets: z.array(ClaimSchema),
      }),
    ),
    projects: z.array(
      z.object({
        name: z.string(),
        context: z.string().nullable(),
        dates: z.string().nullable(),
        factIds: z.array(z.string()),
        bullets: z.array(ClaimSchema),
      }),
    ),
    education: z.array(
      z.object({
        degree: z.string(),
        institution: z.string(),
        dates: z.string().nullable(),
        factIds: z.array(z.string()),
        details: z.array(ClaimSchema),
      }),
    ),
    certifications: z.array(
      z.object({
        name: z.string(),
        issuer: z.string().nullable(),
        date: z.string().nullable(),
        factIds: z.array(z.string()),
      }),
    ),
    languages: z.array(ClaimSchema),
  }),
  coverLetter: z.object({
    greeting: z.string(),
    paragraphs: z.array(ClaimSchema),
    closing: z.string(),
    signature: z.string(),
  }),
  tweaks: z.array(z.string()).describe("3-5 concrete CV tweaks for this posting"),
  needsInput: z.array(GapSchema),
});
export type TailorDraft = z.infer<typeof TailorDraftSchema>;

// ---------- Step 2B: job map (ids must come from the dataset) ----------

export interface MapIdSets {
  companyIds: [string, ...string[]];
  programIds: [string, ...string[]];
  salaryRowIds: [string, ...string[]];
  platformIds: [string, ...string[]];
  patternIds: [string, ...string[]];
  fieldIds: [string, ...string[]];
}

export function makeMapDraftSchema(ids: MapIdSets) {
  return z.object({
    outputLanguage: LangSchema,
    profile: z.object({
      summary: z.array(ClaimSchema).describe("3-4 short sentences about the person's profile"),
      fields: z.array(z.enum(ids.fieldIds)),
      level: z.string().describe("e.g. fresh graduate, 1-3 years"),
    }),
    keyAlert: ClaimSchema.describe("The single thing that most helps or hurts this person's search"),
    titles: z.array(
      z.object({
        title: z.string().describe("Exact English job title as written on LinkedIn"),
        gloss: z.string().describe("Short gloss in the output language"),
        why: ClaimSchema,
      }),
    ),
    companies: z.array(
      z.object({
        companyId: z.enum(ids.companyIds),
        priority: z.enum(["first", "second", "backup"]),
        fit: ClaimSchema.describe("Why this company fits THIS person, citing their facts. No salary numbers."),
      }),
    ),
    programIds: z.array(z.enum(ids.programIds)),
    salaryRowIds: z.array(z.enum(ids.salaryRowIds)),
    platformIds: z.array(z.enum(ids.platformIds)),
    cvFixes: z.array(
      z.object({
        title: z.string(),
        detail: ClaimSchema,
        patternId: z.enum(ids.patternIds).nullable(),
      }),
    ),
    needsInput: z.array(GapSchema),
  });
}
export type MapDraft = z.infer<ReturnType<typeof makeMapDraftSchema>>;

// ---------- Step 3: verification verdicts ----------

export const VerdictSchema = z.object({
  id: z.string(),
  verdict: z.enum(["supported", "partly", "unsupported"]),
  problem: z.string().nullable().describe("What is not supported by the facts, or null"),
  fixedText: z
    .string()
    .nullable()
    .describe("For 'partly': the sentence rewritten to use only the facts, with [[...]] placeholders for anything missing. Otherwise null."),
});
export type Verdict = z.infer<typeof VerdictSchema>;

export const VerdictListSchema = z.object({ verdicts: z.array(VerdictSchema) });
