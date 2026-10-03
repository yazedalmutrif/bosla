import Anthropic from "@anthropic-ai/sdk";
import type { ConfigResponse, ErrorBody, ErrorCode, QuotaResponse, StreamEvent } from "../shared/api";
import { LIMITS } from "../shared/api";
import type { Dataset } from "../shared/dataset";
import datasetJson from "../data/dataset.json";
import { settings, type Env, type Settings } from "./env";
import { hmacHex, nextRiyadhMidnight, riyadhDay } from "./hash";
import type { Keys } from "./limiter-core";
import { PipelineError } from "./claude";
import { estimateRunMicroUsd, runMap, runTailor, type Deps } from "./pipeline";
import { verifyTurnstile } from "./turnstile";
import { ipBucket, readCapped } from "./net";
import { MapRequestSchema, TailorRequestSchema, isUuid } from "./validate";

export { Limiter } from "./limiter";

const dataset = datasetJson as unknown as Dataset;
const encoder = new TextEncoder();

const API_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...API_HEADERS, ...extra },
  });
}

function fail(status: number, code: ErrorCode, retryAfterSec?: number): Response {
  const body: ErrorBody = { error: code, ...(retryAfterSec ? { retryAfterSec } : {}) };
  return json(status, body, retryAfterSec ? { "retry-after": String(retryAfterSec) } : {});
}

function secondsUntil(iso: string): number {
  return Math.max(60, Math.ceil((Date.parse(iso) - Date.now()) / 1000));
}

/** Same-origin only: browsers send Origin on POST; reject any other site. */
function originAllowed(request: Request, s: Settings): boolean {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  if (!origin) return true; // non-browser clients still need Turnstile + limits
  const self = new URL(request.url).origin;
  return origin === self || s.allowedOrigins.includes(origin);
}

function limiterStub(env: Env) {
  return env.LIMITER.get(env.LIMITER.idFromName("global"));
}

