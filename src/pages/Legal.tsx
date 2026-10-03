import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import { useTitle } from "../components/helpers";
import { ButtonLink, Eyebrow } from "../components/ui";
import { useI18n } from "../i18n";

function Article({ title, updated, intro, children }: { title: string; updated?: string; intro?: string; children: ReactNode }) {
  return (
    <div className="container-page py-12 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <header className="space-y-3 border-b border-line pb-8">
          {updated && <Eyebrow>{updated}</Eyebrow>}
          <h1 className="text-3xl leading-tight font-semibold tracking-display text-ink sm:text-[2.6rem]">{title}</h1>
          {intro && <p className="text-lg text-muted">{intro}</p>}
        </header>
        <div className="space-y-9 pt-8">{children}</div>
      </article>
    </div>
  );
}

export function Privacy() {
  const { t } = useI18n();
  const P = t.privacy;
  useTitle(P.title);
  return (
    <Article title={P.title} updated={P.updated} intro={P.intro}>
      {P.sections.map((s) => (
        <section key={s.h} className="space-y-3">
          <h2 className="text-xl font-semibold text-ink">{s.h}</h2>
          {s.p.map((x) => (
            <p key={x} className="leading-relaxed text-muted">
              {x}
            </p>
          ))}
        </section>
      ))}
    </Article>
  );
}

export function Terms() {
  const { t } = useI18n();
  const T = t.terms;
  useTitle(T.title);
  return (
    <Article title={T.title} updated={T.updated} intro={T.intro}>
      <ol className="space-y-6">
        {T.points.map((p, i) => (
          <li key={p.h} className="flex gap-4">
            <span className="font-mono text-sm text-subtle">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="font-semibold text-ink">{p.h}</h2>
              <p className="mt-1 leading-relaxed text-muted">{p.p}</p>
            </div>
          </li>
        ))}
      </ol>
    </Article>
  );
}

export function About() {
  const { t, dir } = useI18n();
  const A = t.about;
  useTitle(A.title);
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  return (
    <Article title={A.title}>
      <div className="space-y-5 text-lg leading-relaxed text-muted">
        <p>{A.p1}</p>
        <p>{A.p2}</p>
        <p>{A.p3}</p>
      </div>
      <section className="card p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-ink">{A.methodTitle}</h2>
        <ul className="mt-4 space-y-3">
          {A.method.map((m) => (
            <li key={m} className="flex gap-3 text-ink">
              <Check className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
              {m}
            </li>
          ))}
        </ul>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/tailor">
          {t.home.ctaTailor}
          <Arrow className="size-4" aria-hidden />
        </ButtonLink>
        <ButtonLink to="/map" variant="secondary">
          {t.home.ctaMap}
        </ButtonLink>
      </div>
    </Article>
  );
}

export function NotFound() {
  const { t } = useI18n();
  useTitle(t.notFound.title);
  return (
    <Article title={t.notFound.title} intro={t.notFound.body}>
      <ButtonLink to="/">{t.notFound.home}</ButtonLink>
    </Article>
  );
}
