// The contract between the browser and the Worker.
import type { FactSheet, Lang, MapDraft, TailorDraft } from "./schemas";
import type { VerificationReport } from "./verify";
import type { DatasetCompany, DatasetPlatform, DatasetProgram, DatasetSalaryRow, Bilingual, DatasetSource } from "./dataset";

export const LIMITS = {
  cvMinChars: 200,
  cvMaxChars: 20_000,
  postingMinChars: 150,
  postingMaxChars: 20_000,
  bodyMaxBytes: 120_000,
  fileMaxBytes: 5 * 1024 * 1024,
} as const;

export type CityChoice = "riyadh" | "jeddah" | "both";

export interface TailorRequest {
  cvText: string;
  postingText: string;
  outputLang: "auto" | Lang;
  turnstileToken: string;
  clientId: string;
}

export interface MapRequest {
  cvText: string;
  city: CityChoice;
  outputLang: Lang;
  turnstileToken: string;
  clientId: string;
}

export type StepId = "extract" | "generate" | "verify";

export type StreamEvent =
  | { type: "progress"; step: StepId; status: "start" | "done" }
  | { type: "result"; tool: "tailor"; data: TailorResponse }
  | { type: "result"; tool: "map"; data: MapResponse }
  | { type: "error"; code: ErrorCode; retryAfterSec?: number }
  | { type: "ping" };

export type ErrorCode =
  | "invalid_input"
  | "not_a_cv"
  | "too_large"
  | "turnstile_failed"
  | "rate_limited"
  | "ip_limited"
  | "budget_exhausted"
  | "upstream_error"
  | "upstream_overloaded"
  | "refused"
  | "internal";

export interface ErrorBody {
  error: ErrorCode;
  retryAfterSec?: number;
}

export interface TailorResponse {
  factSheet: FactSheet;
  draft: TailorDraft;
  report: VerificationReport;
  mock: boolean;
}

export interface MapResponse {
  factSheet: FactSheet;
  draft: MapDraft;
  report: VerificationReport;
  companies: DatasetCompany[];
  programs: DatasetProgram[];
  salaryRows: DatasetSalaryRow[];
  platforms: DatasetPlatform[];
  cities: Array<{ id: string } & Bilingual>;
  sectors: Array<{ id: string } & Bilingual>;
  sources: DatasetSource[];
  salaryDisclaimer: Bilingual;
  compiledOn: string;
  mock: boolean;
}

export interface QuotaResponse {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export interface ConfigResponse {
  turnstileSiteKey: string;
  runsPerDay: number;
  mock: boolean;
}
