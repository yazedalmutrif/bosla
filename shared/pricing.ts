// Claude API prices in USD per million tokens.
// Source: https://platform.claude.com/docs/en/about-claude/pricing (read 2026-09-27).
// Used for the daily spend cap and the cost estimate. Update if Anthropic changes prices.
export interface ModelPrice {
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheRead: number;
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-opus-5": { input: 5, output: 25, cacheWrite5m: 6.25, cacheRead: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite5m: 5, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite5m: 2.5, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite5m: 1.25, cacheRead: 0.1 },
};

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Cost of one API call in micro-dollars (1e-6 USD), rounded up. Unknown models are priced as the most expensive listed. */
export function costMicroUsd(model: string, usage: UsageLike): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5"];
  const usd =
    ((usage.input_tokens ?? 0) * p.input +
      (usage.output_tokens ?? 0) * p.output +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite5m +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead) /
    1_000_000;
  return Math.ceil(usd * 1_000_000);
}
