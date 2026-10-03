import { useRef, useState, type ReactNode } from "react";
import { BadgeCheck, CircleSlash, Download, Info, PenLine, Printer } from "lucide-react";
import type { Gap } from "../../shared/schemas";
import type { VerificationReport } from "../../shared/verify";
import type { Dict } from "../i18n/en";
import { RichText } from "./helpers";
import { Button, cn } from "./ui";

export function Tabs<K extends string>({ tabs, active, onChange, label }: { tabs: Array<{ key: K; label: string; count?: number }>; active: K; onChange: (k: K) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = document.documentElement.dir === "rtl" ? -1 : 1;
    let next = -1;
    if (e.key === "ArrowRight") next = i + dir;
    if (e.key === "ArrowLeft") next = i - dir;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next < 0 && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const k = tabs[(next + tabs.length) % tabs.length].key;
    onChange(k);
    refs.current[k]?.focus();
  };
  return (
    <div className="no-print -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
      <div role="tablist" aria-label={label} className="inline-flex min-w-full gap-1 rounded-2xl border border-line bg-surface-2 p-1 sm:min-w-0">
        {tabs.map((tb, i) => {
          const on = tb.key === active;
          return (
            <button
              key={tb.key}
              ref={(el) => {
                refs.current[tb.key] = el;
              }}
              role="tab"
              id={`tab-${tb.key}`}
              aria-selected={on}
              aria-controls={`panel-${tb.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(tb.key)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium whitespace-nowrap transition-colors duration-200",
                on ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {tb.label}
              {tb.count !== undefined && tb.count > 0 && <span className="rounded-full bg-warn-soft px-1.5 text-xs text-warn">{tb.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className={className} tabIndex={-1}>
      {children}
    </div>
  );
}

export function VerificationSummary({ report, t }: { report: VerificationReport; t: Dict }) {
  const R = t.result;
  const items = [
    { n: report.verified, label: R.verified, icon: <BadgeCheck className="size-4" aria-hidden />, cls: "text-accent" },
    { n: report.needsInput, label: R.needs, icon: <PenLine className="size-4" aria-hidden />, cls: "text-warn" },
    { n: report.removed, label: R.removed, icon: <CircleSlash className="size-4" aria-hidden />, cls: "text-danger" },
  ];
  return (
    <div className="space-y-3" data-testid="verification-summary">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-medium text-ink">
          <span className="tabular-nums">{report.checkedClaims}</span> {R.checked}
        </span>
        {items.map((x) => (
          <span key={x.label} className={cn("inline-flex items-center gap-1.5", x.cls)}>
            {x.icon}
            <span className="tabular-nums font-medium">{x.n}</span>
            <span className="text-muted">{x.label}</span>
          </span>
        ))}
      </div>
      {!report.llmPass && (
        <p className="flex items-start gap-2 text-sm text-warn">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {R.llmSkipped}
        </p>
      )}
    </div>
  );
}

export function ReportList({ report, t }: { report: VerificationReport; t: Dict }) {
  const R = t.result;
  if (report.items.length === 0) return <p className="text-muted">{R.reportEmpty}</p>;
  return (
    <ul className="space-y-3" data-testid="report-list">
      {report.items.map((it, i) => (
        <li key={i} className={cn("rounded-2xl border p-4", it.status === "removed" ? "border-line" : "border-warn-line bg-warn-soft/40")}>
          <p className={cn("flex items-center gap-1.5 text-xs font-medium", it.status === "removed" ? "text-danger" : "text-warn")}>
            {it.status === "removed" ? <CircleSlash className="size-3.5" aria-hidden /> : <PenLine className="size-3.5" aria-hidden />}
            {R.reasons[it.reason]}
          </p>
          {it.original && (
            <p className="mt-2 text-sm text-subtle">
              <span className="font-medium">{R.before}: </span>
              <span className="line-through decoration-danger/40">{it.original}</span>
            </p>
          )}
          {it.text && (
            <p className={cn("mt-1.5 text-[0.95rem]", it.status === "removed" ? "text-subtle line-through decoration-danger/40" : "text-ink")} dir="auto">
              <RichText text={it.text} />
            </p>
          )}
          {it.detail && <p className="mt-1 text-sm text-muted" dir="auto">{it.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

export function NeedsList({ needs, t }: { needs: Gap[]; t: Dict }) {
  const R = t.result;
  if (needs.length === 0) return <p className="text-muted">{R.needsEmpty}</p>;
  return (
    <ol className="space-y-3" data-testid="needs-list">
      {needs.map((n, i) => (
        <li key={i} className="flex gap-3 rounded-2xl border border-warn-line bg-warn-soft/40 p-4">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-warn-soft text-sm font-medium text-warn">{i + 1}</span>
          <div className="min-w-0">
            <p className="font-medium text-ink" dir="auto">
              {n.item}
            </p>
            <p className="mt-0.5 text-sm text-muted" dir="auto">
              <RichText text={n.why} />
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DownloadButton({ label, make, filename, t, testId }: { label: string; make: () => Promise<Blob>; filename: string; t: Dict; testId?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      data-testid={testId}
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await make();
          const { downloadBlob } = await import("../lib/docx-export");
          downloadBlob(blob, filename);
        } finally {
          setBusy(false);
        }
      }}
    >
      {!busy && <Download className="size-4" aria-hidden />}
      {busy ? t.result.downloading : label}
    </Button>
  );
}

export function PrintButton({ t }: { t: Dict }) {
  return (
    <Button variant="ghost" size="sm" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      {t.result.print}
    </Button>
  );
}
