import { useState } from "react";
import { Compass, RotateCcw } from "lucide-react";
import type { TailorResponse } from "../../shared/api";
import type { Claim } from "../../shared/schemas";
import { claimStatus, coverLetterWords } from "../../shared/verify";
import { DICTS, useI18n } from "../i18n";
import { RichText } from "./helpers";
import { DownloadButton, NeedsList, PrintButton, ReportList, TabPanel, Tabs, VerificationSummary } from "./results";
import { Badge, Button, Callout, cn } from "./ui";

type TabKey = "fit" | "cv" | "letter" | "needs" | "report";

const live = (cs: Claim[]) => cs.filter((c) => claimStatus(c) !== "removed");

export function TailorResult({ data, onStartOver }: { data: TailorResponse; onStartOver: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>("fit");
  const d = data.draft;
  const out = d.outputLanguage;
  const D = DICTS[out]; // document labels follow the document's language
  const R = t.result;
  const fileBase = (d.cv.name || "CV").replace(/\s+/g, " ");

  return (
    <div className="space-y-7" data-testid="tailor-result">
      <header className="no-print space-y-5">
        {data.mock && <Callout tone="warn">{R.mockBanner}</Callout>}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-display text-ink sm:text-4xl">{R.tailorTitle}</h1>
            <p className="text-lg text-muted" dir="auto">
              {[d.posting.title, d.posting.company, d.posting.location].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DownloadButton
              t={t}
              testId="dl-cv"
              label={R.downloadCv}
              filename={`${fileBase} - CV.docx`}
              make={async () => (await import("../lib/docx-export")).cvDocx(d, D)}
            />
            <DownloadButton
              t={t}
              testId="dl-letter"
              label={R.downloadLetter}
              filename={`${fileBase} - Cover letter.docx`}
              make={async () => (await import("../lib/docx-export")).letterDocx(d)}
            />
            <Button variant="ghost" size="sm" onClick={onStartOver}>
              <RotateCcw className="size-4" aria-hidden />
              {t.tool.startOver}
            </Button>
          </div>
        </div>
        <div className="card flex flex-col gap-3 p-4 sm:p-5">
          <VerificationSummary report={data.report} t={t} />
          <p className="text-sm text-muted">
            <mark className="ph me-1.5">[ ]</mark>
            {R.placeholderLegend}
          </p>
        </div>
      </header>

      <Tabs<TabKey>
        label={R.tailorTitle}
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "fit", label: R.tabs.fit },
          { key: "cv", label: R.tabs.cv },
          { key: "letter", label: R.tabs.letter },
          { key: "needs", label: R.tabs.needs, count: d.needsInput.length },
          { key: "report", label: R.tabs.report, count: data.report.items.length },
        ]}
      />

      {tab === "fit" && (
        <TabPanel id="fit" className="space-y-6">
          {claimStatus(d.leadWith) !== "removed" && (
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-primary-soft/60 p-4">
              <Compass className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
              <p className="text-ink" dir="auto">
                <span className="font-semibold">{R.leadWith}: </span>
                <RichText text={d.leadWith.text} />
              </p>
            </div>
          )}
          <ul className="grid gap-4 md:grid-cols-2" data-testid="fit-list">
            {d.fit.map((f, i) => (
              <li key={i} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-ink" dir="auto">
                    {f.requirement}
                  </p>
                  <Badge tone={f.level === "strong" ? "accent" : f.level === "partial" ? "warn" : "danger"} className="shrink-0">
                    {R[f.level]}
                  </Badge>
                </div>
                {f.evidence.text && claimStatus(f.evidence) !== "removed" && (
                  <p className="text-[0.95rem] text-ink" dir="auto">
                    <span className="text-muted">{R.evidence}: </span>
                    <RichText text={f.evidence.text} />
                  </p>
                )}
                <p className="text-sm text-muted" dir="auto">
                  <span className="font-medium text-ink">{R.howTo}: </span>
                  {f.howToAddress}
                </p>
              </li>
            ))}
          </ul>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="font-semibold text-ink">{R.keywords}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {d.posting.keywords.map((k) => (
                  <li key={k} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm text-ink" dir="auto">
                    {k}
                  </li>
                ))}
              </ul>
            </section>
            <section className="card p-5">
              <h2 className="font-semibold text-ink">{R.tweaks}</h2>
              <ul className="mt-3 list-disc space-y-1.5 ps-5 text-ink marker:text-gold" dir="auto">
                {d.tweaks.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          </div>
        </TabPanel>
      )}

      {tab === "cv" && (
        <TabPanel id="cv" className="space-y-3">
          <div className="no-print flex justify-end">
            <PrintButton t={t} />
          </div>
          <CvPaper data={data} />
        </TabPanel>
      )}

      {tab === "letter" && (
        <TabPanel id="letter" className="space-y-3">
          <div className="no-print flex items-center justify-between">
            <span className="text-sm text-muted">{R.words(coverLetterWords(d))}</span>
            <PrintButton t={t} />
          </div>
          <Paper lang={out}>
            <p className="text-lg font-semibold">{d.cv.name}</p>
            <p className="mb-8 text-sm text-neutral-600">{d.cv.contact.join("  |  ")}</p>
            <p className="mb-4">{d.coverLetter.greeting}</p>
            {live(d.coverLetter.paragraphs).map((p, i) => (
              <p key={i} className="mb-4 leading-relaxed">
                <RichText text={p.text} />
              </p>
            ))}
            <p className="mt-6">{d.coverLetter.closing}</p>
            <p className="font-semibold">{d.coverLetter.signature}</p>
          </Paper>
        </TabPanel>
      )}

      {tab === "needs" && (
        <TabPanel id="needs" className="max-w-3xl space-y-4">
          <h2 className="text-xl font-semibold text-ink">{R.needsTitle}</h2>
          <NeedsList needs={d.needsInput} t={t} />
        </TabPanel>
      )}

      {tab === "report" && (
        <TabPanel id="report" className="max-w-3xl space-y-4">
          <h2 className="text-xl font-semibold text-ink">{R.reportTitle}</h2>
          <ReportList report={data.report} t={t} />
        </TabPanel>
      )}
    </div>
  );
}

