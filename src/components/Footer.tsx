import { Link } from "react-router";
import { useI18n } from "../i18n";
import { Logo } from "./Logo";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="no-print mt-24 border-t border-line bg-bg-soft">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-md text-sm text-muted">{t.footer.note}</p>
          <p className="text-sm text-muted">
            {t.footer.builtBy} {t.footer.poweredBy}
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-2 text-sm sm:justify-self-end" aria-label="Footer">
          <Link className="rounded py-1 text-muted hover:text-ink" to="/tailor">{t.nav.tailor}</Link>
          <Link className="rounded py-1 text-muted hover:text-ink" to="/privacy">{t.nav.privacy}</Link>
          <Link className="rounded py-1 text-muted hover:text-ink" to="/map">{t.nav.map}</Link>
          <Link className="rounded py-1 text-muted hover:text-ink" to="/terms">{t.nav.terms}</Link>
          <Link className="rounded py-1 text-muted hover:text-ink" to="/about">{t.nav.about}</Link>
        </nav>
      </div>
    </footer>
  );
}
