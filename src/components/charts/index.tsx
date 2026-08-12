"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/format";

/**
 * Hand-rolled SVG charts.
 *
 * Deliberately no charting library: this dashboard needs a handful of very
 * specific marks (actual-vs-forecast lines, budget overlays, bullet gauges)
 * and a consistent, restrained visual language. Everything measures its own
 * container so strokes stay 1px crisp at any width.
 */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const AXIS = "var(--color-line)";
const GRID = "var(--color-line-soft)";
const LABEL = "var(--color-ink-4)";

/** Nice round tick values covering [0, max]. */
function ticks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  return out;
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

function Tooltip({
  x,
  y,
  children,
  containerWidth,
}: {
  x: number;
  y: number;
  children: ReactNode;
  containerWidth: number;
}) {
  const clampedLeft = Math.max(8, Math.min(containerWidth - 8, x));
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[12px] whitespace-nowrap shadow-pop"
      style={{ left: clampedLeft, top: y - 10 }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({
  values,
  width = 92,
  height = 26,
  color = "var(--color-accent)",
  area = true,
  strokeWidth = 1.5,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  area?: boolean;
  strokeWidth?: number;
}) {
  const gid = useId().replace(/:/g, "");
  if (values.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const fill = `${line} L${pts[pts.length - 1][0].toFixed(2)},${height} L${pts[0][0].toFixed(2)},${height} Z`;

  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      {area && (
        <>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#spark-${gid})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Trend chart — actual line + dashed forecast + optional budget        */
/* ------------------------------------------------------------------ */

export interface TrendPoint {
  label: string;
  value: number;
  isActual: boolean;
  budget?: number;
}

export function TrendChart({
  data,
  format,
  height = 210,
  color = "var(--color-accent)",
  budgetLabel = "Budget",
  valueLabel = "Actual",
  zeroAnchored = true,
  showForecastBand = true,
}: {
  data: TrendPoint[];
  format: (n: number) => string;
  height?: number;
  color?: string;
  budgetLabel?: string;
  valueLabel?: string;
  zeroAnchored?: boolean;
  showForecastBand?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const padL = 52;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;

  const hasBudget = data.some((d) => d.budget != null);
  const allValues = [...data.map((d) => d.value), ...data.map((d) => d.budget ?? 0)];
  const rawMax = Math.max(...allValues, 1);
  const rawMin = zeroAnchored ? 0 : Math.min(...data.map((d) => d.value)) * 0.985;
  const tickVals = zeroAnchored ? ticks(rawMax * 1.08) : [];
  const yMax = zeroAnchored ? Math.max(...tickVals) : rawMax * 1.01;
  const yMin = zeroAnchored ? 0 : rawMin;
  const yTicks = zeroAnchored
    ? tickVals
    : Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) * i) / 3);

  const x = (i: number) => padL + (data.length === 1 ? plotW / 2 : (i * plotW) / (data.length - 1));
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const lastActual = data.reduce((acc, d, i) => (d.isActual ? i : acc), 0);
  const actualPts = data.slice(0, lastActual + 1);
  const forecastPts = data.slice(lastActual);

  const path = (pts: TrendPoint[], offset: number) =>
    pts
      .map((d, i) => `${i === 0 ? "M" : "L"}${x(i + offset).toFixed(2)},${y(d.value).toFixed(2)}`)
      .join(" ");

  const areaPath =
    actualPts.length > 1
      ? `${path(actualPts, 0)} L${x(lastActual).toFixed(2)},${(padT + plotH).toFixed(2)} L${x(0).toFixed(
          2,
        )},${(padT + plotH).toFixed(2)} Z`
      : "";

  const hovered = hover != null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${valueLabel} trend across ${data.length} periods`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
            <pattern id={`hatch-${gid}`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="1" strokeOpacity="0.1" />
            </pattern>
          </defs>

          {/* Forecast region */}
          {showForecastBand && lastActual < data.length - 1 && (
            <rect
              x={x(lastActual)}
              y={padT}
              width={Math.max(0, x(data.length - 1) - x(lastActual))}
              height={plotH}
              fill={`url(#hatch-${gid})`}
            />
          )}

          {/* Gridlines */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={i === 0 && zeroAnchored ? AXIS : GRID} />
              <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill={LABEL}>
                {format(t)}
              </text>
            </g>
          ))}

          {/* Budget line */}
          {hasBudget && (
            <path
              d={data
                .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(d.budget ?? 0).toFixed(2)}`)
                .join(" ")}
              fill="none"
              stroke="var(--color-ink-4)"
              strokeWidth="1.25"
              strokeDasharray="3 3"
              opacity={0.7}
            />
          )}

          {areaPath && <path d={areaPath} fill={`url(#area-${gid})`} />}

          {forecastPts.length > 1 && (
            <path d={path(forecastPts, lastActual)} fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 4" opacity={0.55} />
          )}
          {actualPts.length > 1 && (
            <path d={path(actualPts, 0)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Hover affordances */}
          {data.map((d, i) => (
            <g key={i}>
              {hover === i && (
                <>
                  <line x1={x(i)} x2={x(i)} y1={padT} y2={padT + plotH} stroke={color} strokeOpacity="0.25" />
                  <circle cx={x(i)} cy={y(d.value)} r={4} fill="var(--color-surface)" stroke={color} strokeWidth="2" />
                </>
              )}
              <rect
                x={x(i) - plotW / (data.length * 2)}
                y={padT}
                width={plotW / data.length}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}

          {/* X labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10.5"
              fill={d.isActual ? LABEL : "var(--color-ink-4)"}
              opacity={d.isActual ? 1 : 0.65}
            >
              {d.label}
            </text>
          ))}
        </svg>
      )}

      {hovered && hover != null && (
        <Tooltip x={x(hover)} y={y(hovered.value)} containerWidth={width}>
          <p className="mb-1 font-semibold text-ink">{hovered.label}</p>
          <p className="flex items-center gap-2 text-ink-2">
            <span className="size-2 rounded-full" style={{ background: color }} />
            {valueLabel}
            <span className="ml-auto pl-3 font-semibold text-ink tnum">{format(hovered.value)}</span>
          </p>
          {hovered.budget != null && (
            <p className="mt-0.5 flex items-center gap-2 text-ink-2">
              <span className="h-0 w-2 border-t border-dashed border-ink-4" />
              {budgetLabel}
              <span className="ml-auto pl-3 tnum">{format(hovered.budget)}</span>
            </p>
          )}
          {!hovered.isActual && <p className="mt-1 text-[11px] text-ink-4">Forecast</p>}
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Column chart                                                        */
/* ------------------------------------------------------------------ */

export function ColumnChart({
  data,
  format,
  height = 200,
  color = "var(--color-accent)",
  valueLabel = "Volume",
}: {
  data: { label: string; value: number; isActual?: boolean }[];
  format: (n: number) => string;
  height?: number;
  color?: string;
  valueLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 52;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;

  const tickVals = ticks(Math.max(...data.map((d) => d.value), 1) * 1.08);
  const yMax = Math.max(...tickVals);
  const y = (v: number) => padT + (1 - v / yMax) * plotH;

  const slot = plotW / Math.max(1, data.length);
  const barW = Math.min(30, slot * 0.6);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${valueLabel} by period`} onMouseLeave={() => setHover(null)}>
          {tickVals.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={i === 0 ? AXIS : GRID} />
              <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill={LABEL}>
                {format(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx0 = padL + slot * i + slot / 2;
            const h = Math.max(1, plotH - (y(d.value) - padT));
            const isForecast = d.isActual === false;
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
                <rect
                  x={cx0 - barW / 2}
                  y={y(d.value)}
                  width={barW}
                  height={h}
                  rx={2.5}
                  fill={color}
                  fillOpacity={isForecast ? 0.32 : hover === i ? 1 : 0.88}
                  stroke={isForecast ? color : "none"}
                  strokeOpacity={isForecast ? 0.5 : 0}
                  strokeDasharray={isForecast ? "3 2" : undefined}
                />
                <text x={cx0} y={height - 8} textAnchor="middle" fontSize="10.5" fill={LABEL} opacity={isForecast ? 0.65 : 1}>
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && data[hover] && (
        <Tooltip x={padL + slot * hover + slot / 2} y={y(data[hover].value)} containerWidth={width}>
          <p className="mb-0.5 font-semibold text-ink">{data[hover].label}</p>
          <p className="text-ink-2">
            {valueLabel} <span className="ml-2 font-semibold text-ink tnum">{format(data[hover].value)}</span>
          </p>
          {data[hover].isActual === false && <p className="mt-1 text-[11px] text-ink-4">Forecast</p>}
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked columns                                                     */
/* ------------------------------------------------------------------ */

export function StackedColumns({
  labels,
  series,
  format,
  height = 240,
  actualFlags,
}: {
  labels: string[];
  series: { key: string; label: string; color: string; values: number[] }[];
  format: (n: number) => string;
  height?: number;
  actualFlags?: boolean[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 52;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;

  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const tickVals = ticks(Math.max(...totals, 1) * 1.08);
  const yMax = Math.max(...tickVals);
  const y = (v: number) => padT + (1 - v / yMax) * plotH;

  const slot = plotW / Math.max(1, labels.length);
  const barW = Math.min(34, slot * 0.62);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Billing by service across the year" onMouseLeave={() => setHover(null)}>
          {tickVals.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={i === 0 ? AXIS : GRID} />
              <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill={LABEL}>
                {format(t)}
              </text>
            </g>
          ))}

          {labels.map((label, i) => {
            const cx0 = padL + slot * i + slot / 2;
            const isForecast = actualFlags ? !actualFlags[i] : false;
            let acc = 0;
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
                {series.map((s) => {
                  const v = s.values[i] ?? 0;
                  const y0 = y(acc + v);
                  const h = Math.max(0, y(acc) - y0);
                  acc += v;
                  return (
                    <rect
                      key={s.key}
                      x={cx0 - barW / 2}
                      y={y0}
                      width={barW}
                      height={h}
                      fill={s.color}
                      fillOpacity={isForecast ? 0.34 : hover === i ? 1 : 0.9}
                    />
                  );
                })}
                <text x={cx0} y={height - 8} textAnchor="middle" fontSize="10.5" fill={LABEL} opacity={isForecast ? 0.65 : 1}>
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && (
        <Tooltip x={padL + slot * hover + slot / 2} y={y(totals[hover])} containerWidth={width}>
          <p className="mb-1.5 font-semibold text-ink">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-2 text-ink-2">
              <span className="size-2 shrink-0 rounded-sm" style={{ background: s.color }} />
              {s.label}
              <span className="ml-auto pl-4 tnum text-ink">{format(s.values[hover] ?? 0)}</span>
            </p>
          ))}
          <p className="mt-1.5 flex items-center gap-2 border-t border-line pt-1.5 font-semibold text-ink">
            Total
            <span className="ml-auto pl-4 tnum">{format(totals[hover])}</span>
          </p>
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut                                                               */
/* ------------------------------------------------------------------ */

export function DonutChart({
  segments,
  format,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  segments: { key: string; label: string; value: number; color: string }[];
  format: (n: number) => string;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((s) => {
    const frac = s.value / total;
    const arc = { ...s, frac, dash: frac * circumference, offset };
    offset += frac * circumference;
    return arc;
  });

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} role="img" aria-label={centerLabel ?? "Composition"} className="shrink-0">
        <g transform={`rotate(-90 ${c} ${c})`}>
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.key ? thickness + 3 : thickness}
              strokeDasharray={`${Math.max(0, a.dash - 1.5)} ${circumference}`}
              strokeDashoffset={-a.offset}
              onMouseEnter={() => setHover(a.key)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: "stroke-width 120ms ease" }}
            />
          ))}
        </g>
        {centerValue && (
          <text x={c} y={c - 2} textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--color-ink)" className="tnum">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={c} y={c + 15} textAnchor="middle" fontSize="10.5" fill={LABEL}>
            {centerLabel}
          </text>
        )}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {arcs.map((a) => (
          <li
            key={a.key}
            className={cx(
              "flex items-center gap-2 rounded px-1.5 py-1 text-[12.5px] transition-colors",
              hover === a.key && "bg-surface-sunken",
            )}
            onMouseEnter={() => setHover(a.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: a.color }} />
            <span className="min-w-0 truncate text-ink-2">{a.label}</span>
            <span className="ml-auto shrink-0 pl-2 font-medium text-ink tnum">{format(a.value)}</span>
            <span className="w-10 shrink-0 text-right text-ink-4 tnum">{(a.frac * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bar list                                                 */
/* ------------------------------------------------------------------ */

export function HBarList({
  items,
  format,
  showShare = false,
}: {
  items: { key: string; label: string; value: number; color?: string; sublabel?: string }[];
  format: (n: number) => string;
  showShare?: boolean;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] text-ink-2">
              {it.label}
              {it.sublabel && <span className="ml-2 text-[11.5px] text-ink-4">{it.sublabel}</span>}
            </span>
            <span className="shrink-0 text-[13px] font-medium text-ink tnum">
              {format(it.value)}
              {showShare && (
                <span className="ml-2 font-normal text-ink-4">{((it.value / total) * 100).toFixed(0)}%</span>
              )}
            </span>
          </div>
          <div className="h-[7px] w-full overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(Math.abs(it.value) / max) * 100}%`,
                background: it.color ?? "var(--color-accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Bullet gauge — actual against target                                */
/* ------------------------------------------------------------------ */

export function BulletGauge({
  actual,
  target,
  direction,
  color,
  format,
  scaleMax,
  scaleMin = 0,
}: {
  actual: number;
  target: number;
  direction: "higher-better" | "lower-better";
  color: string;
  format: (n: number) => string;
  scaleMax?: number;
  scaleMin?: number;
}) {
  const max = scaleMax ?? Math.max(actual, target) * 1.25;
  const span = max - scaleMin || 1;
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - scaleMin) / span) * 100))}%`;

  return (
    <div className="w-full">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-line-soft">
        {/* Acceptable region relative to target */}
        <div
          className="absolute inset-y-0 rounded-full opacity-[0.16]"
          style={
            direction === "higher-better"
              ? { left: pos(target), right: 0, background: "var(--color-good)" }
              : { left: 0, width: pos(target), background: "var(--color-good)" }
          }
        />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pos(actual), background: color }} />
      </div>
      <div className="relative mt-1.5 h-4">
        <div
          className="absolute top-0 -translate-x-1/2 text-[10.5px] whitespace-nowrap text-ink-4"
          style={{ left: pos(target) }}
        >
          <span className="mr-1 inline-block h-2 w-px translate-y-[-9px] bg-ink-4 align-middle" />
          Target {format(target)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quarter strip — small periodic series (NPS)                         */
/* ------------------------------------------------------------------ */

export function QuarterStrip({
  points,
}: {
  points: { label: string; value: number; isPartial?: boolean }[];
}) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;

  return (
    <ul className="flex items-end gap-2">
      {points.map((p) => {
        const h = 12 + ((p.value - min) / span) * 40;
        return (
          <li key={p.label} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[13px] font-semibold text-ink tnum">
              {p.value >= 0 ? "+" : ""}
              {p.value}
            </span>
            <div
              className="w-full rounded-t-[3px]"
              style={{
                height: h,
                background: p.isPartial
                  ? "color-mix(in srgb, var(--color-accent) 38%, white)"
                  : "var(--color-accent)",
              }}
            />
            <span className="text-[11px] whitespace-nowrap text-ink-4">
              {p.label}
              {p.isPartial && <span className="ml-0.5">*</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
