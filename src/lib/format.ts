import type { MetricFormat, Status, Trend, Direction } from "./domain/types";

const inr = new Intl.NumberFormat("en-IN");
const inr1 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CRORE = 1_00_00_000;
const LAKH = 1_00_000;

/** Indian digit grouping: 1024000 -> "10,24,000" */
export function formatNumber(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return "—";
  if (decimals === 1) return inr1.format(n);
  if (decimals === 2) return inr2.format(n);
  return inr.format(Math.round(n));
}

/**
 * Money in the lakh/crore convention a CFO in India actually reads.
 * ₹5,16,42,180 -> "₹5.16 Cr"   ₹45,07,500 -> "₹45.08 L"   ₹8,240 -> "₹8,240"
 */
export function formatMoney(n: number, opts: { compact?: boolean; sign?: boolean } = {}): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : opts.sign && n > 0 ? "+" : "";
  const abs = Math.abs(n);

  if (abs >= CRORE) {
    const v = abs / CRORE;
    return `${sign}₹${v >= 100 ? inr1.format(v) : inr2.format(v)} Cr`;
  }
  if (abs >= LAKH) {
    return `${sign}₹${inr2.format(abs / LAKH)} L`;
  }
  if (abs >= 1000 || !opts.compact) {
    return `${sign}₹${inr.format(Math.round(abs))}`;
  }
  return `${sign}₹${inr.format(Math.round(abs))}`;
}

/** Unit suffix only — for axis ticks where the ₹ is in the axis label. */
export function formatMoneyAxis(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= CRORE) return `${sign}${inr1.format(abs / CRORE)}Cr`;
  if (abs >= LAKH) return `${sign}${inr1.format(abs / LAKH)}L`;
  if (abs >= 1000) return `${sign}${inr.format(Math.round(abs / 1000))}k`;
  return `${sign}${inr.format(Math.round(abs))}`;
}

export function formatPercent(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(decimals)}%`;
}

export function formatDelta(n: number, decimals = 1, unit = "%"): string {
  if (!Number.isFinite(n)) return "—";
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${Math.abs(n).toFixed(decimals)}${unit}`;
}

export function formatMetric(value: number, format: MetricFormat): string {
  switch (format) {
    case "currency":
      return formatMoney(value);
    case "percent":
      return formatPercent(value);
    case "days":
      return `${value.toFixed(1)} days`;
    case "hours":
      return `${formatNumber(value)} hrs`;
    case "score":
      return `${value.toFixed(1)} / 5`;
    case "ratio":
      return `${value.toFixed(2)}×`;
    default:
      return formatNumber(value);
  }
}

export function formatCompactNumber(n: number): string {
  if (Math.abs(n) >= 1_00_000) return `${inr1.format(n / 1000)}k`;
  if (Math.abs(n) >= 10_000) return `${inr1.format(n / 1000)}k`;
  return inr.format(Math.round(n));
}

/* ------------------------------------------------------------------ */
/* Status logic                                                        */
/* ------------------------------------------------------------------ */

/**
 * Grade an actual against a target. `amberBandPct` is how far past target
 * still counts as amber rather than red (as a fraction of the target).
 */
export function gradeAgainstTarget(
  actual: number,
  target: number,
  direction: Direction,
  amberBandPct = 0.05,
): Status {
  const band = Math.abs(target) * amberBandPct;
  if (direction === "higher-better") {
    if (actual >= target) return "good";
    if (actual >= target - band) return "warn";
    return "bad";
  }
  if (actual <= target) return "good";
  if (actual <= target + band) return "warn";
  return "bad";
}

export function trendFrom(current: number, previous: number, epsilonPct = 0.75): Trend {
  if (!previous) return "flat";
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (pct > epsilonPct) return "up";
  if (pct < -epsilonPct) return "down";
  return "flat";
}

/** Is a movement in this metric good news? Used to colour trend arrows. */
export function trendSentiment(trend: Trend, direction: Direction): Status | "neutral" {
  if (trend === "flat") return "neutral";
  const improving = direction === "higher-better" ? trend === "up" : trend === "down";
  return improving ? "good" : "bad";
}

export function pctChange(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2025-11-18" -> "18 Nov 2025". Pure string math — no timezone surprises. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

export function ageLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
