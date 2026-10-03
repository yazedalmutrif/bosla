import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Languages, Menu, Moon, Sun, X } from "lucide-react";
import { useI18n } from "../i18n";
import { useTheme } from "../lib/theme";
import { Logo } from "./Logo";
import { buttonClass, cn } from "./ui";

export function Header() {
  const { t, toggle } = useI18n();
  const { toggle: toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const [path, setPath] = useState(loc.pathname);
  if (path !== loc.pathname) {
    // Navigated: close the mobile menu (adjusting state during render, as React recommends).
    setPath(loc.pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    { to: "/tailor", label: t.nav.tailor },
    { to: "/map", label: t.nav.map },
    { to: "/about", label: t.nav.about },
  ];

  const navCls = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-lg px-3 py-2 text-[0.95rem] font-medium transition-colors duration-200", isActive ? "text-ink bg-surface-2" : "text-muted hover:text-ink");

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {t.skip}
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label={t.nav.home} className="rounded-lg">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button onClick={toggle} className={buttonClass("ghost", "sm", "gap-1.5")} aria-label={t.nav.langSwitch} lang={t.otherLangName === "English" ? "en" : "ar"}>
            <Languages className="size-4" aria-hidden />
            <span>{t.otherLangName}</span>
          </button>
          {/* Icon follows the CSS theme, so prerendered HTML and the client always agree. */}
          <button onClick={toggleTheme} className={buttonClass("ghost", "sm", "size-10 px-0")} aria-label={t.nav.theme}>
            <Sun className="hidden size-[1.1rem] dark:block" aria-hidden />
            <Moon className="size-[1.1rem] dark:hidden" aria-hidden />
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className={buttonClass("ghost", "sm", "size-10 px-0 md:hidden")}
            aria-label={open ? t.nav.close : t.nav.menu}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-line bg-bg md:hidden" aria-label="Main">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cn(navCls({ isActive }), "py-3 text-base")}>
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/privacy" className={({ isActive }) => cn(navCls({ isActive }), "py-3 text-base")}>
              {t.nav.privacy}
            </NavLink>
          </div>
        </nav>
      )}
    </header>
  );
}
