import type { ConfigResponse, ErrorBody, ErrorCode, MapRequest, MapResponse, QuotaResponse, StepId, StreamEvent, TailorRequest, TailorResponse } from "../../shared/api";

export class ApiError extends Error {
  /** When the limit resets (epoch ms), fixed at the moment the error arrived. */
  readonly resetAt: number;
  constructor(
    public code: ErrorCode | "network",
    public retryAfterSec?: number,
  ) {
    super(code);
    this.resetAt = Date.now() + (retryAfterSec ?? 0) * 1000;
  }
}

export async function getConfig(): Promise<ConfigResponse> {
  const r = await fetch("/api/config", { headers: { accept: "application/json" } });
  if (!r.ok) throw new ApiError("internal");
  return (await r.json()) as ConfigResponse;
}

export async function getQuota(cid: string): Promise<QuotaResponse | null> {
  try {
    const r = await fetch(`/api/quota?cid=${encodeURIComponent(cid)}`, { headers: { accept: "application/json" } });
    return r.ok ? ((await r.json()) as QuotaResponse) : null;
  } catch {
    return null;
  }
}

type Progress = (step: StepId, status: "start" | "done") => void;

async function runStream<T>(path: string, body: unknown, onProgress: Progress, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/x-ndjson" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("network");
  }
  if (!res.ok || !res.body) {
    let err: ErrorBody | null = null;
    try {
      err = (await res.json()) as ErrorBody;
    } catch {
      /* not json */
    }
    throw new ApiError(err?.error ?? (res.status === 429 ? "rate_limited" : "internal"), err?.retryAfterSec);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  let result: T | null = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line) as StreamEvent;
        if (ev.type === "progress") onProgress(ev.step, ev.status);
        else if (ev.type === "error") throw new ApiError(ev.code, ev.retryAfterSec);
        else if (ev.type === "result") result = ev.data as T;
      }
    }
  } catch (e) {
    if (e instanceof ApiError || (e as Error).name === "AbortError") throw e;
    throw new ApiError("network");
  }
  if (!result) throw new ApiError("network");
  return result;
}

export const runTailor = (req: TailorRequest, onProgress: Progress, signal?: AbortSignal) =>
  runStream<TailorResponse>("/api/tailor", req, onProgress, signal);

export const runMap = (req: MapRequest, onProgress: Progress, signal?: AbortSignal) => runStream<MapResponse>("/api/map", req, onProgress, signal);
