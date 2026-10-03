import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CircleAlert, FileText, FileUp, Loader2, RotateCcw, Upload, X } from "lucide-react";
import type { ErrorCode, StepId } from "../../shared/api";
import { LIMITS } from "../../shared/api";
import { useI18n } from "../i18n";
import { ApiError, getQuota } from "../lib/api";
import { parseCvFile } from "../lib/parse-cv";
import { clientId } from "../lib/storage";
import { Turnstile } from "./Turnstile";
import { Button, Callout, cn } from "./ui";

// ---------------- text area with counter ----------------

export function TextField({
  id,
  label,
  help,
  value,
  onChange,
  placeholder,
  max,
  rows = 10,
  dirAuto = true,
  error,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  max: number;
  rows?: number;
  dirAuto?: boolean;
  error?: string | null;
}) {
  const { t } = useI18n();
  const over = value.length > max;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="mb-2 text-sm text-muted">
          {help}
        </p>
      )}
      <textarea
        id={id}
        dir={dirAuto ? "auto" : undefined}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={`${id}-help ${id}-count`}
        aria-invalid={over || !!error || undefined}
        className={cn(
          "block w-full resize-y rounded-2xl border bg-surface px-4 py-3 text-[0.95rem] leading-relaxed text-ink shadow-sm transition-colors duration-200 placeholder:text-subtle focus:border-ring focus:outline-none focus-visible:outline-2 focus-visible:outline-ring",
          over || error ? "border-danger" : "border-line-strong",
        )}
      />
      <div className="mt-1.5 flex items-start justify-between gap-3 text-xs">
        <span className={cn(error || over ? "text-danger" : "text-muted")} role={error ? "alert" : undefined}>
          {over ? t.tool.tooLong(max) : error}
        </span>
        <span id={`${id}-count`} className={cn("shrink-0 tabular-nums", over ? "text-danger" : "text-subtle")}>
          {t.tool.chars(value.length, max)}
        </span>
      </div>
    </div>
  );
}

// ---------------- CV input ----------------

export function CvInput({ value, onChange, sample, error }: { value: string; onChange: (v: string) => void; sample: string; error?: string | null }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const id = useId();

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setNote(null);
      const r = await parseCvFile(file);
      setBusy(false);
      if (!r.ok) {
        const msg = { type: t.tool.errType, size: t.tool.errSize, legacy_doc: t.tool.errLegacyDoc, empty: t.tool.warnEmpty, read: t.tool.errRead }[r.reason];
        setNote({ tone: "error", text: msg });
        setFileName(null);
        return;
      }
      setFileName(file.name);
      onChange(r.text.slice(0, LIMITS.cvMaxChars));
      if (r.warning === "scrambled") setNote({ tone: "warn", text: t.tool.warnScrambled });
      else if (r.warning === "short") setNote({ tone: "warn", text: t.tool.warnShort });
      else setNote({ tone: "ok", text: t.tool.readOk(r.text.length, file.name) });
    },
    [onChange, t],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors duration-200",
          drag ? "border-ring bg-primary-soft" : "border-line-strong bg-surface-2/60 hover:border-primary-text/50",
        )}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-surface text-primary-text shadow-card">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : fileName ? <FileText className="size-5" aria-hidden /> : <FileUp className="size-5" aria-hidden />}
        </span>
        <div>
          <p className="font-medium text-ink">{busy ? t.tool.reading : fileName ?? t.tool.drop}</p>
          <p className="mt-0.5 text-sm text-muted">{t.tool.dropHint}</p>
        </div>
        <input
          ref={inputRef}
          id={`${id}-file`}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
          data-testid="cv-file"
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="size-4" aria-hidden />
            {fileName ? t.tool.replace : t.tool.choose}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(sample);
              setFileName(null);
              setNote({ tone: "ok", text: t.tool.sampleNote });
            }}
          >
            {t.tool.sample}
          </Button>
        </div>
      </div>

      {note && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm",
            note.tone === "ok" && "bg-accent-soft text-ink",
            note.tone === "warn" && "bg-warn-soft text-ink",
            note.tone === "error" && "bg-danger-soft text-ink",
          )}
          role={note.tone === "ok" ? "status" : "alert"}
        >
          {note.tone === "ok" ? <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> : <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", note.tone === "warn" ? "text-warn" : "text-danger")} aria-hidden />}
          <span>{note.text}</span>
        </div>
      )}

      <div className="relative">
        <p className="mb-2 flex items-center gap-3 text-xs font-medium text-subtle">
          <span className="h-px flex-1 bg-line" aria-hidden />
          {t.tool.orPaste}
          <span className="h-px flex-1 bg-line" aria-hidden />
        </p>
        <TextField id={`${id}-cv`} label={t.tool.pasteLabel} value={value} onChange={onChange} placeholder={t.tool.pastePlaceholder} max={LIMITS.cvMaxChars} rows={9} error={error} />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setFileName(null);
              setNote(null);
            }}
            className="absolute end-0 top-6 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
            {t.tool.clear}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------- quota ----------------

export function useQuota() {
  const [q, setQ] = useState<{ remaining: number; limit: number } | null>(null);
  const refresh = useCallback(async () => {
    const r = await getQuota(clientId());
    if (r) setQ({ remaining: r.remaining, limit: r.limit });
  }, []);
  useEffect(() => {
    let alive = true;
    getQuota(clientId()).then((r) => {
      if (alive && r) setQ({ remaining: r.remaining, limit: r.limit });
    });
    return () => {
      alive = false;
    };
  }, []);
  return { quota: q, refresh };
}

