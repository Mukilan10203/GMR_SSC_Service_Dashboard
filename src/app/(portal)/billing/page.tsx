"use client";

import { useState } from "react";
import Link from "next/link";
import { usePortalData } from "@/components/portal/usePortalData";
import { MonthlyTrendCard, PageHeader } from "@/components/portal/blocks";
import {
  Badge,
  Card,
  CardHeader,
  DataRow,
  SectionHeading,
  StatTile,
  Table,
  Td,
  Th,
  TrendPill,
  serviceColor,
} from "@/components/ui/primitives";
import { DonutChart, HBarList, StackedColumns, TrendChart } from "@/components/charts";
import {
  billedTotal,
  billedTotalLabel,
  cx,
  formatMoney,
  formatMoneyAxis,
  formatNumber,
  formatPercent,
  priorPeriodToDate,
  yoyActualPct,
} from "@/lib/format";

/** Month-window presets. `from`/`to` are inclusive indices into the fiscal year. */
function rangePresets(actualCount: number) {
  const last = Math.max(0, actualCount - 1);
  return [
    { id: "ytd", label: "Year to date", from: 0, to: last },
    { id: "l3", label: "Last 3 months", from: Math.max(0, last - 2), to: last },
    { id: "l6", label: "Last 6 months", from: Math.max(0, last - 5), to: last },
    { id: "h1", label: "H1 (Apr–Sep)", from: 0, to: 5 },
    { id: "h2", label: "H2 (Oct–Mar)", from: 6, to: 11 },
    { id: "fy", label: "Full year", from: 0, to: 11 },
  ];
}

