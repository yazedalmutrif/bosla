import { useState } from "react";
import { AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";
import type { MapResponse } from "../../shared/api";
import type { DatasetCompany } from "../../shared/dataset";
import type { Claim } from "../../shared/schemas";
import { claimStatus } from "../../shared/verify";
import { DICTS, useI18n } from "../i18n";
import { RichText } from "./helpers";
import { DownloadButton, NeedsList, PrintButton, ReportList, VerificationSummary } from "./results";
import { Badge, Button, Callout, cn } from "./ui";

const shown = (c: Claim) => claimStatus(c) !== "removed";

export function MapResult({ data, onStartOver }: { data: MapResponse; onStartOver: () => void }) {
  const { t } = useI18n();
  const d = data.draft;
  const lang = d.outputLanguage;
  const D = DICTS[lang];
  const R = D.result;
  const fmtN = (x: number) => x.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en");
  const fmtDate = (iso: string) => {
    const dt = new Date(`${iso}T12:00:00Z`);
    return Number.isNaN(dt.getTime()) ? iso : new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(dt);
  };
  const [showReport, setShowReport] = useState(false);

  const byId = new Map(data.companies.map((c) => [c.id, c]));
  const cityName = (id: string) => data.cities.find((c) => c.id === id)?.[lang] ?? id;
  const sectorName = (id: string) => data.sectors.find((s) => s.id === id)?.[lang] ?? id;
  const groups: Record<string, typeof d.companies> = {};
  for (const c of d.companies) {
    const co = byId.get(c.companyId);
    if (!co) continue;
    const key = co.cities.includes("riyadh") ? "riyadh" : co.cities.includes("jeddah") ? "jeddah" : "other";
    (groups[key] ??= []).push(c);
  }
  const groupOrder = ["riyadh", "jeddah", "other"].filter((k) => groups[k]?.length);

  return (
    <div className="space-y-8" data-testid="map-result">
      <header className="no-print space-y-5">
        {data.mock && <Callout tone="warn">{t.result.mockBanner}</Callout>}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="text-3xl font-semibold tracking-display text-ink sm:text-4xl">{t.result.mapTitle}</h1>
          <div className="flex flex-wrap gap-2">
            <DownloadButton t={t} testId="dl-map" label={t.result.downloadMap} filename={`${lang === "ar" ? "خارطة الوظائف" : "Job map"}.docx`} make={async () => (await import("../lib/docx-export")).mapDocx(data, D)} />
            <PrintButton t={t} />
            <Button variant="ghost" size="sm" onClick={onStartOver}>
              <RotateCcw className="size-4" aria-hidden />
              {t.tool.startOver}
            </Button>
          </div>
        </div>
        <div className="card flex flex-col gap-3 p-4 sm:p-5">
          <VerificationSummary report={data.report} t={t} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              <mark className="ph me-1.5">[ ]</mark>
              {t.result.placeholderLegend}
            </p>
            <button type="button" onClick={() => setShowReport((s) => !s)} className="text-sm font-medium text-primary-text hover:underline underline-offset-4" aria-expanded={showReport}>
              {t.result.tabs.report} ({data.report.items.length})
            </button>
          </div>
          {showReport && (
            <div className="border-t border-line pt-4">
              <ReportList report={data.report} t={t} />
            </div>
          )}
        </div>
      </header>

      <div lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-12">
        {/* profile */}
        <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]" aria-labelledby="m-profile">
          <div className="card p-6 sm:p-7">
            <h2 id="m-profile" className="text-sm font-semibold text-primary-text">
              {R.profile}
            </h2>
            <div className="mt-3 space-y-2 text-[1.05rem] leading-relaxed text-ink">
              {d.profile.summary.filter(shown).map((c, i) => (
                <p key={i}>
                  <RichText text={c.text} />
                </p>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">
              <span className="font-medium text-ink">{R.profileLevel}: </span>
              {d.profile.level}
            </p>
          </div>
          {shown(d.keyAlert) && (
            <div className="flex flex-col gap-3 rounded-[1.25rem] border border-warn-line bg-warn-soft p-6 sm:p-7">
              <p className="flex items-center gap-2 text-sm font-semibold text-warn">
                <AlertTriangle className="size-4" aria-hidden />
                {R.keyAlert}
              </p>
              <p className="text-[1.05rem] leading-relaxed text-ink">
                <RichText text={d.keyAlert.text} />
              </p>
            </div>
          )}
        </section>

        {/* titles */}
        <section aria-labelledby="m-titles" className="space-y-5">
          <SectionTitle id="m-titles" title={R.titles} lead={R.titlesLead} />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="titles">
            {d.titles.map((x, i) => (
              <li key={i} className={cn("card p-4", i < 3 && "ring-1 ring-primary-text/25")}>
                <p className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-1 font-semibold text-ink" dir="ltr" lang="en">
                  {x.title}
                </p>
                <p className="text-sm text-primary-text">{x.gloss}</p>
                {shown(x.why) && (
                  <p className="mt-2 text-sm text-muted">
                    <RichText text={x.why.text} />
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* companies */}
        <section aria-labelledby="m-companies" className="space-y-6">
          <SectionTitle id="m-companies" title={R.companies} lead={R.companiesLead} />
          {groupOrder.map((g) => (
            <div key={g} className="space-y-4">
              <h3 className="flex items-center gap-3 text-lg font-semibold text-ink">
                {g === "other" ? R.otherCity : cityName(g)}
                <span className="h-px flex-1 bg-line" aria-hidden />
              </h3>
              <ul className="grid gap-4 md:grid-cols-2" data-testid={`companies-${g}`}>
                {groups[g].map((c) => {
                  const co = byId.get(c.companyId)!;
                  return (
                    <CompanyCard
                      key={c.companyId}
                      co={co}
                      fit={shown(c.fit) ? c.fit.text : null}
                      priority={R.priority[c.priority]}
                      first={c.priority === "first"}
                      cities={co.cities.map(cityName).join(lang === "ar" ? "، " : ", ")}
                      sector={sectorName(co.sector)}
                      lang={lang}
                      R={R}
                      fmtN={fmtN}
                      fmtDate={fmtDate}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {/* salary table */}
        {data.salaryRows.length > 0 && (
          <section aria-labelledby="m-salary" className="space-y-5">
            <SectionTitle id="m-salary" title={R.salaryTable} lead={data.salaryDisclaimer[lang]} />
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[40rem] text-start text-[0.95rem]">
                <thead className="bg-surface-2 text-sm text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start font-medium">{R.segment}</th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">{R.start}</th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">{R.later(data.salaryRows.find((r) => r.later)?.later?.afterYears ?? 3)}</th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">{R.note}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.salaryRows.map((r) => (
                    <tr key={r.id}>
                      <th scope="row" className="px-4 py-3 text-start font-medium text-ink">{r.segment[lang]}</th>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-ink">
                        {fmtN(r.start.min)}
                        {r.start.max !== r.start.min && ` - ${fmtN(r.start.max)}`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-ink">{r.later ? `${fmtN(r.later.min)} - ${fmtN(r.later.max)}` : "-"}</td>
                      <td className="px-4 py-3 text-muted">
                        {r.note?.[lang]} <span className="text-xs text-subtle">({r.kind === "estimate" ? R.estimateBadge : "HRDF"} · {r.sourceId} · {fmtDate(r.asOf)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-subtle">{R.perMonth}</p>
          </section>
        )}

        {/* programs */}
        {data.programs.length > 0 && (
          <section aria-labelledby="m-programs" className="space-y-5">
            <SectionTitle id="m-programs" title={R.programs} />
            <ul className="grid gap-4 md:grid-cols-2">
              {data.programs.map((p) => (
                <li key={p.id} className="card flex flex-col gap-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{p.name[lang]}</p>
                    {p.deadline && <Badge tone="primary">{R.deadline(fmtDate(p.deadline))}</Badge>}
                  </div>
                  <p className="text-sm text-muted">{p.requirements[lang]}</p>
                  {p.verified === false && <p className="text-sm text-warn">{R.checkCurrent}</p>}
                  <LinkRow url={p.url} label={R.careers} checked={p.linkCheck?.checkedOn} ok={p.linkCheck?.ok} R={R} fmtDate={fmtDate} meta={`${p.sourceId} · ${R.dataAsOf(fmtDate(p.asOf))}`} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* platforms */}
        <section aria-labelledby="m-platforms" className="space-y-5">
          <SectionTitle id="m-platforms" title={R.platforms} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.platforms.map((p) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="card group flex h-full items-start justify-between gap-3 p-4 transition-colors duration-200 hover:border-primary-text/40">
                  <span>
                    <span className="block font-semibold text-ink">{p.name[lang]}</span>
                    <span className="mt-0.5 block text-sm text-muted">{p.goodFor[lang]}</span>
                  </span>
                  <ExternalLink className="mt-1 size-4 shrink-0 text-subtle group-hover:text-primary-text" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* CV fixes */}
        <section aria-labelledby="m-fixes" className="space-y-5">
          <SectionTitle id="m-fixes" title={R.fixes} />
          <ol className="space-y-3" data-testid="fixes">
            {d.cvFixes.map((f, i) =>
              shown(f.detail) ? (
                <li key={i} className="card flex gap-4 p-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-fg">{i + 1}</span>
                  <div>
                    <p className="font-semibold text-ink">{f.title}</p>
                    <p className="mt-1 text-muted">
                      <RichText text={f.detail.text} />
                    </p>
                  </div>
                </li>
              ) : null,
            )}
          </ol>
        </section>

        {d.needsInput.length > 0 && (
          <section aria-labelledby="m-needs" className="space-y-5">
            <SectionTitle id="m-needs" title={R.needsTitle} />
            <NeedsList needs={d.needsInput} t={D} />
          </section>
        )}

        {/* sources */}
        <section aria-labelledby="m-sources" className="space-y-3 border-t border-line pt-8 text-sm text-muted">
          <h2 id="m-sources" className="font-semibold text-ink">
            {R.sourcesTitle}
          </h2>
          <p>
            {data.salaryDisclaimer[lang]} {R.compiled(fmtDate(data.compiledOn))}
          </p>
          <ul className="space-y-1" dir="ltr" lang="en">
            {data.sources.map((s) => (
              <li key={s.id}>
                <span className="font-mono text-xs text-subtle">{s.id}</span> {s.title} ({s.date})
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="space-y-1">
      <h2 id={id} className="text-2xl font-semibold tracking-display text-ink">
        {title}
      </h2>
      {lead && <p className="text-muted">{lead}</p>}
    </div>
  );
}

function CompanyCard({
  co,
  fit,
  priority,
  first,
  cities,
  sector,
  lang,
  R,
  fmtN,
  fmtDate,
}: {
  co: DatasetCompany;
  fit: string | null;
  priority: string;
  first: boolean;
  cities: string;
  sector: string;
  lang: "ar" | "en";
  R: (typeof DICTS)["en"]["result"];
  fmtN: (x: number) => string;
  fmtDate: (s: string) => string;
}) {
  return (
    <li className={cn("card flex flex-col gap-3 p-5 sm:p-6", first && "ring-1 ring-primary-text/25")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-ink">{co.name[lang]}</p>
          <p className="text-sm text-muted">
            {cities} · {sector}
          </p>
        </div>
        <Badge tone={first ? "primary" : "neutral"} className="shrink-0">
          {priority}
        </Badge>
      </div>
      <p className="text-[0.95rem] text-muted">{co.about[lang]}</p>
      {fit && (
        <p className="rounded-xl bg-accent-soft/70 px-3.5 py-2.5 text-[0.95rem] text-ink">
          <RichText text={fit} />
        </p>
      )}
      {co.typicalRoles.length > 0 && (
        <p className="text-sm text-muted" dir="auto">
          <span className="font-medium text-ink">{R.roles}: </span>
          <span dir="ltr" lang="en">
            {co.typicalRoles.join(" · ")}
          </span>
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
        {co.salary ? (
          <div>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              {R.estSalary}
              <Badge tone="warn" className="px-1.5 py-0 text-[0.65rem]">
                {R.estimateBadge}
              </Badge>
            </p>
            <p className="font-semibold tabular-nums text-ink">
              {fmtN(co.salary.min)} - {fmtN(co.salary.max)} <span className="text-sm font-normal text-muted">{R.perMonth}</span>
            </p>
          </div>
        ) : (
          <span />
        )}
        <a
          href={co.careersUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line-strong px-3.5 text-sm font-medium text-ink transition-colors duration-200 hover:border-primary-text hover:text-primary-text"
        >
          {R.careers}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
      <p className="text-xs text-subtle">
        {co.sourceId} · {R.dataAsOf(fmtDate(co.asOf))}
        {co.linkCheck?.checkedOn && ` · ${co.linkCheck.ok === true ? R.asOf(fmtDate(co.linkCheck.checkedOn)) : R.linkUnverified}`}
      </p>
    </li>
  );
}

function LinkRow({ url, label, checked, ok, R, fmtDate, meta }: { url: string; label: string; checked?: string; ok?: boolean | null; R: (typeof DICTS)["en"]["result"]; fmtDate: (s: string) => string; meta: string }) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
      <span className="text-xs text-subtle">
        {meta}
        {checked && ` · ${ok === true ? R.asOf(fmtDate(checked)) : R.linkUnverified}`}
      </span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline underline-offset-4">
        {label}
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}