async function keysFor(request: Request, clientId: string, env: Env, s: Settings): Promise<Keys> {
  const salt = env.HASH_SALT || (s.mock ? "local-dev-salt" : "");
  if (!salt) throw new PipelineError("internal");
  const ip = ipBucket(request.headers.get("cf-connecting-ip"));
  return {
    day: riyadhDay(),
    visitor: await hmacHex(salt, `cid:${clientId}`),
    ip: await hmacHex(salt, `ip:${ip}`),
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env, ctx, url);
    } catch (e) {
      console.error("api: unhandled", e instanceof Error ? e.name : "unknown");
      return fail(500, "internal");
    }
  },
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const s = settings(env);
  const cfg = { perVisitor: s.perVisitor, perIp: s.perIp, budgetMicroUsd: s.budgetMicroUsd };

  if (request.method === "GET" && url.pathname === "/api/config") {
    const body: ConfigResponse = { turnstileSiteKey: s.siteKey, runsPerDay: s.perVisitor, mock: s.mock };
    return json(200, body);
  }

  if (request.method === "GET" && url.pathname === "/api/quota") {
    const cid = url.searchParams.get("cid");
    if (!isUuid(cid)) return fail(400, "invalid_input");
    const keys = await keysFor(request, cid, env, s);
    const q = await limiterStub(env).getQuota(keys, cfg);
    const body: QuotaResponse = { limit: s.perVisitor, used: q.used, remaining: q.remaining, resetsAt: nextRiyadhMidnight() };
    return json(200, body);
  }

  const tool = url.pathname === "/api/tailor" ? "tailor" : url.pathname === "/api/map" ? "map" : null;
  if (!tool) return fail(404, "invalid_input");
  if (request.method !== "POST") return fail(405, "invalid_input");
  if (!originAllowed(request, s)) return fail(403, "invalid_input");
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return fail(415, "invalid_input");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > LIMITS.bodyMaxBytes) return fail(413, "too_large");

  // Read with a hard cap, so a missing or false Content-Length can't make us buffer a huge body.
  const raw = await readCapped(request, LIMITS.bodyMaxBytes);
  if (raw === null) return fail(413, "too_large");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid_input");
  }
  const parsed = tool === "tailor" ? TailorRequestSchema.safeParse(body) : MapRequestSchema.safeParse(body);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === "too_big");
    return fail(tooLong ? 413 : 400, tooLong ? "too_large" : "invalid_input");
  }
  const req = parsed.data;

  if (!s.mock && !env.ANTHROPIC_API_KEY) {
    console.error("config: ANTHROPIC_API_KEY missing");
    return fail(503, "internal");
  }

  // Bot protection. In mock mode without a secret (plain local dev) it is skipped.
  if (env.TURNSTILE_SECRET_KEY || !s.mock) {
    const ts = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, req.turnstileToken, request.headers.get("cf-connecting-ip"), url.hostname);
    if (!ts.ok) return fail(403, "turnstile_failed");
  }

  let keys: Keys;
  try {
    keys = await keysFor(request, req.clientId, env, s);
  } catch {
    console.error("config: HASH_SALT missing");
    return fail(503, "internal");
  }
  const estimate = estimateRunMicroUsd(s.model, req.cvText.length, "postingText" in req ? req.postingText.length : 0, tool, dataset);
  const limiter = limiterStub(env);
  const reservation = await limiter.reserveRun(keys, cfg, estimate);
  if (!reservation.ok) {
    const reset = secondsUntil(nextRiyadhMidnight());
    if (reservation.reason === "budget") return fail(503, "budget_exhausted", reset);
    return fail(429, reservation.reason === "ip" ? "ip_limited" : "rate_limited", reset);
  }

  // Stream progress as NDJSON so the UI can show real step-by-step status.
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const send = async (e: StreamEvent) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(e) + "\n"));
    } catch {
      /* client went away; keep going so the cost is settled */
    }
  };

  const started = Date.now();
  const deps: Deps = {
    client: s.mock ? null : new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 170_000, logLevel: "error" }),
    model: s.model,
    dataset,
    mockDelayMs: s.mockDelayMs,
    progress: (step, status) => send({ type: "progress", step, status }),
  };

  const run = (async () => {
    const heartbeat = setInterval(() => void send({ type: "ping" }), 15_000);
    let cost = 0;
    let code: ErrorCode | null = null;
    try {
      if (tool === "tailor") {
        const out = await runTailor(req as Parameters<typeof runTailor>[0], deps);
        cost = out.cost;
        await send({ type: "result", tool: "tailor", data: out.data });
      } else {
        const out = await runMap(req as Parameters<typeof runMap>[0], deps);
        cost = out.cost;
        await send({ type: "result", tool: "map", data: out.data });
      }
    } catch (e) {
      code = e instanceof PipelineError ? e.code : "internal";
      cost = e instanceof PipelineError ? e.costMicroUsd : 0;
      await send({ type: "error", code });
    } finally {
      clearInterval(heartbeat);
      // Give the run back only if we failed before anything was billed.
      const refund = code !== null && cost === 0 && code !== "not_a_cv";
      try {
        await limiter.settleRun(keys, estimate, s.mock ? 0 : cost, refund);
      } catch {
        // The reservation then stays counted until the day ends (fails safe for the budget).
        console.error("limiter: settle failed");
      }
      // Content-free log line: never CV or posting text.
      console.log(JSON.stringify({ evt: "run", tool, ok: code === null, code, costMicroUsd: cost, ms: Date.now() - started, mock: s.mock }));
      try {
        await writer.close();
      } catch {
        /* already closed */
      }
    }
  })();
  ctx.waitUntil(run);

  return new Response(readable, {
    status: 200,
    headers: { "content-type": "application/x-ndjson; charset=utf-8", ...API_HEADERS, "x-runs-remaining": String(reservation.remaining) },
  });
}
