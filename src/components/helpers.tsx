import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { BRAND_NAME } from "../../shared/brand";
import { useI18n } from "../i18n";

/** Fade-and-rise on first scroll into view. Content is visible without JS and with reduced motion. */
export function Reveal({ children, className, delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Only content that starts below the fold is hidden until scrolled to; anything already on screen,
    // old browsers and reduced-motion users get it immediately.
    const belowFold = el.getBoundingClientRect().top > window.innerHeight * 0.92;
    if (!belowFold || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("reveal");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          window.setTimeout(() => el.classList.add("is-in"), delay);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  if (as === "li") {
    return (
      <li ref={ref as React.RefObject<HTMLLIElement>} className={className}>
        {children}
      </li>
    );
  }
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}

/** Renders text, turning [[...]] placeholders into highlighted "fill me in" chips. Never uses innerHTML. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^[\]]{1,160}\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[[") && p.endsWith("]]") ? (
          <mark key={i} className={p.length <= 34 ? "ph whitespace-nowrap" : "ph"}>
            {p.slice(2, -2).trim()}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function useTitle(title: string) {
  const { lang } = useI18n();
  useEffect(() => {
    document.title = title.includes(BRAND_NAME[lang]) ? title : `${title} · ${BRAND_NAME[lang]}`;
  }, [title, lang]);
}