// ---------------- run panel: consent + human check + button ----------------

export function RunPanel({
  siteKey,
  mock,
  consent,
  setConsent,
  onToken,
  resetKey,
  quota,
  running,
  label,
  onRun,
  problems,
}: {
  siteKey: string | null;
  mock: boolean;
  consent: boolean;
  setConsent: (v: boolean) => void;
  onToken: (t: string | null) => void;
  resetKey: number;
  quota: { remaining: number; limit: number } | null;
  running: boolean;
  label: string;
  onRun: () => void;
  problems: string[];
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="space-y-5">
      <label htmlFor={`${id}-consent`} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-2/60 p-4">
        <input
          id={`${id}-consent`}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-5 shrink-0 cursor-pointer accent-[var(--primary)]"
        />
        <span className="text-[0.95rem] text-ink">{t.tool.consent}</span>
      </label>

      {siteKey ? <Turnstile siteKey={siteKey} onToken={onToken} resetKey={resetKey} /> : null}

      {problems.length > 0 && (
        <ul className="space-y-1 text-sm text-danger" role="alert">
          {problems.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {quota ? (quota.remaining > 0 ? t.tool.quota(quota.remaining, quota.limit) : t.tool.quotaNone) : mock ? "" : " "}
        </p>
        <Button type="button" size="lg" onClick={onRun} loading={running} className="w-full sm:w-auto" data-testid="run">
          {running ? t.tool.running : label}
        </Button>
      </div>
    </div>
  );
}

// ---------------- progress ----------------

export type StepState = Record<StepId, "waiting" | "active" | "done">;
export const initialSteps = (): StepState => ({ extract: "waiting", generate: "waiting", verify: "waiting" });

export function ProgressPanel({ steps, tool }: { steps: StepState; tool: "tailor" | "map" }) {
  const { t } = useI18n();
  const labels: Record<StepId, string> = {
    extract: t.progress.extract,
    generate: tool === "map" ? t.progress.generateMap : t.progress.generate,
    verify: t.progress.verify,
  };
  const order: StepId[] = ["extract", "generate", "verify"];
  const doneCount = order.filter((s) => steps[s] === "done").length;
  return (
    <section className="card mx-auto max-w-xl p-6 sm:p-8" aria-live="polite" aria-busy="true" data-testid="progress">
      <h2 className="text-xl font-semibold text-ink">{t.progress.title}</h2>
      <p className="mt-1 text-muted">{t.progress.lead}</p>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={doneCount}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out dark:bg-primary-text" style={{ width: `${Math.max(6, (doneCount / 3) * 100)}%` }} />
      </div>
      <ol className="mt-6 space-y-4">
        {order.map((s, i) => {
          const st = steps[s];
          return (
            <li key={s} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-medium transition-colors duration-300",
                  st === "done" && "border-transparent bg-accent text-white dark:text-bg",
                  st === "active" && "border-ring bg-primary-soft text-primary-text",
                  st === "waiting" && "border-line text-subtle",
                )}
              >
                {st === "done" ? <Check className="size-4" aria-hidden /> : st === "active" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : i + 1}
              </span>
              <span className={cn("flex-1", st === "waiting" ? "text-subtle" : "text-ink", st === "active" && "font-medium")}>{labels[s]}</span>
              <span className="sr-only">{st === "done" ? t.progress.done : st === "active" ? t.progress.active : t.progress.waiting}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------- errors ----------------

export function ErrorPanel({ error, onRetry, onEdit }: { error: ApiError; onRetry: () => void; onEdit: () => void }) {
  const { t, lang } = useI18n();
  const code = error.code as ErrorCode | "network";
  const resetTime = () => {
    const d = new Date(error.resetAt);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(d);
  };
  const E = t.errors;
  const entry = (E as Record<string, unknown>)[code];
  const msg =
    code === "rate_limited" ? E.rate_limited(resetTime()) : code === "ip_limited" ? E.ip_limited(resetTime()) : typeof entry === "string" ? entry : E.internal;
  const canRetry = !["rate_limited", "ip_limited", "budget_exhausted"].includes(code);
  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="error">
      <Callout tone="danger" icon={<CircleAlert className="size-5 text-danger" aria-hidden />} title={E.title}>
        <span data-error-code={code}>{msg}</span>
      </Callout>
      <div className="flex flex-wrap gap-3">
        {canRetry && (
          <Button onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden />
            {E.tryAgain}
          </Button>
        )}
        <Button variant="secondary" onClick={onEdit}>
          {t.tool.edit}
        </Button>
      </div>
    </div>
  );
}

// ---------------- page frame ----------------

export function ToolHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="inline-flex items-center gap-2 text-[0.8rem] font-medium text-primary-text">
        <span className="h-px w-6 bg-gold" aria-hidden />
        {eyebrow}
      </p>
      <h1 className="text-3xl leading-tight font-semibold tracking-display text-ink sm:text-[2.6rem]">{title}</h1>
      <p className="text-lg text-muted">{lead}</p>
    </div>
  );
}

export function StepCard({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-7" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-5 flex items-center gap-3 text-lg font-semibold text-ink">
        <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-fg">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
