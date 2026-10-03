import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { ErrorCode } from "../shared/api";
import { costMicroUsd } from "../shared/pricing";

export class PipelineError extends Error {
  constructor(
    public code: ErrorCode,
    public costMicroUsd = 0,
  ) {
    super(code);
  }
}

export type Effort = "low" | "medium" | "high";

export interface StructuredFormat<T> {
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
}

/** Convert a zod schema to the JSON schema Claude's structured outputs accept. Do this once, at module load. */
export function structuredFormat<T>(schema: z.ZodType<T>): StructuredFormat<T> {
  const fmt = betaZodOutputFormat(schema);
  return { schema, jsonSchema: fmt.schema as Record<string, unknown> };
}

export interface CallSpec<T> {
  system: string;
  user: string;
  format: StructuredFormat<T>;
  maxTokens: number;
  effort: Effort;
}

export interface CallResult<T> {
  data: T;
  costMicroUsd: number;
}

/**
 * One structured call. The stable system prompt is cached; the user's CV/posting go in the user turn.
 * `fallbacks: "default"` re-runs a policy-declined request on Anthropic's recommended fallback model.
 */
export async function callStructured<T>(client: Anthropic, model: string, spec: CallSpec<T>): Promise<CallResult<T>> {
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await client.beta.messages.create({
      model,
      max_tokens: spec.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: spec.effort,
        format: { type: "json_schema", schema: spec.format.jsonSchema },
      },
      system: [{ type: "text", text: spec.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: spec.user }],
    });
  } catch (err) {
    throw mapError(err);
  }

  const cost = costMicroUsd(res.model, res.usage);
  if (res.stop_reason === "refusal") throw new PipelineError("refused", cost);
  if (res.stop_reason === "max_tokens") throw new PipelineError("upstream_error", cost);

  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PipelineError("upstream_error", cost);
  }
  const parsed = spec.format.schema.safeParse(json);
  if (!parsed.success) throw new PipelineError("upstream_error", cost);
  return { data: parsed.data, costMicroUsd: cost };
}

function mapError(err: unknown): PipelineError {
  // Most specific first. Never include request content in anything we log or return.
  if (err instanceof Anthropic.RateLimitError) return new PipelineError("upstream_overloaded");
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("claude: auth/permission error (check ANTHROPIC_API_KEY)");
    return new PipelineError("internal");
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("claude: bad request", err.status);
    return new PipelineError("internal");
  }
  if (err instanceof Anthropic.InternalServerError) return new PipelineError("upstream_overloaded");
  if (err instanceof Anthropic.APIConnectionError) return new PipelineError("upstream_error");
  if (err instanceof Anthropic.APIError) {
    console.error("claude: api error", err.status);
    return new PipelineError(err.status === 529 ? "upstream_overloaded" : "upstream_error");
  }
  console.error("claude: unexpected error");
  return new PipelineError("internal");
}
