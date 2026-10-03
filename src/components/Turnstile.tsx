import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: Record<string, unknown>): string;
      reset(id?: string): void;
      remove(id?: string): void;
    };
    __tsLoading?: Promise<void>;
  }
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  window.__tsLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      window.__tsLoading = undefined;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return window.__tsLoading;
}

/** Cloudflare Turnstile widget. Tokens are single-use: call the returned reset after each run. */
export function Turnstile({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (t: string | null) => void; resetKey: number }) {
  const { t, lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const cb = useRef(onToken);
  useLayoutEffect(() => {
    cb.current = onToken;
  });

  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    onTokenSafe(null);
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        ref.current.innerHTML = "";
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          language: lang,
          theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          size: "flexible",
          callback: (tok: string) => cb.current(tok),
          "expired-callback": () => cb.current(null),
          "error-callback": () => {
            cb.current(null);
            setState("failed");
          },
        });
        setState("ready");
      })
      .catch(() => !cancelled && setState("failed"));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
    function onTokenSafe(v: string | null) {
      cb.current(v);
    }
  }, [siteKey, lang, resetKey]);

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{t.tool.humanCheck}</p>
      <div ref={ref} className="min-h-[65px]" />
      {state === "loading" && <p className="text-sm text-muted">{t.tool.humanLoading}</p>}
      {state === "failed" && (
        <p className="text-sm text-danger" role="alert">
          {t.tool.humanFailed}
        </p>
      )}
    </div>
  );
}
