"use client";

import { useState } from "react";
import Link from "next/link";
import type { Feedback, Issue, Kpi, ServiceBilling, ServiceSla } from "@/lib/domain/types";
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
  SourceTag,
  StatusPill,
  Table,
  Td,
  Th,
  TrendPill,
  serviceColor,
} from "@/components/ui/primitives";
import { BulletGauge, HBarList, Sparkline, TrendChart } from "@/components/charts";
import { IconChevronDown } from "./icons";

/* ------------------------------------------------------------------ */
/* KPI card — with the KPI → issue → feedback chain                    */
/* ------------------------------------------------------------------ */

export function KpiCard({
  kpi,
  issues,
  feedback,
  color,
}: {
  kpi: Kpi;
  issues: Issue[];
  feedback: Feedback[];
  color: string;
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
          <h3 className="text-[14px] leading-snug font-semibold text-ink">{kpi.name}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{kpi.description}</p>
        </div>
        <StatusPill status={kpi.status} size="sm" />
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Actual</p>
          <p className="metric mt-1 text-[27px] leading-8 font-semibold tracking-[-0.02em] text-ink">
            {formatMetric(kpi.actual, kpi.unit)}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Target</p>
          <p className="mt-1 text-[15px] font-medium text-ink-2 tnum">
            {kpi.direction === "higher-better" ? "≥ " : "≤ "}
            {formatMetric(kpi.target, kpi.unit)}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Trend</p>
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
                  <p className="eyebrow mb-1.5">Performance gap</p>
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

      <p className="mt-3.5 border-t border-line-soft pt-3">
        <SourceTag system={kpi.sourceSystem} />
      </p>
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
        subtitle="The headline service level is a weighted roll-up. This is the weighting and each component's contribution, so it is clear which part of the tower is carrying — or dragging — the number."
        action={<StatusPill status={sla.status}>{`Target ${sla.target}%`}</StatusPill>}
      />

      <Table>
        <thead>
          <tr>
            <Th>Service level component</Th>
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
        <p className="eyebrow mb-3">Twelve-month trend</p>
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
                    <SourceTag system={l.sourceSystem} />
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
          subtitle={`Ring-fenced people on your account, at the contracted rate per FTE per month.`}
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
        subtitle={billing.narrative}
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
            <p className="eyebrow">{t.label}</p>
            <p className="mt-1.5 text-[15px] font-semibold text-ink tnum">{t.value}</p>
          </div>
        ))}
      </div>

      <p className="eyebrow mb-3">Contribution to the movement</p>
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
        subtitle="Solid line is billed actuals; the dashed grey line is the agreed budget. Hatched months are forecast at the current run rate."
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
            <p className="eyebrow">{t.label}</p>
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
          <p className="eyebrow">Peak month</p>
          <p className="mt-1 text-[14px] font-semibold text-ink tnum">{formatNumber(peak)}</p>
        </div>
        <div>
          <p className="eyebrow">Lowest month</p>
          <p className="mt-1 text-[14px] font-semibold text-ink tnum">{formatNumber(trough)}</p>
        </div>
        <div>
          <p className="eyebrow">Variability</p>
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