export default function BillingPage() {
  const { snapshot } = usePortalData();
  const [rangeId, setRangeId] = useState("ytd");
  if (!snapshot) return null;

  const { billing, services, period, entity } = snapshot;

  const presets = rangePresets(period.actualMonthCount);
  const range = presets.find((r) => r.id === rangeId) ?? presets[0];
  const inRange = <T,>(xs: T[]) => xs.slice(range.from, range.to + 1);

  const rangeMonths = inRange(billing.monthly);
  const rangeTotal = rangeMonths.reduce((a, m) => a + m.total, 0);
  const rangeBudget = rangeMonths.reduce((a, m) => a + m.budget, 0);
  const rangeActualMonths = rangeMonths.filter((m) => m.isActual);
  const rangeAvg = rangeMonths.length ? rangeTotal / rangeMonths.length : 0;
  const peakMonth = [...rangeMonths].sort((a, b) => b.total - a.total)[0];
  const lowMonth = [...rangeMonths].sort((a, b) => a.total - b.total)[0];
  const rangeVariancePct = rangeBudget ? ((rangeTotal - rangeBudget) / rangeBudget) * 100 : 0;
  const rangeTxn = rangeMonths.reduce((a, m) => a + m.txn, 0);
  const rangeFte = rangeMonths.reduce((a, m) => a + m.fte, 0);

  // Running total against budget — how the year is tracking, not just this month.
  let runTotal = 0;
  let runBudget = 0;
  let runPrior = 0;
  const hasPrior = rangeMonths.some((m) => m.prior != null);
  const cumulative = rangeMonths.map((m) => {
    runTotal += m.total;
    runBudget += m.budget;
    runPrior += m.prior ?? 0;
    return {
      label: m.short,
      value: runTotal,
      isActual: m.isActual,
      budget: runBudget,
      prior: hasPrior ? runPrior : undefined,
    };
  });

  const rangeByService = services
    .map((s) => ({
      key: s.service.id,
      label: s.service.name,
      value: inRange(s.billing.monthly).reduce((a, m) => a + m.total, 0),
      color: serviceColor(s.service.id),
    }))
    .sort((a, b) => b.value - a.value);

  const biggestService = [...services].sort(
    (a, b) =>
      billedTotal(period.isCurrent, b.billing.ytd, b.billing.fyForecast) -
      billedTotal(period.isCurrent, a.billing.ytd, a.billing.fyForecast),
  )[0];

  // Like-for-like base: the same closed months a year earlier. Every
  // comparison on this page is actual against actual, never against a
  // projection of the months that have not happened yet.
  const priorToDate = priorPeriodToDate(billing.monthly);
  const yoy = yoyActualPct(billing.ytd, priorToDate);
  const biggestMover = [...services].sort(
    (a, b) =>
      Math.abs(b.billing.currentTotal - b.billing.prevMonthTotal) -
      Math.abs(a.billing.currentTotal - a.billing.prevMonthTotal),
  )[0];

  // Roll every service's top driver into one entity-level attribution.
  const allDrivers = services
    .flatMap((s) =>
      s.billing.drivers.map((d) => ({ ...d, serviceId: s.service.id, code: s.service.code })),
    )
    .sort((a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount))
    .slice(0, 6);

  const totalMovement = billing.currentTotal - billing.prevMonthTotal;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="Billing"
        title="What you are paying, and why"
        actions={
          <div className="flex flex-wrap gap-1.5">
            {presets.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRangeId(r.id)}
                className={cx(
                  "rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  r.id === rangeId
                    ? "border-accent-line bg-accent-soft text-accent-strong"
                    : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {/* ============================================================ */}
      {/* Selected range                                               */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title={`${range.label} · ${rangeMonths[0]?.short} – ${rangeMonths[rangeMonths.length - 1]?.short}`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Billed in range"
            value={formatMoney(rangeTotal)}
            emphasis
            caption={`${rangeActualMonths.length} of ${rangeMonths.length} months closed`}
          />
          <StatTile
            label="Budget in range"
            value={formatMoney(rangeBudget)}
            emphasis
            caption={`${formatMoney(Math.abs(rangeTotal - rangeBudget))} ${
              rangeTotal >= rangeBudget ? "over" : "under"
            }`}
          />
          <StatTile
            label="Variance"
            value={`${rangeVariancePct >= 0 ? "+" : "−"}${Math.abs(rangeVariancePct).toFixed(1)}%`}
            emphasis
            status={Math.abs(rangeVariancePct) < 5 ? "good" : "warn"}
          />
          <StatTile label="Average month" value={formatMoney(rangeAvg)} emphasis />
          <StatTile
            label="Peak month"
            value={formatMoney(peakMonth?.total ?? 0)}
            emphasis
            caption={peakMonth?.short}
          />
          <StatTile
            label="Lowest month"
            value={formatMoney(lowMonth?.total ?? 0)}
            emphasis
            caption={lowMonth?.short}
          />
        </div>
      </section>

      {/* ============================================================ */}
      <section className="mb-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label={period.isCurrent ? "Same months last year" : "Prior year"}
            value={formatMoney(period.isCurrent ? priorToDate : billing.priorFyTotal)}
            emphasis
            caption="like-for-like comparison base"
          />
          <StatTile
            label={billedTotalLabel(period.isCurrent)}
            value={formatMoney(billedTotal(period.isCurrent, billing.ytd, billing.fyForecast))}
            emphasis
            caption={`${period.actualMonthCount} months closed · budget ${formatMoney(
              billing.ytdBudget,
            )}`}
            delta={
              <TrendPill
                trend={yoy > 0.75 ? "up" : yoy < -0.75 ? "down" : "flat"}
                value={yoy}
                direction="lower-better"
                label="YoY"
              />
            }
          />
          <StatTile
            label={billing.currentMonthLabel}
            value={formatMoney(billing.currentTotal)}
            emphasis
            delta={
              <TrendPill
                trend={billing.momPct > 0.75 ? "up" : billing.momPct < -0.75 ? "down" : "flat"}
                value={billing.momPct}
                direction="lower-better"
                label="MoM"
              />
            }
          />
          <StatTile
            label="Previous month"
            value={formatMoney(billing.prevMonthTotal)}
            emphasis
            caption={`${totalMovement >= 0 ? "+" : "−"}${formatMoney(Math.abs(totalMovement))} movement`}
          />
          <StatTile
            label="Variance to budget"
            value={`${billing.ytdVariancePct >= 0 ? "+" : "−"}${Math.abs(billing.ytdVariancePct).toFixed(1)}%`}
            emphasis
            status={Math.abs(billing.ytdVariancePct) < 5 ? "good" : "warn"}
            caption={`${formatMoney(Math.abs(billing.ytd - billing.ytdBudget))} ${
              billing.ytd >= billing.ytdBudget ? "over" : "under"
            } YTD`}
          />
          <StatTile
            label="Outstanding"
            value={formatMoney(billing.outstanding)}
            emphasis
            status={billing.outstandingAgeing[3].amount > billing.outstanding * 0.1 ? "warn" : "good"}
            caption={`${formatMoney(billing.outstandingAgeing[3].amount)} over 90 days`}
          />
        </div>
      </section>

      {/* ============================================================ */}
      {/* Trend + composition                                          */}
      {/* ============================================================ */}
      <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <MonthlyTrendCard
          eyebrow="Monthly billing"
          title="Billing against budget across the year"
          data={rangeMonths.map((m) => ({
            label: m.short,
            value: m.total,
            isActual: m.isActual,
            budget: m.budget,
            prior: m.prior,
          }))}
          format={(n) => `₹${formatMoneyAxis(n)}`}
          height={250}
          valueLabel="Billed"
        />

        <Card>
          <CardHeader eyebrow="Composition" title={`Billing by service · ${range.label}`} />
          <DonutChart
            segments={rangeByService.map((r) => ({
              key: r.key,
              label: services.find((s) => s.service.id === r.key)?.service.code ?? r.key,
              value: r.value,
              color: r.color,
            }))}
            format={(n) => formatMoney(n)}
            size={160}
            centerValue={formatMoney(rangeTotal)}
            centerLabel={range.label}
          />
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Cumulative + split                                           */}
      {/* ============================================================ */}
      <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <MonthlyTrendCard
          eyebrow="Running total"
          title="Cumulative billed against cumulative budget"
          data={cumulative}
          format={(n) => `₹${formatMoneyAxis(n)}`}
          valueLabel="Cumulative billed"
        />

        <div className="grid gap-4">
          <Card>
            <CardHeader eyebrow={range.label} title="Transaction versus capacity" />
            <HBarList
              items={[
                {
                  key: "txn",
                  label: "Transaction-based",
                  sublabel: "volume × contracted rate",
                  value: rangeTxn,
                  color: "var(--color-accent)",
                },
                {
                  key: "fte",
                  label: "FTE-based",
                  sublabel: "dedicated capacity",
                  value: rangeFte,
                  color: "var(--color-svc-hrops)",
                },
              ]}
              format={(n) => formatMoney(n)}
              showShare
            />
          </Card>

          <Card>
            <CardHeader eyebrow={range.label} title="Spend by service" />
            <HBarList items={rangeByService} format={(n) => formatMoney(n)} showShare />
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Stacked view                                                 */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="How the mix changes through the year"
          subtitle="Faded columns are forecast."
        />
        <Card>
          <StackedColumns
            labels={rangeMonths.map((m) => m.short)}
            actualFlags={rangeMonths.map((m) => m.isActual)}
            series={services.map((s) => ({
              key: s.service.id,
              label: s.service.name,
              color: serviceColor(s.service.id),
              values: inRange(s.billing.monthly).map((m) => m.total),
            }))}
            format={(n) => `₹${formatMoneyAxis(n)}`}
            height={280}
          />
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Why did it change                                            */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title={`Why billing moved ${billing.momPct >= 0 ? "up" : "down"} ${Math.abs(billing.momPct).toFixed(1)}% this month`}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              eyebrow="Attribution"
              title="Largest contributors to the movement"
              action={
                <Badge tone={totalMovement >= 0 ? "warn" : "good"}>
                  {totalMovement >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(totalMovement))} total
                </Badge>
              }
            />
            <ul className="space-y-3.5">
              {allDrivers.map((d) => {
                const positive = d.deltaAmount >= 0;
                const magnitude =
                  Math.abs(d.deltaAmount) / Math.max(...allDrivers.map((x) => Math.abs(x.deltaAmount)), 1);
                return (
                  <li key={`${d.serviceId}-${d.label}`}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: serviceColor(d.serviceId) }}
                        />
                        <span className="truncate text-[13px] text-ink-2">
                          {d.label}
                          <span className="ml-2 text-[11.5px] text-ink-4">
                            {formatNumber(d.fromVolume ?? 0)} → {formatNumber(d.toVolume ?? 0)}
                            {d.kind === "fte" ? " FTE" : ""}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold text-ink tnum">
                        {positive ? "+" : "−"}
                        {formatMoney(Math.abs(d.deltaAmount))}
                      </span>
                    </div>
                    <div className="h-[7px] w-full overflow-hidden rounded-full bg-line-soft">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${magnitude * 100}%`,
                          background: positive ? serviceColor(d.serviceId) : "var(--color-ink-4)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 rounded-lg border border-line bg-surface-sunken p-4">
              <p className="text-[13px] leading-relaxed text-ink-2">
                <span className="font-semibold text-ink">In plain terms.</span>{" "}
                {biggestMover.service.name} moved{" "}
                {biggestMover.billing.momPct >= 0 ? "up" : "down"}{" "}
                {Math.abs(biggestMover.billing.momPct).toFixed(1)}% and accounts for the largest part of
                the change. {biggestMover.billing.narrative}
              </p>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader eyebrow="Charging model" title="Transaction versus capacity" />
              <HBarList
                items={[
                  {
                    key: "txn",
                    label: "Transaction-based",
                    sublabel: "volume × contracted rate",
                    value: billing.modelSplit.txn,
                    color: "var(--color-accent)",
                  },
                  {
                    key: "fte",
                    label: "FTE-based",
                    sublabel: "dedicated capacity",
                    value: billing.modelSplit.fte,
                    color: "var(--color-svc-hrops)",
                  },
                ]}
                format={(n) => formatMoney(n)}
                showShare
              />
              <p className="mt-4 border-t border-line-soft pt-3 text-[11.5px] leading-relaxed text-ink-4">
                Transaction charges flex with your volume. Capacity charges are fixed for the month and
                change only when the agreed team size changes.
              </p>
            </Card>

            <Card>
              <CardHeader eyebrow="Receivables" title="Outstanding by age" />
              <HBarList
                items={billing.outstandingAgeing.map((b, i) => ({
                  key: b.bucket,
                  label: b.bucket,
                  value: b.amount,
                  color:
                    i === 3
                      ? "var(--color-bad)"
                      : i === 2
                        ? "var(--color-warn)"
                        : "var(--color-accent)",
                }))}
                format={(n) => formatMoney(n)}
                showShare
              />
            </Card>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Quarter view + service table                                 */}
      {/* ============================================================ */}
      <section className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader
            eyebrow="Period comparison"
            title="Billing by quarter"
            subtitle="Faded columns include forecast months."
          />
          <TrendChart
            data={billing.quarters.map((q) => ({
              label: q.label,
              value: q.total,
              isActual: q.isActual,
            }))}
            format={(n) => `₹${formatMoneyAxis(n)}`}
            height={200}
            valueLabel="Billed"
          />
          <div className="mt-4 space-y-0 border-t border-line-soft pt-3">
            <DataRow
              label={`${period.label} ${period.isCurrent ? "billed to date" : "billed"}`}
              value={formatMoney(billedTotal(period.isCurrent, billing.ytd, billing.fyForecast))}
            />
            <DataRow
              label={period.isCurrent ? "Same months last year" : "Prior year actual"}
              value={formatMoney(period.isCurrent ? priorToDate : billing.priorFyTotal)}
            />
            <DataRow
              label="Year-on-year change"
              value={`${yoy >= 0 ? "+" : "−"}${Math.abs(yoy).toFixed(1)}%`}
              emphasis
            />
          </div>
        </Card>

        <Card padded={false}>
          <div className="p-5">
            <CardHeader
              eyebrow="Detail"
              title="Billing by service"
            />
            <Table>
              <thead>
                <tr>
                  <Th>Service</Th>
                  <Th align="right">This month</Th>
                  <Th align="right">YTD</Th>
                  <Th align="right">YTD budget</Th>
                  <Th align="right">Variance</Th>
                  <Th align="right">{period.isCurrent ? "Billed to date" : "Full year"}</Th>
                  <Th align="right">Share</Th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.service.id} className="transition-colors hover:bg-surface-sunken">
                    <Td>
                      <Link
                        href={`/services/${s.service.id}?tab=billing`}
                        className="flex items-center gap-2.5 font-medium text-ink"
                      >
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: serviceColor(s.service.id) }}
                        />
                        {s.service.code}
                      </Link>
                    </Td>
                    <Td align="right">{formatMoney(s.billing.currentTotal)}</Td>
                    <Td align="right">{formatMoney(s.billing.ytd)}</Td>
                    <Td align="right" muted>
                      {formatMoney(s.billing.ytdBudget)}
                    </Td>
                    <Td align="right">
                      <span
                        className={
                          Math.abs(s.billing.ytdVariancePct) < 5
                            ? "text-ink-2"
                            : s.billing.ytdVariancePct > 0
                              ? "text-warn"
                              : "text-good"
                        }
                      >
                        {s.billing.ytdVariancePct >= 0 ? "+" : "−"}
                        {Math.abs(s.billing.ytdVariancePct).toFixed(1)}%
                      </span>
                    </Td>
                    <Td align="right" className="font-medium">
                      {formatMoney(
                        billedTotal(period.isCurrent, s.billing.ytd, s.billing.fyForecast),
                      )}
                    </Td>
                    <Td align="right" muted>
                      {(s.billing.mix * 100).toFixed(1)}%
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td className="font-semibold">Total</Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(billing.currentTotal)}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(billing.ytd)}
                  </Td>
                  <Td align="right" muted>
                    {formatMoney(billing.ytdBudget)}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {billing.ytdVariancePct >= 0 ? "+" : "−"}
                    {Math.abs(billing.ytdVariancePct).toFixed(1)}%
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(billedTotal(period.isCurrent, billing.ytd, billing.fyForecast))}
                  </Td>
                  <Td align="right" muted>
                    100%
                  </Td>
                </tr>
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Current month invoice                                        */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title={`${billing.currentMonthLabel} in full`}
        />
        <Card padded={false}>
          <div className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Service</Th>
                  <Th>Charge line</Th>
                  <Th>Basis</Th>
                  <Th align="right">Volume</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {services.flatMap((s) => [
                  ...s.billing.txnLines.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-surface-sunken">
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: serviceColor(s.service.id) }}
                          />
                          {s.service.code}
                        </span>
                      </Td>
                      <Td>{l.label}</Td>
                      <Td muted>Transaction</Td>
                      <Td align="right">{formatNumber(l.volume)}</Td>
                      <Td align="right" muted>
                        {l.rate >= 100 ? formatMoney(l.rate) : `₹${l.rate}`} / {l.unitSingular}
                      </Td>
                      <Td align="right" className="font-medium">
                        {formatMoney(l.amount)}
                      </Td>
                    </tr>
                  )),
                  ...s.billing.fteLines.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-surface-sunken">
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: serviceColor(s.service.id) }}
                          />
                          {s.service.code}
                        </span>
                      </Td>
                      <Td>{l.role}</Td>
                      <Td muted>Dedicated FTE</Td>
                      <Td align="right">{l.fte}</Td>
                      <Td align="right" muted>
                        {formatMoney(l.ratePerFte)} / FTE
                      </Td>
                      <Td align="right" className="font-medium">
                        {formatMoney(l.amount)}
                      </Td>
                    </tr>
                  )),
                ])}
                <tr>
                  <Td className="font-semibold">Total</Td>
                  <Td colSpan={4} />
                  <Td align="right" className="font-semibold">
                    {formatMoney(billing.currentTotal)}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </div>
        </Card>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-4">
          Total for {billing.currentMonthLabel}: {formatMoney(billing.currentTotal)} —{" "}
          {formatPercent((billing.modelSplit.txn / billing.fyForecast) * 100)} of your SSC fee is
          transaction-based and flexes with volume.
        </p>
      </section>
    </div>
  );
}
