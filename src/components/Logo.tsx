import { useI18n } from "../i18n";

/** Compass mark + wordmark. The name comes from shared/brand.ts via the dictionary. */
export function Logo({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span className={className ? `inline-flex items-center gap-2.5 ${className}` : "inline-flex items-center gap-2.5"}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-primary" />
        <circle cx="16" cy="16" r="9" fill="none" className="stroke-primary-fg" strokeWidth="1.5" opacity="0.85" />
        <path d="M16 8.5 18.6 16 16 23.5 13.4 16Z" className="fill-primary-fg" />
        <path d="M16 8.5 18.6 16h-5.2Z" className="fill-gold" />
      </svg>
      <span className="text-[1.15rem] font-semibold text-ink">{t.brand}</span>
    </span>
  );
}
