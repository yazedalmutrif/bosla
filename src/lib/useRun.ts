import { useCallback, useRef, useState } from "react";
import type { StepId } from "../../shared/api";
import { initialSteps, type StepState } from "../components/tool";
import { ApiError } from "./api";

export type Phase<T> = { kind: "form" } | { kind: "running"; steps: StepState } | { kind: "done"; data: T } | { kind: "error"; error: ApiError };

/** Drives one tool run: progress events -> step states -> result or error. */
export function useRun<T>(runner: (onProgress: (s: StepId, st: "start" | "done") => void, signal: AbortSignal) => Promise<T>) {
  const [phase, setPhase] = useState<Phase<T>>({ kind: "form" });
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    let steps = initialSteps();
    setPhase({ kind: "running", steps });
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const data = await runner((s, st) => {
        steps = { ...steps, [s]: st === "start" ? "active" : "done" };
        setPhase({ kind: "running", steps });
      }, ctl.signal);
      setPhase({ kind: "done", data });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setPhase({ kind: "error", error: e instanceof ApiError ? e : new ApiError("network") });
    }
  }, [runner]);

  const reset = useCallback(() => {
    abort.current?.abort();
    setPhase({ kind: "form" });
  }, []);

  return { phase, start, reset };
}