/** A sheet of paper: always light, in the document's own language and direction. */
export function Paper({ lang, children, className }: { lang: "ar" | "en"; children: React.ReactNode; className?: string }) {
  return (
    <article
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={cn("print-doc mx-auto w-full max-w-[52rem] rounded-2xl border border-line bg-white px-5 py-8 text-[0.95rem] text-neutral-900 shadow-float sm:px-12 sm:py-12", className)}
      style={{ colorScheme: "light" }}
    >
      {children}
    </article>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 border-b border-neutral-300 pb-1 text-[0.8rem] font-semibold tracking-wide text-[#14305a] uppercase">{children}</h3>;
}

function CvPaper({ data }: { data: TailorResponse }) {
  const d = data.draft;
  const cv = d.cv;
  const L = DICTS[d.outputLanguage].result;
  const sep = d.outputLanguage === "ar" ? "، " : ", ";
  return (
    <Paper lang={d.outputLanguage}>
      <div className="text-center">
        <p className="text-2xl font-semibold">{cv.name}</p>
        <p className="mt-0.5 text-[#1b3d70]">
          <RichText text={cv.headline} />
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          {cv.location && (
            <>
              <RichText text={cv.location} />
              {cv.contact.length > 0 && "  |  "}
            </>
          )}
          {cv.contact.join("  |  ")}
        </p>
      </div>

      {live(cv.summary).length > 0 && (
        <>
          <H>{L.summary}</H>
          <p className="leading-relaxed">
            {live(cv.summary).map((c, i) => (
              <span key={i}>
                <RichText text={c.text} />{" "}
              </span>
            ))}
          </p>
        </>
      )}
      {cv.skills.length > 0 && (
        <>
          <H>{L.skills}</H>
          {cv.skills.map((g) => (
            <p key={g.group}>
              <span className="font-semibold">{g.group}: </span>
              {g.items.join(sep)}
            </p>
          ))}
        </>
      )}
      {cv.experience.length > 0 && (
        <>
          <H>{L.experience}</H>
          {cv.experience.map((e, i) => (
            <Entry key={i} title={[e.role, e.org, e.location].filter(Boolean).join(sep)} dates={e.dates} bullets={live(e.bullets)} />
          ))}
        </>
      )}
      {cv.projects.length > 0 && (
        <>
          <H>{L.projects}</H>
          {cv.projects.map((p, i) => (
            <Entry key={i} title={[p.name, p.context].filter(Boolean).join(" · ")} dates={p.dates} bullets={live(p.bullets)} />
          ))}
        </>
      )}
      {cv.education.length > 0 && (
        <>
          <H>{L.education}</H>
          {cv.education.map((e, i) => (
            <Entry key={i} title={[e.degree, e.institution].join(sep)} dates={e.dates} bullets={live(e.details)} />
          ))}
        </>
      )}
      {cv.certifications.length > 0 && (
        <>
          <H>{L.certifications}</H>
          <ul className="list-disc space-y-1 ps-5">
            {cv.certifications.map((c, i) => (
              <li key={i}>{[c.name, c.issuer, c.date].filter(Boolean).join(sep)}</li>
            ))}
          </ul>
        </>
      )}
      {live(cv.languages).length > 0 && (
        <>
          <H>{L.languages}</H>
          <p>{live(cv.languages).map((c) => c.text).join(sep)}</p>
        </>
      )}
    </Paper>
  );
}

function Entry({ title, dates, bullets }: { title: string; dates: string | null; bullets: Claim[] }) {
  return (
    <div className="mb-3 break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-semibold">
          <RichText text={title} />
        </p>
        {dates && (
          <p className="text-sm text-neutral-600">
            <RichText text={dates} />
          </p>
        )}
      </div>
      {bullets.length > 0 && (
        <ul className="mt-1 list-disc space-y-1 ps-5">
          {bullets.map((b, i) => (
            <li key={i} className="leading-relaxed">
              <RichText text={b.text} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
