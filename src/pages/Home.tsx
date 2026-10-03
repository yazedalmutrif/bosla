import { ArrowLeft, ArrowRight, BadgeCheck, CircleSlash, FileSearch, KeyRound, Lock, Map, MonitorSmartphone, PenLine, ShieldCheck, Sparkles, TriangleAlert, UserX } from "lucide-react";
import { Link } from "react-router";
import { Reveal, useTitle } from "../components/helpers";
import { ButtonLink, Eyebrow, SectionHeading } from "../components/ui";
import { useI18n } from "../i18n";
import { useConfig } from "../lib/config";

export function Home() {
  const { t, dir, fmtDate } = useI18n();
  const h = t.home;
  const cfg = useConfig();
  useTitle(h.title);
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const runs = cfg?.runsPerDay;

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="hairline-grid pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -top-40 start-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-3xl rtl:translate-x-1/2"
          style={{ background: "radial-gradient(closest-side, var(--primary-soft), transparent)" }}
          aria-hidden
        />
        <div className="container-page relative grid items-center gap-12 pt-12 pb-16 sm:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pt-24 lg:pb-24">
          <div className="space-y-7">
            <Eyebrow>{h.eyebrow}</Eyebrow>
            <h1 className="text-[2.35rem] leading-[1.12] font-semibold tracking-display text-ink sm:text-5xl lg:text-[3.6rem]">
              {h.h1a}
              <span className="block text-primary-text">{h.h1b}</span>
            </h1>
            <p className="max-w-xl text-lg text-muted sm:text-[1.2rem] sm:leading-relaxed">{h.lead}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/tailor" size="lg" className="w-full sm:w-auto">
                {h.ctaTailor}
                <Arrow className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/map" size="lg" variant="secondary" className="w-full sm:w-auto">
                <Map className="size-4" aria-hidden />
                {h.ctaMap}
              </ButtonLink>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted">
              <ShieldCheck className="size-4 shrink-0 text-accent" aria-hidden />
              {runs !== undefined ? h.trust(runs) : h.trustBase}
            </p>
          </div>
          <VerificationDemo />
        </div>
      </section>

      {/* ---------------- how accuracy works ---------------- */}
      <section className="border-y border-line bg-bg-soft py-20 sm:py-24" aria-labelledby="how">
        <div className="container-page space-y-12">
          <Reveal>
            <SectionHeading eyebrow={h.howEyebrow} title={<span id="how">{h.howTitle}</span>} lead={h.howLead} />
          </Reveal>
          <ol className="grid gap-5 md:grid-cols-3">
            {h.steps.map((s, i) => {
              const Icon = [FileSearch, PenLine, BadgeCheck][i];
              return (
                <Reveal key={s.t} delay={i * 90} as="li" className="card relative h-full p-6 sm:p-7">
                    <div className="flex items-center justify-between">
                      <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary-text">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="font-mono text-sm text-subtle" aria-hidden>
                        0{i + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-ink">{s.t}</h3>
                    <p className="mt-2 text-muted">{s.d}</p>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ---------------- tools ---------------- */}
      <section className="py-20 sm:py-24" aria-labelledby="tools">
        <div className="container-page space-y-12">
          <Reveal>
            <SectionHeading eyebrow={h.toolsEyebrow} title={<span id="tools">{h.toolsTitle}</span>} />
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              { c: h.tailorCard, to: "/tailor", icon: PenLine },
              { c: h.mapCard, to: "/map", icon: Map },
            ].map(({ c, to, icon: Icon }, i) => (
              <Reveal key={to} delay={i * 90}>
                <article className="card group flex h-full flex-col p-7 sm:p-9">
                  <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-fg">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-6 text-2xl font-semibold text-ink">{c.t}</h3>
                  <p className="mt-1 text-muted">{c.d}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {c.items.map((x) => (
                      <li key={x} className="flex gap-3 text-ink">
                        <BadgeCheck className="mt-1 size-[1.1rem] shrink-0 text-accent" aria-hidden />
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={to} className="mt-8 inline-flex items-center gap-2 font-medium text-primary-text hover:underline underline-offset-4">
                    {c.cta}
                    <Arrow className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden />
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- honest data ---------------- */}
      <section className="py-4 sm:py-8" aria-labelledby="data">
        <div className="container-page">
          <Reveal>
            <div className="relative overflow-hidden rounded-[1.75rem] bg-primary px-6 py-12 text-primary-fg sm:px-12 sm:py-14 dark:bg-surface-2 dark:text-ink">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div className="space-y-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium opacity-80">
                    <span className="h-px w-6 bg-gold" aria-hidden />
                    {h.dataEyebrow}
                  </p>
                  <h2 id="data" className="text-[1.75rem] leading-tight font-semibold tracking-display sm:text-4xl">
                    {h.dataTitle}
                  </h2>
                  <p className="text-lg opacity-85">{h.dataBody(fmtDate(__DATASET_META__.compiledOn), __DATASET_META__.companies, __DATASET_META__.programs, __DATASET_META__.platforms)}</p>
                </div>
                <ul className="space-y-4">
                  {h.dataPoints.map((p, i) => {
                    const Icon = [TriangleAlert, KeyRound, Sparkles][i];
                    return (
                      <li key={p} className="flex gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 dark:border-line dark:bg-surface">
                        <Icon className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
                        <span className="opacity-95">{p}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- privacy ---------------- */}
      <section className="py-20 sm:py-24" aria-labelledby="privacy">
        <div className="container-page space-y-12">
          <Reveal>
            <SectionHeading eyebrow={h.privacyEyebrow} title={<span id="privacy">{h.privacyTitle}</span>} />
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {h.privacyPoints.map((p, i) => {
              const Icon = [UserX, MonitorSmartphone, Lock][i];
              return (
                <Reveal key={p.t} delay={i * 90}>
                  <div className="h-full rounded-2xl border border-line p-6">
                    <Icon className="size-6 text-primary-text" aria-hidden />
                    <h3 className="mt-4 text-lg font-semibold text-ink">{p.t}</h3>
                    <p className="mt-1.5 text-muted">{p.d}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Link to="/privacy" className="inline-flex items-center gap-2 font-medium text-primary-text hover:underline underline-offset-4">
            {h.privacyLink}
            <Arrow className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="border-t border-line py-20 sm:py-24" aria-labelledby="faq">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading title={<span id="faq">{h.faqTitle}</span>} />
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {h.faq.map((f) => (
              <details key={f.q} className="group p-5 sm:p-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between gap-4 text-lg font-medium text-ink">
                  {f.q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition-transform duration-200 group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted">{f.a(runs ?? 3)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="pb-4">
        <div className="container-page">
          <div className="card flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-semibold text-ink sm:text-3xl">{h.finalTitle}</h2>
              <p className="mt-1 text-muted">{h.finalLead}</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink to="/tailor" size="lg" className="w-full sm:w-auto">
                {h.ctaTailor}
              </ButtonLink>
              <ButtonLink to="/map" size="lg" variant="secondary" className="w-full sm:w-auto">
                {h.ctaMap}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** A static picture of the verification report, using the fictional sample CV. */
function VerificationDemo() {
  const { t } = useI18n();
  const h = t.home;
  return (
    <figure className="relative mx-auto w-full max-w-[34rem]" aria-label={h.demoLabel}>
      <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-primary-soft to-transparent opacity-80" aria-hidden />
      <div className="card overflow-hidden shadow-float">
        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent" aria-hidden />
            <span className="text-sm font-semibold text-ink">{h.demoTitle}</span>
          </div>
          <span className="font-mono text-xs text-subtle" aria-hidden>
            3 / 3
          </span>
        </div>
        <ul className="space-y-3 p-5">
          <li className="rounded-xl border border-line p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
              <BadgeCheck className="size-3.5" aria-hidden />
              {h.demoVerified}
            </p>
            <p className="mt-1.5 text-[0.95rem] text-ink">{h.demoLine1}</p>
            <p className="mt-2 font-mono text-[0.7rem] text-subtle" aria-hidden>
              {h.demoFact} F4
            </p>
          </li>
          <li className="rounded-xl border border-warn-line bg-warn-soft/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
              <PenLine className="size-3.5" aria-hidden />
              {h.demoNeeds}
            </p>
            <p className="mt-1.5 text-[0.95rem] text-ink">
              {h.demoLine2a}
              <mark className="ph whitespace-nowrap">{h.demoLine2b}</mark>
            </p>
          </li>
          <li className="rounded-xl border border-line p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
              <CircleSlash className="size-3.5" aria-hidden />
              {h.demoRemoved}
            </p>
            <p className="mt-1.5 text-[0.95rem] text-subtle line-through decoration-danger/50">{h.demoLine3}</p>
          </li>
        </ul>
      </div>
      <figcaption className="mt-3 text-center text-xs text-subtle">{h.demoLabel}</figcaption>
    </figure>
  );
}
