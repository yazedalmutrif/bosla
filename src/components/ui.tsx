import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "quiet";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:opacity-55 disabled:active:scale-100 select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_8px_20px_-10px_rgb(20_48_90/0.6)]",
  secondary: "bg-surface text-ink border border-line-strong hover:border-primary-text hover:text-primary-text",
  ghost: "text-ink hover:bg-surface-2",
  quiet: "text-primary-text hover:underline underline-offset-4 px-0",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(v: Variant = "primary", s: Size = "md", extra?: string) {
  return cn(base, variants[v], v === "quiet" ? "h-auto" : sizes[s], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 text-[0.8rem] font-medium text-primary-text", className)}>
      <span className="h-px w-6 bg-gold" aria-hidden />
      {children}
    </p>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "accent" | "warn" | "danger" | "primary"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-line",
    accent: "bg-accent-soft text-accent border-transparent",
    warn: "bg-warn-soft text-warn border-warn-line",
    danger: "bg-danger-soft text-danger border-transparent",
    primary: "bg-primary-soft text-primary-text border-transparent",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function Callout({ tone = "neutral", icon, title, children, className }: { tone?: "neutral" | "warn" | "danger" | "accent"; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 border-line text-ink",
    warn: "bg-warn-soft border-warn-line text-ink",
    danger: "bg-danger-soft border-danger/30 text-ink",
    accent: "bg-accent-soft border-accent/25 text-ink",
  } as const;
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-4 text-[0.95rem]", tones[tone], className)} role={tone === "danger" ? "alert" : undefined}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function SectionHeading({ eyebrow, title, lead, center }: { eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl space-y-3", center && "mx-auto text-center")}>
      {eyebrow && <Eyebrow className={center ? "justify-center" : undefined}>{eyebrow}</Eyebrow>}
      <h2 className="text-[1.75rem] leading-tight font-semibold tracking-display text-ink sm:text-4xl">{title}</h2>
      {lead && <p className="text-lg text-muted">{lead}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative flex min-h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-primary-text", className)} aria-hidden />;
}
