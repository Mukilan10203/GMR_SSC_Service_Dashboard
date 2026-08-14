"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  Feedback,
  Issue,
  Kpi,
  ServiceBilling,
  ServiceSla,
  SubServiceDetail,
} from "@/lib/domain/types";
import { SUB_SERVICE_BY_SLA_COMPONENT } from "@/lib/mock/organisation";
import {
  cx,
  formatDate,
  formatMetric,
  formatMoney,
  formatMoneyAxis,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  DataRow,
  PRIORITY_TONE,
  ProgressBar,
  SectionHeading,
  StatTile,
  StatusPill,
  Table,
  Td,
  Th,
  TrendPill,
  serviceColor,
} from "@/components/ui/primitives";
import { BulletGauge, HBarList, Sparkline, TrendChart } from "@/components/charts";
import { MonthlyTrendCard } from "./blocks";
import { IconChevron, IconChevronDown, IconClose } from "./icons";

/* ------------------------------------------------------------------ */
/* KPI card — with the KPI → issue → feedback chain                    */
/* ------------------------------------------------------------------ */

export function KpiCard({
  kpi,
  issues,
  feedback,
  color,
  groupChip,
  onOpen,
}: {
  kpi: Kpi;
  issues: Issue[];
  feedback: Feedback[];
  color: string;
  /** Subfunction label shown above the name when it adds information. */
  groupChip?: string;
  /** Opens the full trend view for this indicator. */
  onOpen?: (kpi: Kpi) => void;
}) {
  const [open, setOpen] = useState(false);
  const linkedIssues = issues.filter((i) => kpi.relatedIssueIds.includes(i.id));
  const linkedFeedback = feedback.filter((f) => kpi.relatedFeedbackIds.includes(f.id));
  const hasChain = linkedIssues.length > 0 || linkedFeedback.length > 0;

  const gap =
    kpi.direction === "higher-better"
      ? Math.max(0, kpi.target - kpi.actual)
      : Math.max(0, kpi.actual - kpi.target);

  const scaleMax =
    kpi.unit === "percent"
      ? 100
      : kpi.unit === "score"
        ? 5
        : Math.max(kpi.actual, kpi.target) * 1.35;

  return (
    <Card className={cx(kpi.status === "bad" && "border-bad-line")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {groupChip && <p className="eyebrow-muted mb-1">{groupChip}</p>}
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(kpi)}
              className="group/title text-left"
              title="Open trend detail"
            >
              <h3 className="text-[14px] leading-snug font-semibold text-ink group-hover/title:text-accent">
                {kpi.name}
                <IconChevron
                  size={12}
                  className="ml-1 inline-block align-middle text-ink-4 transition-transform group-hover/title:translate-x-0.5 group-hover/title:text-accent"
                />
              </h3>
            </button>
          ) : (
            <h3 className="text-[14px] leading-snug font-semibold text-ink">{kpi.name}</h3>
          )}
        </div>
        <StatusPill status={kpi.status} size="sm" />
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow-muted">Actual</p>
          <p className="metric mt-1 text-[27px] leading-8 font-semibold tracking-[-0.02em] text-ink">
            {formatMetric(kpi.actual, kpi.unit)}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow-muted">Target</p>
          <p className="mt-1 text-[15px] font-medium text-ink-2 tnum">
            {kpi.direction === "higher-better" ? "≥ " : "≤ "}
            {formatMetric(kpi.target, kpi.unit)}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow-muted">Trend</p>
          <div className="mt-1.5">
            <TrendPill
              trend={kpi.trend}
              value={kpi.deltaPct}
              direction={kpi.direction}
              label="MoM"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <BulletGauge
          actual={kpi.actual}
          target={kpi.target}
          direction={kpi.direction}
          color={kpi.status === "good" ? "var(--color-good)" : kpi.status === "warn" ? "var(--color-warn)" : "var(--color-bad)"}
          format={(n) => formatMetric(n, kpi.unit)}
          scaleMax={scaleMax}
        />
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-line-soft pt-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-relaxed text-ink-3">{kpi.gapNarrative}</p>
        </div>
        <Sparkline
          values={kpi.series.filter((s) => s.isActual).map((s) => s.value)}
          width={78}
          height={26}
          color={color}
        />
      </div>

      {hasChain && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-3.5 flex w-full items-center justify-between rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-left transition-colors hover:border-line-strong"
            aria-expanded={open}
          >
            <span className="text-[12.5px] font-medium text-ink-2">
              Why this matters —{" "}
              {[
                linkedIssues.length > 0 &&
                  `${linkedIssues.length} linked issue${linkedIssues.length === 1 ? "" : "s"}`,
                linkedFeedback.length > 0 &&
                  `${linkedFeedback.length} customer comment${linkedFeedback.length === 1 ? "" : "s"}`,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
            <IconChevronDown size={15} className={cx("text-ink-4 transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <div className="mt-3 space-y-3">
              {/* Performance gap */}
              {gap > 0 && (
                <div className="rounded-lg border border-line bg-surface-sunken p-3.5">
                  <p className="eyebrow-muted mb-1.5">Performance gap</p>
                  <p className="text-[13px] text-ink">
                    {formatMetric(gap, kpi.unit === "percent" ? "percent" : kpi.unit)} away from the
                    contracted target.
                    {kpi.affectedVolume &&
                      ` That is ${formatNumber(kpi.affectedVolume.count)} of ${formatNumber(
                        kpi.affectedVolume.ofTotal,
                      )} ${kpi.affectedVolume.unit} affected.`}
                  </p>
                </div>
              )}

              {/* Related issues */}
              {linkedIssues.map((i) => (
                <Link
                  key={i.id}
                  href={`/issues?issue=${i.id}`}
                  className="block rounded-lg border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-surface-sunken"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={PRIORITY_TONE[i.priority]}>{i.priority}</Badge>
                    <span className="font-mono text-[11px] text-ink-4">{i.ref}</span>
                    <span className="ml-auto text-[11.5px] text-ink-4 tnum">Open {i.agingDays} days</span>
                  </div>
                  <p className="text-[13px] leading-snug font-medium text-ink">{i.title}</p>
                  <p className="mt-1 text-[12px] text-ink-3">
                    {i.owner} · {i.ownerTeam}
                  </p>
                </Link>
              ))}

              {/* Related feedback */}
              {linkedFeedback.map((f) => (
                <figure key={f.id} className="rounded-lg border border-line bg-surface p-3.5">
                  <blockquote className="border-l-2 border-line-strong pl-3 text-[12.5px] leading-relaxed text-ink-2 italic">
                    “{f.quote}”
                  </blockquote>
                  <figcaption className="mt-2 flex flex-wrap items-center gap-2 pl-3 text-[11.5px] text-ink-4">
                    <span className="font-medium text-ink-3">{f.author}</span>
                    <span>· {f.authorRole}</span>
                    <span>· {formatDate(f.on)}</span>
                    <span className="ml-auto text-ink-3 tnum">{f.rating} / 5</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </>
      )}

    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* KPI group — a collapsible subfunction section for the full KPI list */
/* ------------------------------------------------------------------ */

export function KpiGroupSection({
  title,
  kpis,
  issues,
  feedback,
  color,
  defaultOpen = false,
  onOpenKpi,
}: {
  title: string;
  kpis: Kpi[];
  issues: Issue[];
  feedback: Feedback[];
  color: string;
  defaultOpen?: boolean;
  onOpenKpi?: (kpi: Kpi) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const counts = {
    bad: kpis.filter((k) => k.status === "bad").length,
    warn: kpis.filter((k) => k.status === "warn").length,
  };

  return (
    <Card padded={false}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <IconChevronDown size={15} className={cx("shrink-0 text-ink-4 transition-transform", open && "rotate-180")} />
        <span className="min-w-0 flex-1">
          <span className="text-[13.5px] font-semibold text-ink">{title}</span>
          <span className="ml-2 text-[12px] text-ink-4 tnum">
            {kpis.length} indicator{kpis.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {counts.bad > 0 && <Badge tone="bad">{counts.bad} off target</Badge>}
          {counts.warn > 0 && <Badge tone="warn">{counts.warn} at risk</Badge>}
        </span>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-line p-5 lg:grid-cols-2 2xl:grid-cols-3">
          {kpis.map((k) => (
            <KpiCard
              key={k.id}
              kpi={k}
              issues={issues}
              feedback={feedback}
              color={color}
              groupChip={k.group && k.group !== title ? k.group : undefined}
              onOpen={onOpenKpi}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* SLA decomposition                                                   */
/* ------------------------------------------------------------------ */

export function SlaBreakdown({ sla, color }: { sla: ServiceSla; color: string }) {
  return (
    <Card>
      <CardHeader
        eyebrow="Service level"
        title={`Where the ${sla.overall.toFixed(1)}% comes from`}
        action={<StatusPill status={sla.status}>{`Target ${sla.target}%`}</StatusPill>}
      />

      <Table>
        <thead>
          <tr>
            <Th>Sub-service</Th>
            <Th align="right">Weight</Th>
            <Th align="right">Actual</Th>
            <Th align="right">Target</Th>
            <Th align="right">Contribution</Th>
            <Th align="center">Status</Th>
          </tr>
        </thead>
        <tbody>
          {sla.components.map((c) => (
            <tr key={c.id}>
              <Td>
                {SUB_SERVICE_BY_SLA_COMPONENT[c.id] && (
                  <span className="mb-0.5 block text-[11.5px] font-medium text-ink-4">
                    {SUB_SERVICE_BY_SLA_COMPONENT[c.id].name}
                  </span>
                )}
                <span className="font-medium">{c.label}</span>
                <div className="mt-1.5 max-w-[220px]">
                  <ProgressBar
                    value={c.actual}
                    max={100}
                    height={4}
                    color={
                      c.status === "good"
                        ? "var(--color-good)"
                        : c.status === "warn"
                          ? "var(--color-warn)"
                          : "var(--color-bad)"
                    }
                    label={`${c.label} at ${c.actual}%`}
                  />
                </div>
              </Td>
              <Td align="right" muted>
                {(c.weight * 100).toFixed(0)}%
              </Td>
              <Td align="right">
                <span className="font-semibold">{c.actual.toFixed(1)}%</span>
              </Td>
              <Td align="right" muted>
                {c.target}%
              </Td>
              <Td align="right" muted>
                {(c.actual * c.weight).toFixed(2)}
              </Td>
              <Td align="center">
                <StatusPill status={c.status} size="sm">
                  {c.status === "good" ? "Met" : c.status === "warn" ? "At risk" : "Missed"}
                </StatusPill>
              </Td>
            </tr>
          ))}
          <tr>
            <Td className="font-semibold">Weighted service level achieved</Td>
            <Td align="right" className="font-semibold">
              100%
            </Td>
            <Td align="right" className="font-semibold">
              {sla.overall.toFixed(2)}%
            </Td>
            <Td align="right" muted>
              {sla.target}%
            </Td>
            <Td align="right" className="font-semibold">
              {sla.overall.toFixed(2)}
            </Td>
            <Td align="center">
              <StatusPill status={sla.status} size="sm" />
            </Td>
          </tr>
        </tbody>
      </Table>

      <div className="mt-5 border-t border-line-soft pt-4">
        <p className="eyebrow-muted mb-3">Twelve-month trend</p>
        <TrendChart
          data={sla.monthly.map((m) => ({ label: m.short, value: m.value, isActual: m.isActual }))}
          format={(n) => `${n.toFixed(1)}%`}
          height={150}
          color={color}
          zeroAnchored={false}
          valueLabel="SLA achieved"
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Charging model — "why am I being charged this?"                     */
/* ------------------------------------------------------------------ */

export function ChargingModel({ billing, color }: { billing: ServiceBilling; color: string }) {
  const txnShare = billing.currentTotal > 0 ? billing.txnTotal / billing.currentTotal : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* Transaction based */}
      <Card>
        <CardHeader
          eyebrow="Transaction-based charging"
          title="You are charged for what was processed"
          subtitle={`Volume × contracted rate, for ${billing.currentMonthLabel}.`}
          action={
            <Badge tone="outline">{(txnShare * 100).toFixed(0)}% of this month&rsquo;s fee</Badge>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>Charge line</Th>
              <Th align="right">Volume</Th>
              <Th align="right">Rate</Th>
              <Th align="right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {billing.txnLines.map((l) => (
              <tr key={l.id}>
                <Td>
                  <span className="font-medium">{l.label}</span>
                  <span className="mt-1 block">
                  </span>
                </Td>
                <Td align="right">{formatNumber(l.volume)}</Td>
                <Td align="right" muted>
                  {l.rate >= 100 ? formatMoney(l.rate) : `₹${l.rate}`}
                  <span className="block text-[11px] text-ink-4">per {l.unitSingular}</span>
                </Td>
                <Td align="right" className="font-semibold">
                  {formatMoney(l.amount)}
                </Td>
              </tr>
            ))}
            <tr>
              <Td className="font-semibold" >Transaction charges</Td>
              <Td />
              <Td />
              <Td align="right" className="font-semibold">
                {formatMoney(billing.txnTotal)}
              </Td>
            </tr>
          </tbody>
        </Table>
      </Card>

      {/* FTE based */}
      <Card>
        <CardHeader
          eyebrow="FTE-based charging"
          title="You are charged for dedicated capacity"
          subtitle="Contracted rate per FTE per month."
          action={
            <Badge tone="outline">{((1 - txnShare) * 100).toFixed(0)}% of this month&rsquo;s fee</Badge>
          }
        />
        {billing.fteLines.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Role</Th>
                <Th align="right">FTE</Th>
                <Th align="right">Rate / FTE</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {billing.fteLines.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <span className="font-medium">{l.role}</span>
                  </Td>
                  <Td align="right">{l.fte}</Td>
                  <Td align="right" muted>
                    {formatMoney(l.ratePerFte)}
                    <span className="block text-[11px] text-ink-4">per month</span>
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(l.amount)}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold">Capacity charges</Td>
                <Td align="right" className="font-semibold">
                  {billing.fteLines.reduce((a, l) => a + l.fte, 0)}
                </Td>
                <Td />
                <Td align="right" className="font-semibold">
                  {formatMoney(billing.fteTotal)}
                </Td>
              </tr>
            </tbody>
          </Table>
        ) : (
          <p className="py-6 text-center text-[13px] text-ink-3">
            This service is charged entirely on transaction volume — no dedicated FTE capacity is billed.
          </p>
        )}

        <div className="mt-5 rounded-lg border border-line bg-surface-sunken p-4">
          <DataRow label="Transaction charges" value={formatMoney(billing.txnTotal)} />
          <DataRow label="Capacity charges" value={formatMoney(billing.fteTotal)} />
          <DataRow
            label={`Total for ${billing.currentMonthLabel}`}
            value={formatMoney(billing.currentTotal)}
            emphasis
          />
        </div>
        <p className="mt-2 text-[11.5px] text-ink-4">
          Every figure above is the contracted rate multiplied by the volume actually processed. The
          same volumes drive the KPIs on the performance tab.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Billing drivers — "why did it move?"                                */
/* ------------------------------------------------------------------ */

export function BillingDrivers({ billing, color }: { billing: ServiceBilling; color: string }) {
  const movers = billing.drivers.filter((d) => Math.abs(d.deltaAmount) > 0).slice(0, 5);

  return (
    <Card>
      <CardHeader
        eyebrow="Billing movement"
        title={`${billing.momPct >= 0 ? "Up" : "Down"} ${Math.abs(billing.momPct).toFixed(1)}% on last month`}
        action={
          <TrendPill
            trend={billing.momPct > 0.75 ? "up" : billing.momPct < -0.75 ? "down" : "flat"}
            value={billing.momPct}
            direction="lower-better"
          />
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Previous month", value: formatMoney(billing.prevMonthTotal) },
          { label: "This month", value: formatMoney(billing.currentTotal) },
          {
            label: "Movement",
            value: `${billing.currentTotal - billing.prevMonthTotal >= 0 ? "+" : "−"}${formatMoney(
              Math.abs(billing.currentTotal - billing.prevMonthTotal),
            )}`,
          },
          { label: "Against budget", value: formatPercent(billing.ytdVariancePct) + " YTD" },
        ].map((t) => (
          <div key={t.label} className="rounded-lg border border-line bg-surface-sunken p-3">
            <p className="eyebrow-muted">{t.label}</p>
            <p className="mt-1.5 text-[15px] font-semibold text-ink tnum">{t.value}</p>
          </div>
        ))}
      </div>

      <p className="eyebrow-muted mb-3">Contribution to the movement</p>
      <ul className="space-y-3">
        {movers.map((d) => {
          const positive = d.deltaAmount >= 0;
          const magnitude =
            Math.abs(d.deltaAmount) /
            Math.max(...movers.map((m) => Math.abs(m.deltaAmount)), 1);
          return (
            <li key={d.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-ink-2">
                  {d.label}
                  <span className="ml-2 text-[11.5px] text-ink-4">
                    {formatNumber(d.fromVolume ?? 0)} → {formatNumber(d.toVolume ?? 0)}
                    {d.kind === "fte" ? " FTE" : ""}
                  </span>
                </span>
                <span
                  className={cx(
                    "shrink-0 text-[13px] font-semibold tnum",
                    positive ? "text-ink" : "text-ink-2",
                  )}
                >
                  {positive ? "+" : "−"}
                  {formatMoney(Math.abs(d.deltaAmount))}
                  <span className="ml-2 text-[11.5px] font-normal text-ink-4">
                    {d.deltaPct >= 0 ? "+" : "−"}
                    {Math.abs(d.deltaPct).toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="flex h-[7px] w-full overflow-hidden rounded-full bg-line-soft">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${magnitude * 100}%`,
                    background: positive ? color : "var(--color-ink-4)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Billing trend + budget                                              */
/* ------------------------------------------------------------------ */

export function BillingTrend({ billing, color }: { billing: ServiceBilling; color: string }) {
  return (
    <Card>
      <CardHeader
        eyebrow="Twelve-month view"
        title="Billing against budget"
        subtitle="Dashed line is budget · hatched months are forecast."
      />
      <TrendChart
        data={billing.monthly.map((m) => ({
          label: m.short,
          value: m.total,
          isActual: m.isActual,
          budget: m.budget,
        }))}
        format={(n) => `₹${formatMoneyAxis(n)}`}
        height={230}
        color={color}
        valueLabel="Billed"
        budgetLabel="Budget"
      />

      <div className="mt-5 grid gap-3 border-t border-line-soft pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Billed year to date", value: formatMoney(billing.ytd), hint: "Closed months only" },
          { label: "Budget year to date", value: formatMoney(billing.ytdBudget), hint: "Agreed plan" },
          {
            label: "Variance to budget",
            value: `${billing.ytdVariancePct >= 0 ? "+" : "−"}${Math.abs(billing.ytdVariancePct).toFixed(1)}%`,
            hint: `${formatMoney(Math.abs(billing.ytd - billing.ytdBudget))} ${billing.ytd >= billing.ytdBudget ? "over" : "under"}`,
          },
          {
            label: "Full-year forecast",
            value: formatMoney(billing.fyForecast),
            hint: `Budget ${formatMoney(billing.fyBudget)}`,
          },
        ].map((t) => (
          <div key={t.label}>
            <p className="eyebrow-muted">{t.label}</p>
            <p className="mt-1.5 text-[17px] font-semibold text-ink tnum">{t.value}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-4">{t.hint}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Service utilisation                                                 */
/* ------------------------------------------------------------------ */

export function UtilisationCard({
  utilisation,
  note,
  color,
  activity,
}: {
  utilisation: number;
  note: string;
  color: string;
  activity: { title: string; unit: string; series: { short: string; value: number; isActual: boolean }[] };
}) {
  const actual = activity.series.filter((s) => s.isActual);
  const peak = Math.max(...actual.map((s) => s.value));
  const trough = Math.min(...actual.map((s) => s.value));

  return (
    <Card>
      <CardHeader eyebrow="Service utilisation" title="How much of the contract you are using" subtitle={note} />
      <div className="mb-4 flex items-end gap-4">
        <p className="metric text-[32px] leading-9 font-semibold tracking-[-0.02em] text-ink">
          {(utilisation * 100).toFixed(0)}%
        </p>
        <p className="pb-1.5 text-[12.5px] text-ink-3">of the contracted monthly envelope</p>
      </div>
      <ProgressBar
        value={Math.min(100, utilisation * 100)}
        color={utilisation > 1 ? "var(--color-warn)" : color}
        height={8}
        label={`${(utilisation * 100).toFixed(0)}% utilisation`}
      />
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line-soft pt-4">
        <div>
          <p className="eyebrow-muted">Peak month</p>
          <p className="mt-1 text-[14px] font-semibold text-ink tnum">{formatNumber(peak)}</p>
        </div>
        <div>
          <p className="eyebrow-muted">Lowest month</p>
          <p className="mt-1 text-[14px] font-semibold text-ink tnum">{formatNumber(trough)}</p>
        </div>
        <div>
          <p className="eyebrow-muted">Variability</p>
          <p className="mt-1 text-[14px] font-semibold text-ink tnum">
            {(((peak - trough) / Math.max(1, trough)) * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Completion split                                                    */
/* ------------------------------------------------------------------ */

export function CompletionCard({
  completion,
  unit,
  color,
}: {
  completion: { completed: number; pending: number; exceptions: number };
  unit: string;
  color: string;
}) {
  const total = completion.completed + completion.pending + completion.exceptions;
  return (
    <Card>
      <CardHeader
        eyebrow="This month's work"
        title="Completed, pending and exceptions"
        subtitle={`Of ${formatNumber(total)} ${unit} in the current month.`}
      />
      <HBarList
        items={[
          { key: "done", label: "Completed", value: completion.completed, color: "var(--color-good)" },
          { key: "pending", label: "In progress", value: completion.pending, color },
          {
            key: "exc",
            label: "Exceptions awaiting intervention",
            value: completion.exceptions,
            color: "var(--color-warn)",
          },
        ]}
        format={(n) => formatNumber(n)}
        showShare
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-service explorer — pick a sub-service, see its own numbers       */
/* ------------------------------------------------------------------ */

/**
 * Adjacent-pair CVD-validated hue order (protan/deutan ΔE 9.1, normal-vision
 * 19.6 against a white card). Assign in sequence; never cycle or reorder.
 */
export const SUB_SERVICE_COLORS = [
  "var(--color-svc-fna)",
  "var(--color-svc-procurement)",
  "var(--color-svc-idt)",
  "var(--color-svc-automation)",
  "var(--color-svc-analytics)",
];

export function SubServiceExplorer({
  subServices,
  kpis,
  color,
  monthLabel,
}: {
  subServices: SubServiceDetail[];
  kpis: Kpi[];
  color: string;
  monthLabel: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = subServices.find((s) => s.id === selectedId) ?? null;
  const hueOf = (id: string) =>
    SUB_SERVICE_COLORS[Math.max(0, subServices.findIndex((s) => s.id === id)) % SUB_SERVICE_COLORS.length];

  return (
    <section>
      <SectionHeading title="Service activity" />

      {/* Selector */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className={cx(
            "rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            !selected
              ? "border-accent-line bg-accent-soft text-accent-strong"
              : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2",
          )}
        >
          All sub-services
        </button>
        {subServices.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={cx(
              "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              selected?.id === s.id
                ? "border-accent-line bg-accent-soft text-accent-strong"
                : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: hueOf(s.id) }} />
            {s.name}
          </button>
        ))}
      </div>

      {selected ? (
        <SubServiceDetailView
          detail={selected}
          kpis={kpis.filter((k) => selected.kpiIds.includes(k.id))}
          hue={hueOf(selected.id)}
          monthLabel={monthLabel}
        />
      ) : (
        <SubServiceOverview
          subServices={subServices}
          hueOf={hueOf}
          color={color}
          monthLabel={monthLabel}
          onSelect={setSelectedId}
        />
      )}
    </section>
  );
}

/** All sub-services side by side: spend split (common unit) + volume small multiples. */
function SubServiceOverview({
  subServices,
  hueOf,
  color,
  monthLabel,
  onSelect,
}: {
  subServices: SubServiceDetail[];
  hueOf: (id: string) => string;
  color: string;
  monthLabel: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow={monthLabel} title="Attributable spend by sub-service" />
          <HBarList
            items={subServices.map((s) => ({
              key: s.id,
              label: s.name,
              sublabel: `${formatNumber(s.currentVolume)} ${s.unit}`,
              value: s.monthTotal,
              color: hueOf(s.id),
            }))}
            format={(n) => formatMoney(n)}
            showShare
          />
        </Card>

        <Card>
          <CardHeader eyebrow="Service level" title="Achievement against target" />
          <div className="space-y-4">
            {subServices.map((s) =>
              s.sla ? (
                <div key={s.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12.5px] text-ink-2">{s.name}</span>
                    <span className="shrink-0 text-[13px] font-semibold text-ink tnum">
                      {s.sla.actual.toFixed(1)}%
                    </span>
                  </div>
                  <BulletGauge
                    actual={s.sla.actual}
                    target={s.sla.target}
                    direction="higher-better"
                    color={
                      s.sla.status === "bad"
                        ? "var(--color-bad)"
                        : s.sla.status === "warn"
                          ? "var(--color-warn)"
                          : "var(--color-good)"
                    }
                    format={(n) => `${n.toFixed(0)}%`}
                    scaleMax={100}
                    scaleMin={Math.max(0, Math.min(s.sla.actual, s.sla.target) - 15)}
                  />
                </div>
              ) : null,
            )}
          </div>
        </Card>
      </div>

      {/* Volume small multiples — each on its own scale, its own unit. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {subServices.map((s) => {
          const mom = s.prevVolume ? ((s.currentVolume - s.prevVolume) / s.prevVolume) * 100 : 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className="card !p-4 text-left transition-shadow hover:shadow-raised"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{s.name}</p>
                  <p className="mt-1 text-[19px] font-semibold text-ink tnum">
                    {formatNumber(s.currentVolume)}
                    <span className="ml-1.5 text-[11.5px] font-normal text-ink-4">{s.unit}</span>
                  </p>
                </div>
                <TrendPill
                  trend={mom > 0.75 ? "up" : mom < -0.75 ? "down" : "flat"}
                  value={mom}
                  direction="higher-better"
                  label="MoM"
                />
              </div>
              <div className="mt-3">
                <Sparkline
                  values={s.series.filter((x) => x.isActual).map((x) => x.value)}
                  width={220}
                  height={34}
                  color={hueOf(s.id)}
                />
              </div>
              <p className="mt-2 border-t border-line-soft pt-2 text-[11.5px] text-ink-4 tnum">
                {formatNumber(s.ytdVolume)} YTD · {formatMoney(s.monthTotal)} this month
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One sub-service in full: volume, charging, service level, its own KPIs. */
function SubServiceDetailView({
  detail,
  kpis,
  hue,
  monthLabel,
}: {
  detail: SubServiceDetail;
  kpis: Kpi[];
  hue: string;
  monthLabel: string;
}) {
  const mom = detail.prevVolume
    ? ((detail.currentVolume - detail.prevVolume) / detail.prevVolume) * 100
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label={`${detail.unit} — ${monthLabel}`}
          value={formatNumber(detail.currentVolume)}
          emphasis
          accent={hue}
          delta={
            <TrendPill
              trend={mom > 0.75 ? "up" : mom < -0.75 ? "down" : "flat"}
              value={mom}
              direction="higher-better"
              label="MoM"
            />
          }
        />
        <StatTile label="Year to date" value={formatNumber(detail.ytdVolume)} emphasis caption={detail.unit} />
        <StatTile
          label="Contracted rate"
          value={detail.rate >= 1000 ? formatMoney(detail.rate) : `₹${detail.rate}`}
          emphasis
          caption={`per ${detail.unitSingular}`}
        />
        <StatTile
          label="Dedicated capacity"
          value={`${detail.fteCount} FTE`}
          emphasis
          caption={formatMoney(detail.fteAmount)}
        />
        <StatTile
          label="Attributable spend"
          value={formatMoney(detail.monthTotal)}
          emphasis
          caption={`${(detail.shareOfService * 100).toFixed(0)}% of tower`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <MonthlyTrendCard
          eyebrow="Volume"
          title={`${detail.name} — ${detail.unit} per month`}
          data={detail.series.map((x) => ({
            label: x.short,
            value: x.value,
            isActual: x.isActual,
            prior: x.prior,
          }))}
          format={(n) => formatNumber(n)}
          color={hue}
          valueLabel={detail.unit}
        />

        <div className="grid gap-4">
          <Card>
            <CardHeader eyebrow="Charging" title="How this sub-service is billed" />
            <Table>
              <tbody>
                <tr>
                  <Td>
                    {formatNumber(detail.currentVolume)} {detail.unit}
                  </Td>
                  <Td align="right" muted>
                    × {detail.rate >= 1000 ? formatMoney(detail.rate) : `₹${detail.rate}`}
                  </Td>
                  <Td align="right" className="font-medium">
                    {formatMoney(detail.txnAmount)}
                  </Td>
                </tr>
                <tr>
                  <Td>{detail.fteCount} FTE</Td>
                  <Td align="right" muted>
                    dedicated
                  </Td>
                  <Td align="right" className="font-medium">
                    {formatMoney(detail.fteAmount)}
                  </Td>
                </tr>
                <tr>
                  <Td className="font-semibold">Total</Td>
                  <Td />
                  <Td align="right" className="font-semibold">
                    {formatMoney(detail.monthTotal)}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </Card>

          {detail.sla && (
            <Card>
              <CardHeader
                eyebrow="Service level"
                title={`${detail.sla.actual.toFixed(1)}% achieved`}
                action={<StatusPill status={detail.sla.status} size="sm">{detail.sla.label}</StatusPill>}
              />
              <BulletGauge
                actual={detail.sla.actual}
                target={detail.sla.target}
                direction="higher-better"
                color={
                  detail.sla.status === "bad"
                    ? "var(--color-bad)"
                    : detail.sla.status === "warn"
                      ? "var(--color-warn)"
                      : "var(--color-good)"
                }
                format={(n) => `${n.toFixed(0)}%`}
                scaleMax={100}
                scaleMin={Math.max(0, Math.min(detail.sla.actual, detail.sla.target) - 20)}
              />
              <div className="mt-4 border-t border-line-soft pt-3">
                <DataRow label="Weight in tower SLA" value={`${(detail.sla.weight * 100).toFixed(0)}%`} />
                <DataRow
                  label="Contribution"
                  value={(detail.sla.actual * detail.sla.weight).toFixed(2)}
                  emphasis
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      {kpis.length > 0 && (
        <Card padded={false}>
          <div className="p-5">
            <CardHeader eyebrow="Indicators" title={`${kpis.length} KPIs measured on ${detail.name}`} />
            <Table>
              <thead>
                <tr>
                  <Th>Indicator</Th>
                  <Th align="right">Actual</Th>
                  <Th align="right">Target</Th>
                  <Th align="center">Trend</Th>
                  <Th align="center">Status</Th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((k) => (
                  <tr key={k.id}>
                    <Td>{k.name}</Td>
                    <Td align="right" className="font-medium">
                      {formatMetric(k.actual, k.unit)}
                    </Td>
                    <Td align="right" muted>
                      {k.direction === "higher-better" ? "≥" : "≤"} {formatMetric(k.target, k.unit)}
                    </Td>
                    <Td align="center">
                      <TrendPill trend={k.trend} value={k.deltaPct} direction={k.direction} />
                    </Td>
                    <Td align="center">
                      <StatusPill status={k.status} size="sm" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI overview — distribution, attainment, biggest gaps               */
/* ------------------------------------------------------------------ */

/** Signed shortfall against target as a % of target. 0 = met or beaten. */
function shortfallPct(k: Kpi): number {
  if (!k.target) return 0;
  const raw =
    k.direction === "higher-better" ? k.target - k.actual : k.actual - k.target;
  return Math.max(0, (raw / Math.abs(k.target)) * 100);
}

export function KpiOverviewPanel({
  kpis,
  subServices,
}: {
  kpis: Kpi[];
  subServices: SubServiceDetail[];
}) {
  const counts = {
    good: kpis.filter((k) => k.status === "good").length,
    warn: kpis.filter((k) => k.status === "warn").length,
    bad: kpis.filter((k) => k.status === "bad").length,
  };
  const total = kpis.length || 1;

  const bands = [
    { key: "good", label: "On target", value: counts.good, color: "var(--color-good)" },
    { key: "warn", label: "At risk", value: counts.warn, color: "var(--color-warn)" },
    { key: "bad", label: "Off target", value: counts.bad, color: "var(--color-bad)" },
  ].filter((b) => b.value > 0);

  const attainment = subServices
    .map((s) => {
      const own = kpis.filter((k) => s.kpiIds.includes(k.id));
      if (own.length === 0) return null;
      const onTarget = own.filter((k) => k.status === "good").length;
      return {
        key: s.id,
        label: s.name,
        sublabel: `${onTarget} of ${own.length} on target`,
        value: (onTarget / own.length) * 100,
        color:
          onTarget === own.length
            ? "var(--color-good)"
            : onTarget / own.length >= 0.7
              ? "var(--color-warn)"
              : "var(--color-bad)",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const gaps = kpis
    .map((k) => ({ kpi: k, gap: shortfallPct(k) }))
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 6);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader eyebrow="Distribution" title={`${kpis.length} indicators measured`} />
        <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
          {bands.map((b) => (
            <div key={b.key} style={{ width: `${(b.value / total) * 100}%`, background: b.color }} />
          ))}
        </div>
        <ul className="mt-4 space-y-2.5">
          {bands.map((b) => (
            <li key={b.key} className="flex items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
              <span className="min-w-0 flex-1 text-[12.5px] text-ink-2">{b.label}</span>
              <span className="text-[13px] font-semibold text-ink tnum">{b.value}</span>
              <span className="w-10 text-right text-[11.5px] text-ink-4 tnum">
                {((b.value / total) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader eyebrow="Attainment" title="On-target rate by sub-service" />
        {attainment.length > 0 ? (
          <HBarList items={attainment} format={(n) => `${n.toFixed(0)}%`} />
        ) : (
          <p className="py-6 text-center text-[13px] text-ink-3">No sub-service indicators.</p>
        )}
      </Card>

      <Card>
        <CardHeader eyebrow="Biggest gaps" title="Furthest from target" />
        {gaps.length > 0 ? (
          <HBarList
            items={gaps.map((g) => ({
              key: g.kpi.id,
              label: g.kpi.name,
              sublabel: `${formatMetric(g.kpi.actual, g.kpi.unit)} vs ${formatMetric(
                g.kpi.target,
                g.kpi.unit,
              )}`,
              value: g.gap,
              color: g.kpi.status === "bad" ? "var(--color-bad)" : "var(--color-warn)",
            }))}
            format={(n) => `${n.toFixed(1)}%`}
          />
        ) : (
          <p className="py-6 text-center text-[13px] text-ink-3">
            Every indicator is at or beyond its target.
          </p>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI detail drawer — full trend with a two-year comparison            */
/* ------------------------------------------------------------------ */

export function KpiDetailDrawer({
  kpi,
  issues,
  feedback,
  color,
  periodLabel,
  priorPeriodLabel,
  onClose,
}: {
  kpi: Kpi | null;
  issues: Issue[];
  feedback: Feedback[];
  color: string;
  periodLabel: string;
  priorPeriodLabel: string;
  onClose: () => void;
}) {
  const [compare, setCompare] = useState(true);

  useEffect(() => {
    if (!kpi) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [kpi, onClose]);

  if (!kpi) return null;

  const hasPrior = kpi.series.some((s) => s.prior != null);
  const actual = kpi.series.filter((s) => s.isActual);
  const priorActual = actual.filter((s) => s.prior != null);
  const best = actual.reduce(
    (acc, s) => (kpi.direction === "higher-better" ? Math.max(acc, s.value) : Math.min(acc, s.value)),
    actual[0]?.value ?? 0,
  );
  const worst = actual.reduce(
    (acc, s) => (kpi.direction === "higher-better" ? Math.min(acc, s.value) : Math.max(acc, s.value)),
    actual[0]?.value ?? 0,
  );
  const avg = actual.length ? actual.reduce((a, s) => a + s.value, 0) / actual.length : 0;
  const priorAvg = priorActual.length
    ? priorActual.reduce((a, s) => a + (s.prior as number), 0) / priorActual.length
    : null;
  const yoy = priorAvg ? ((avg - priorAvg) / Math.abs(priorAvg)) * 100 : null;
  const monthsOnTarget = actual.filter((s) =>
    kpi.direction === "higher-better" ? s.value >= kpi.target : s.value <= kpi.target,
  ).length;

  const linkedIssues = issues.filter((i) => kpi.relatedIssueIds.includes(i.id));
  const linkedFeedback = feedback.filter((f) => kpi.relatedFeedbackIds.includes(f.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={kpi.name}
        className="animate-in relative flex h-full w-full max-w-[720px] flex-col overflow-y-auto bg-surface shadow-pop"
      >
        <header className="sticky top-0 z-10 border-b border-line bg-surface px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {kpi.group && <p className="eyebrow-muted mb-1.5">{kpi.group}</p>}
              <h2 className="text-[17px] leading-snug font-semibold text-ink">{kpi.name}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill status={kpi.status} size="sm" />
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-sunken hover:text-ink"
                aria-label="Close"
              >
                <IconClose size={18} />
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Actual" value={formatMetric(kpi.actual, kpi.unit)} emphasis accent={color} />
            <StatTile
              label="Target"
              value={`${kpi.direction === "higher-better" ? "≥ " : "≤ "}${formatMetric(kpi.target, kpi.unit)}`}
              emphasis
            />
            <StatTile
              label="Average this year"
              value={formatMetric(avg, kpi.unit)}
              emphasis
              caption={`${actual.length} closed months`}
            />
            <StatTile
              label="Months on target"
              value={`${monthsOnTarget} / ${actual.length}`}
              emphasis
              status={monthsOnTarget === actual.length ? "good" : monthsOnTarget === 0 ? "bad" : "warn"}
            />
          </div>

          <Card>
            <CardHeader
              eyebrow="Trend"
              title={`${periodLabel} performance against target`}
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
                    Compare {priorPeriodLabel}
                  </button>
                ) : undefined
              }
            />
            <TrendChart
              data={kpi.series.map((s) => ({
                label: s.short,
                value: s.value,
                isActual: s.isActual,
                budget: kpi.target,
                compare: compare ? s.prior : undefined,
              }))}
              format={(n) => formatMetric(n, kpi.unit)}
              height={280}
              color={color}
              valueLabel={periodLabel}
              compareLabel={priorPeriodLabel}
              budgetLabel="Target"
              zeroAnchored={kpi.unit !== "percent"}
            />
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Best month"
              value={formatMetric(best, kpi.unit)}
              emphasis
              status="good"
            />
            <StatTile label="Worst month" value={formatMetric(worst, kpi.unit)} emphasis status="bad" />
            <StatTile
              label={`Versus ${priorPeriodLabel}`}
              value={yoy == null ? "—" : `${yoy >= 0 ? "+" : "−"}${Math.abs(yoy).toFixed(1)}%`}
              emphasis
              caption={priorAvg == null ? "No prior year" : `${formatMetric(priorAvg, kpi.unit)} average`}
            />
          </div>

          <Card>
            <CardHeader eyebrow="Against target" title="Where this month sits" />
            <BulletGauge
              actual={kpi.actual}
              target={kpi.target}
              direction={kpi.direction}
              color={
                kpi.status === "good"
                  ? "var(--color-good)"
                  : kpi.status === "warn"
                    ? "var(--color-warn)"
                    : "var(--color-bad)"
              }
              format={(n) => formatMetric(n, kpi.unit)}
              scaleMax={kpi.unit === "percent" ? 100 : Math.max(kpi.actual, kpi.target) * 1.35}
            />
            <p className="mt-4 border-t border-line-soft pt-3 text-[12.5px] leading-relaxed text-ink-3">
              {kpi.gapNarrative}
            </p>
          </Card>

          {linkedIssues.length > 0 && (
            <Card>
              <CardHeader eyebrow="Linked" title={`${linkedIssues.length} open issue${linkedIssues.length === 1 ? "" : "s"}`} />
              <div className="space-y-2.5">
                {linkedIssues.map((i) => (
                  <Link
                    key={i.id}
                    href={`/issues?issue=${i.id}`}
                    className="block rounded-lg border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-surface-sunken"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={PRIORITY_TONE[i.priority]}>{i.priority}</Badge>
                      <span className="font-mono text-[11px] text-ink-4">{i.ref}</span>
                      <span className="ml-auto text-[11.5px] text-ink-4 tnum">Open {i.agingDays} days</span>
                    </div>
                    <p className="text-[13px] leading-snug font-medium text-ink">{i.title}</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {linkedFeedback.length > 0 && (
            <Card>
              <CardHeader eyebrow="Voice of the customer" title="What people said" />
              <div className="space-y-3">
                {linkedFeedback.map((f) => (
                  <figure key={f.id} className="rounded-lg border border-line p-3.5">
                    <blockquote className="border-l-2 border-line-strong pl-3 text-[12.5px] leading-relaxed text-ink-2 italic">
                      “{f.quote}”
                    </blockquote>
                    <figcaption className="mt-2 flex flex-wrap items-center gap-2 pl-3 text-[11.5px] text-ink-4">
                      <span className="font-medium text-ink-3">{f.author}</span>
                      <span>· {f.authorRole}</span>
                      <span className="ml-auto text-ink-3 tnum">{f.rating} / 5</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Card>
          )}
        </div>
      </aside>
    </div>
  );
}
