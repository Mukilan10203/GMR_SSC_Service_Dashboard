import type { ReactNode } from "react";
import Link from "next/link";
import type { Direction, ServiceId, Status, Trend } from "@/lib/domain/types";
import { cx, formatDelta, trendSentiment } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

export const serviceColor = (id: ServiceId | string) => `var(--color-svc-${id})`;

export const statusColor = (s: Status) =>
  s === "good" ? "var(--color-good)" : s === "warn" ? "var(--color-warn)" : "var(--color-bad)";

const STATUS_CLASS: Record<Status, string> = {
  good: "bg-good-soft text-good border-good-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  bad: "bg-bad-soft text-bad border-bad-line",
};

export const STATUS_LABEL: Record<Status, string> = {
  good: "On target",
  warn: "At risk",
  bad: "Off target",
};

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("card", padded && "p-5", className)}>{children}</section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  id,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4" id={id}>
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status vocabulary                                                   */
/* ------------------------------------------------------------------ */

export function StatusPill({
  status,
  children,
  size = "md",
}: {
  status: Status;
  children?: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        STATUS_CLASS[status],
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]",
      )}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: statusColor(status) }}
      />
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}

export function StatusDot({ status, title }: { status: Status; title?: string }) {
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: statusColor(status) }}
      title={title ?? STATUS_LABEL[status]}
      role="img"
      aria-label={title ?? STATUS_LABEL[status]}
    />
  );
}

const ARROW: Record<Trend, string> = { up: "↑", down: "↓", flat: "→" };

export function TrendPill({
  trend,
  value,
  direction = "higher-better",
  unit = "%",
  decimals = 1,
  label,
}: {
  trend: Trend;
  value: number;
  direction?: Direction;
  unit?: string;
  decimals?: number;
  label?: string;
}) {
  const sentiment = trendSentiment(trend, direction);
  const tone =
    sentiment === "good" ? "text-good" : sentiment === "bad" ? "text-bad" : "text-ink-3";
  return (
    <span className={cx("inline-flex items-center gap-1 text-[12px] font-medium tnum", tone)}>
      <span aria-hidden>{ARROW[trend]}</span>
      {formatDelta(value, decimals, unit)}
      {label && <span className="font-normal text-ink-4">{label}</span>}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "outline";
  className?: string;
}) {
  const tones = {
    neutral: "bg-neutral-soft text-ink-2 border-transparent",
    accent: "bg-accent-soft text-accent-strong border-accent-line",
    good: "bg-good-soft text-good border-good-line",
    warn: "bg-warn-soft text-warn border-warn-line",
    bad: "bg-bad-soft text-bad border-bad-line",
    outline: "bg-surface text-ink-2 border-line",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const PRIORITY_TONE = {
  critical: "bad",
  high: "warn",
  medium: "accent",
  low: "neutral",
} as const;

/* ------------------------------------------------------------------ */
/* Metric tiles                                                        */
/* ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  caption,
  delta,
  status,
  accent,
  chart,
  href,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  delta?: ReactNode;
  status?: Status;
  accent?: string;
  chart?: ReactNode;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <>
      {accent && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] rounded-l-[9px]"
          style={{ background: accent }}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {status && <StatusDot status={status} />}
      </div>
      <p
        className={cx(
          "metric mt-2.5 font-semibold tracking-[-0.02em] text-ink",
          emphasis ? "text-[30px] leading-8" : "text-[24px] leading-7",
        )}
      >
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        {delta}
        {caption && <span className="text-[12px] text-ink-4">{caption}</span>}
      </div>
      {chart && <div className="mt-3">{chart}</div>}
    </>
  );

  const className = cx(
    "card relative overflow-hidden p-4",
    href && "transition-shadow hover:shadow-raised focus-visible:shadow-raised block",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

/** Dense label/value row used inside cards and drawers. */
export function DataRow({
  label,
  value,
  hint,
  emphasis,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-baseline justify-between gap-4 py-2",
        emphasis && "border-t border-line-strong pt-2.5 font-semibold",
      )}
    >
      <div className="min-w-0">
        <p className={cx("text-[13px]", emphasis ? "text-ink" : "text-ink-2")}>{label}</p>
        {hint && <p className="mt-0.5 text-[11.5px] text-ink-4">{hint}</p>}
      </div>
      <p className={cx("tnum shrink-0 text-[13px] tabular-nums", emphasis ? "text-ink" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("-mx-5 overflow-x-auto px-5", className)}>
      <table className="w-full min-w-[560px] border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
  scope = "col",
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={cx(
        "border-b border-line bg-surface-sunken px-3 py-2.5 text-[11px] font-semibold tracking-[0.05em] text-ink-3 uppercase first:rounded-l-md last:rounded-r-md",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  muted,
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  muted?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cx(
        "border-b border-line-soft px-3 py-3 align-middle",
        align === "right" && "text-right tnum",
        align === "center" && "text-center",
        muted ? "text-ink-3" : "text-ink",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function ProgressBar({
  value,
  max = 100,
  color = "var(--color-accent)",
  height = 6,
  track = "var(--color-line-soft)",
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  track?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: track }}
      role="img"
      aria-label={label ?? `${pct.toFixed(0)} percent`}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function ServiceGlyph({
  serviceId,
  code,
  size = 36,
}: {
  serviceId: ServiceId;
  code: string;
  size?: number;
}) {
  // Codes are short by design; only the two-word one needs abbreviating.
  const short = code === "HR Ops" ? "HR" : code;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-semibold"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${serviceColor(serviceId)} 12%, white)`,
        color: serviceColor(serviceId),
        fontSize: short.length > 2 ? 11 : 12.5,
        letterSpacing: "-0.01em",
      }}
      aria-hidden
    >
      {short}
    </span>
  );
}

/** Consistent framing for the "this is demo data" disclosure. */
export function PrototypeNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11.5px] leading-relaxed text-ink-4">
      <span className="font-medium text-ink-3">Prototype data.</span> {children}
    </p>
  );
}

export function SourceTag({ system }: { system: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink-4">
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden fill="none">
        <ellipse cx="6" cy="3" rx="4.5" ry="1.8" stroke="currentColor" strokeWidth="1.1" />
        <path d="M1.5 3v6c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V3" stroke="currentColor" strokeWidth="1.1" />
        <path d="M1.5 6c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8" stroke="currentColor" strokeWidth="1.1" />
      </svg>
      {system}
    </span>
  );
}
