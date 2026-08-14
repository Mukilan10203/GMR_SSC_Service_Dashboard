"use client";

import { useState } from "react";

import Link from "next/link";
import type { ReactNode } from "react";
import type {
  ActivityMetric,
  AttentionItem,
  EntitySnapshot,
  ServiceDefinition,
  ServiceSnapshot,
} from "@/lib/domain/types";
import { billedTotal, billedTotalLabel, cx, formatMetric, formatMoney } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  ProgressBar,
  ServiceGlyph,
  serviceColor,
  StatusDot,
  StatusPill,
} from "@/components/ui/primitives";
import { Sparkline, TrendChart } from "@/components/charts";
import { IconChevron, IconLock } from "./icons";

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  back,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
        >
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1
            className="text-[32px] leading-[1.12] font-bold tracking-[-0.035em]"
            style={{ color: "var(--color-navy)" }}
          >
            {title}
          </h1>
          {subtitle && <div className="mt-1.5 text-[13.5px] text-ink-3">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Attention required                                                  */
/* ------------------------------------------------------------------ */

const SEVERITY_META = {
  critical: { label: "Critical", tone: "bad", dot: "bad" },
  warning: { label: "Watch", tone: "warn", dot: "warn" },
  info: { label: "Opportunity", tone: "accent", dot: "good" },
} as const;

export function AttentionCard({ item }: { item: AttentionItem }) {
  const meta = SEVERITY_META[item.severity];
  return (
    <Link
      href={item.href}
      className={cx(
        "group flex gap-3.5 rounded-lg border bg-surface p-4 transition-shadow hover:shadow-raised",
        item.severity === "critical"
          ? "border-bad-line"
          : item.severity === "warning"
            ? "border-warn-line"
            : "border-line",
      )}
    >
      <span
        aria-hidden
        className="mt-1 size-2.5 shrink-0 rounded-full"
        style={{
          background:
            item.severity === "critical"
              ? "var(--color-bad)"
              : item.severity === "warning"
                ? "var(--color-warn)"
                : "var(--color-accent)",
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {item.serviceId && <Badge tone="outline">{item.serviceId.toUpperCase()}</Badge>}
        </div>
        <p className="text-[13.5px] leading-snug font-semibold text-ink">{item.title}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{item.detail}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
          {item.actual && (
            <span className="text-[12px] text-ink-3">
              {item.metricLabel ?? "Actual"}{" "}
              <span className="font-semibold text-ink tnum">{item.actual}</span>
            </span>
          )}
          {item.target && (
            <span className="text-[12px] text-ink-3">
              Target <span className="font-medium text-ink-2 tnum">{item.target}</span>
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-accent">
            {item.action}
            <IconChevron size={12} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function AttentionSection({
  items,
  limit = 5,
  showAllHref,
}: {
  items: AttentionItem[];
  limit?: number;
  showAllHref?: string;
}) {
  const critical = items.filter((i) => i.severity === "critical").length;
  const warning = items.filter((i) => i.severity === "warning").length;
  const shown = items.slice(0, limit);

  return (
    <section id="attention" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-bold tracking-[-0.025em]" style={{ color: "var(--color-navy)" }}>
            Attention required
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {critical > 0
              ? `${critical} ${critical === 1 ? "item needs a decision" : "items need decisions"}`
              : "Nothing critical"}
            {warning > 0 && `, ${warning} to watch`}. Ordered by severity, not by date.
          </p>
        </div>
        {showAllHref && items.length > limit && (
          <Link href={showAllHref} className="text-[12.5px] font-medium text-accent hover:text-accent-strong">
            View all {items.length} items →
          </Link>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((item) => (
          <AttentionCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Service card                                                        */
/* ------------------------------------------------------------------ */

export function ServiceCard({ service }: { service: ServiceSnapshot }) {
  const s = service.service;
  const color = serviceColor(s.id);

  return (
    <Link
      href={`/services/${s.id}`}
      className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-raised"
    >
      <span aria-hidden className="h-[3px] w-full" style={{ background: color }} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <ServiceGlyph serviceId={s.id} code={s.code} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-tight font-semibold text-ink">{s.code}</p>
            <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{s.name}</p>
          </div>
          <StatusPill status={service.sla.status} size="sm">
            {service.sla.overall.toFixed(1)}%
          </StatusPill>
        </div>

        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">{s.tagline}</p>

        <dl className="mt-4 space-y-2.5 border-t border-line-soft pt-4">
          {service.headline.map((m) => (
            <div key={m.id} className="flex items-baseline justify-between gap-3">
              <dt className="text-[12.5px] text-ink-3">{m.label}</dt>
              <dd className="flex items-center gap-2">
                {m.series && m.series.length > 3 && (
                  <Sparkline values={m.series} width={54} height={16} color={color} area={false} />
                )}
                <span className="text-[13.5px] font-semibold text-ink tnum">
                  {formatMetric(m.value, m.format)}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 border-t border-line-soft pt-3.5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11.5px] text-ink-4">Contracted capacity used</span>
            <span className="text-[11.5px] font-medium text-ink-2 tnum">
              {(service.utilisation * 100).toFixed(0)}%
            </span>
          </div>
          <ProgressBar
            value={Math.min(100, service.utilisation * 100)}
            color={service.utilisation > 1 ? "var(--color-warn)" : color}
            height={5}
            label={`${(service.utilisation * 100).toFixed(0)}% of contracted capacity`}
          />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3.5">
          <span className="flex items-center gap-2 text-[12px] text-ink-4">
            {service.issueIds.length > 0 ? (
              <>
                <StatusDot
                  status={
                    service.kpis.some((k) => k.status === "bad")
                      ? "bad"
                      : service.kpis.some((k) => k.status === "warn")
                        ? "warn"
                        : "good"
                  }
                />
                {service.issueIds.length} open item{service.issueIds.length > 1 ? "s" : ""}
              </>
            ) : (
              <>
                <StatusDot status="good" />
                No open items
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
            View details
            <IconChevron size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Full-page lock screen for capabilities not yet available in this preview. */
export function LockedPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-[720px] py-24 text-center">
      <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-neutral-soft text-ink-3">
        <IconLock size={22} />
      </span>
      <h1 className="text-[20px] font-semibold text-ink">{title} is locked</h1>
      <p className="mt-2 text-[13.5px] text-ink-3">Not yet available in this preview.</p>
      <Link
        href="/overview"
        className="mt-6 inline-block btn-cta px-4 py-2.5 text-[13px] hover:-translate-y-px"
      >
        Back to overview
      </Link>
    </div>
  );
}

/** A contracted tower not yet wired up in this build — shown, not hidden. */
export function LockedServiceCard({ service }: { service: ServiceDefinition }) {
  return (
    <div
      className="card flex flex-col overflow-hidden opacity-60"
      aria-disabled
      title={`${service.name} — coming soon`}
    >
      <span aria-hidden className="h-[3px] w-full bg-line-strong" />
      <div className="flex flex-1 flex-col items-start p-5">
        <div className="flex w-full items-start gap-3">
          <ServiceGlyph serviceId={service.id} code={service.code} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-tight font-semibold text-ink-3">{service.code}</p>
            <p className="mt-0.5 truncate text-[12.5px] text-ink-4">{service.name}</p>
          </div>
          <Badge tone="outline" className="gap-1">
            <IconLock size={11} />
            Locked
          </Badge>
        </div>
        <p className="mt-6 text-[12px] text-ink-4">This service is not yet available in this preview.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metric grid                                                         */
/* ------------------------------------------------------------------ */

export function MetricGrid({
  metrics,
  color = "var(--color-accent)",
  columns = 5,
}: {
  metrics: ActivityMetric[];
  color?: string;
  columns?: 3 | 4 | 5;
}) {
  const cols =
    columns === 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

  return (
    <div className={cx("grid gap-3", cols)}>
      {metrics.map((m) => (
        <div key={m.id} className="card p-4">
          <p className="eyebrow-muted">{m.label}</p>
          <p className="metric mt-2 text-[21px] leading-7 font-semibold tracking-[-0.02em] text-ink">
            {formatMetric(m.value, m.format)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {m.caption && <span className="text-[11.5px] text-ink-4">{m.caption}</span>}
          </div>
          {m.series && m.series.length > 3 && (
            <div className="mt-2.5">
              <Sparkline values={m.series} width={120} height={22} color={color} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scope banner used at the top of the executive dashboard             */
/* ------------------------------------------------------------------ */

export function WelcomeHeader({
  snapshot,
  userName,
  role,
}: {
  snapshot: EntitySnapshot;
  userName: string;
  role: string;
}) {
  return (
    <Card className="mb-6 overflow-hidden !p-0">
      <div className="flex flex-wrap items-start justify-between gap-6 p-6">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-3">
            Welcome back, <span className="font-medium text-ink-2">{userName}</span>
          </p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.022em] text-ink">
            {snapshot.entity.name}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
            <span>{snapshot.location.name}</span>
            <span aria-hidden className="text-ink-4">·</span>
            <span>{snapshot.entity.sector}</span>
            <span aria-hidden className="text-ink-4">·</span>
            <span>{role}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="eyebrow-muted">Reporting period</p>
            <p className="mt-1.5 text-[15px] font-semibold text-ink">{snapshot.period.label}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-4">{snapshot.period.range}</p>
          </div>
          <div>
            <p className="eyebrow-muted">Data as at</p>
            <p className="mt-1.5 text-[15px] font-semibold text-ink tnum">{snapshot.period.asOf}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-4">
              {snapshot.period.actualMonthCount} of 12 months closed
            </p>
          </div>
          <div>
            <p className="eyebrow-muted">Services consumed</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {snapshot.services.map((s) => (
                <span
                  key={s.service.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-2"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: serviceColor(s.service.id) }}
                  />
                  {s.service.code}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-sunken px-6 py-3">
        <p className="text-[12px] text-ink-3">
          Contract commenced {snapshot.entity.contractStart.split("-").reverse().join("/")} · Relationship
          manager {snapshot.entity.relationshipManager}
        </p>
        <p className="text-[12px] text-ink-3 tnum">
          {billedTotalLabel(snapshot.period.isCurrent)}{" "}
          <span className="font-semibold text-ink">
            {formatMoney(
              billedTotal(
                snapshot.period.isCurrent,
                snapshot.billing.ytd,
                snapshot.billing.fyForecast,
              ),
            )}
          </span>{" "}
          <span className="text-ink-4">
            ({snapshot.period.actualMonthCount} months closed to {snapshot.period.asOf})
          </span>
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Monthly trend card — line chart with a prior-year comparison toggle */
/* ------------------------------------------------------------------ */

export interface MonthlyPoint {
  label: string;
  value: number;
  isActual: boolean;
  budget?: number;
  prior?: number;
}

/**
 * Every monthly series in the portal renders through this, so the
 * compare-with-prior-year affordance is in the same place on every chart.
 */
export function MonthlyTrendCard({
  eyebrow,
  title,
  subtitle,
  data,
  format,
  color,
  height = 230,
  valueLabel = "Actual",
  compareLabel = "Prior year",
  zeroAnchored = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  data: MonthlyPoint[];
  format: (n: number) => string;
  color?: string;
  height?: number;
  valueLabel?: string;
  compareLabel?: string;
  zeroAnchored?: boolean;
}) {
  const [compare, setCompare] = useState(false);
  const hasPrior = data.some((d) => d.prior != null);

  return (
    <Card>
      <CardHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        action={
          hasPrior ? (
            <button
              type="button"
              onClick={() => setCompare((v) => !v)}
              aria-pressed={compare}
              className={cx(
                "rounded-md border px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors",
                compare
                  ? "border-accent-line bg-accent-soft text-accent-strong"
                  : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2",
              )}
            >
              Compare {compareLabel.toLowerCase()}
            </button>
          ) : undefined
        }
      />
      <TrendChart
        data={data.map((d) => ({
          label: d.label,
          value: d.value,
          isActual: d.isActual,
          budget: d.budget,
          compare: compare ? d.prior : undefined,
        }))}
        format={format}
        height={height}
        color={color}
        valueLabel={valueLabel}
        compareLabel={compareLabel}
        zeroAnchored={zeroAnchored}
      />
    </Card>
  );
}
