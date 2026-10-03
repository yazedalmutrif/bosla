import type { Limiter } from "./limiter";

export interface Env {
  ASSETS: Fetcher;
  LIMITER: DurableObjectNamespace<Limiter>;
  // vars
  MOCK?: string;
  CLAUDE_MODEL?: string;
  TURNSTILE_SITE_KEY?: string;
  RUNS_PER_VISITOR_PER_DAY?: string;
  RUNS_PER_IP_PER_DAY?: string;
  DAILY_BUDGET_USD?: string;
  ALLOWED_ORIGINS?: string;
  MOCK_DELAY_MS?: string;
  // secrets (wrangler secret put / .dev.vars)
  ANTHROPIC_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  HASH_SALT?: string;
}

export interface Settings {
  mock: boolean;
  model: string;
  siteKey: string;
  perVisitor: number;
  perIp: number;
  budgetMicroUsd: number;
  allowedOrigins: string[];
  mockDelayMs: number;
}

function int(v: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function settings(env: Env): Settings {
  const budgetUsd = Number.parseFloat(env.DAILY_BUDGET_USD ?? "5");
  return {
    mock: env.MOCK === "true",
    model: env.CLAUDE_MODEL || "claude-sonnet-5",
    siteKey: env.TURNSTILE_SITE_KEY ?? "",
    perVisitor: int(env.RUNS_PER_VISITOR_PER_DAY, 3, 0, 1000),
    perIp: int(env.RUNS_PER_IP_PER_DAY, 10, 0, 10000),
    budgetMicroUsd: Math.round((Number.isFinite(budgetUsd) && budgetUsd >= 0 ? budgetUsd : 5) * 1_000_000),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    mockDelayMs: int(env.MOCK_DELAY_MS, 900, 0, 10000),
  };
}
