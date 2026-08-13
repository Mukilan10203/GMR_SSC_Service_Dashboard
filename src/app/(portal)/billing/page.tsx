"use client";

import Link from "next/link";
import { usePortalData } from "@/components/portal/usePortalData";
import { PageHeader } from "@/components/portal/blocks";
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
import { ColumnChart, DonutChart, HBarList, StackedColumns, TrendChart } from "@/components/charts";
import { formatMoney, formatMoneyAxis, formatNumber, formatPercent } from "@/lib/format";

export default function BillingPage() {
  const { snapshot } = usePortalData();
  if (!snapshot) return null;

  const { billing, services, period, entity } = snapshot;

  const biggestService = [...services].sort((a, b) => b.billing.fyForecast - a.billing.fyForecast)[0];
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
        subtitle={
          <>
            Every rupee the SSC charges {entity.name} traces to a counted transaction or a named role.
            This page explains the total, the movement and the variance against budget.
          </>
        }
      />

      {/* ============================================================ */}
      <section className="mb-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Full-year forecast"
            value={formatMoney(billing.fyForecast)}
            emphasis
            caption={`Budget ${formatMoney(billing.fyBudget)}`}
            delta={
              <TrendPill
                trend={billing.yoyPct > 0.75 ? "up" : billing.yoyPct < -0.75 ? "down" : "flat"}
                value={billing.yoyPct}
                direction="lower-better"
                label="YoY"
              />
            }
          />
          <StatTile
            label="Billed year to date"
            value={formatMoney(billing.ytd)}
            emphasis
            caption={`${period.actualMonthCount} months closed`}
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
        <Card>
          <CardHeader
            eyebrow="Monthly billing"
            title="Billing against budget across the year"
            subtitle={billing.narrative}
          />
          <TrendChart
            data={billing.monthly.map((m) => ({
              label: m.short,
              value: m.total,
              isActual: m.isActual,
              budget: m.budget,
            }))}
            format={(n) => `₹${formatMoneyAxis(n)}`}
            height={250}
            valueLabel="Billed"
            budgetLabel="Budget"
          />
        </Card>

        <Card>
          <CardHeader
            eyebrow="Composition"
            title="Full-year billing by service"
            subtitle={`${biggestService.service.name} is the largest single service at ${(
              biggestService.billing.mix * 100
            ).toFixed(0)}% of your spend.`}
          />
          <DonutChart
            segments={services.map((s) => ({
              key: s.service.id,
              label: s.service.code,
              value: s.billing.fyForecast,
              color: serviceColor(s.service.id),
            }))}
            format={(n) => formatMoney(n)}
            size={160}
            centerValue={formatMoney(billing.fyForecast)}
            centerLabel="Full year"
          />
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Stacked view                                                 */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="How the mix changes through the year"
          subtitle="Each month's fee split by service tower. Faded columns are forecast."
        />
        <Card>
          <StackedColumns
            labels={billing.monthly.map((m) => m.short)}
            actualFlags={billing.monthly.map((m) => m.isActual)}
            series={services.map((s) => ({
              key: s.service.id,
              label: s.service.name,
              color: serviceColor(s.service.id),
              values: s.billing.monthly.map((m) => m.total),
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
          subtitle="The specific charge lines behind the movement, ranked by rupee impact across every service."
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
          <ColumnChart
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
            <DataRow label={`${period.label} forecast`} value={formatMoney(billing.fyForecast)} />
            <DataRow label="Prior year actual" value={formatMoney(billing.priorFyTotal)} />
            <DataRow
              label="Year-on-year change"
              value={`${billing.yoyPct >= 0 ? "+" : "−"}${Math.abs(billing.yoyPct).toFixed(1)}%`}
              emphasis
            />
          </div>
        </Card>

        <Card padded={false}>
          <div className="p-5">
            <CardHeader
              eyebrow="Detail"
              title="Billing by service"
              subtitle="Select any service to see the line-by-line calculation behind its fee."
            />
            <Table>
              <thead>
                <tr>
                  <Th>Service</Th>
                  <Th align="right">This month</Th>
                  <Th align="right">YTD</Th>
                  <Th align="right">YTD budget</Th>
                  <Th align="right">Variance</Th>
                  <Th align="right">Full year</Th>
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
                      {formatMoney(s.billing.fyForecast)}
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
                    {formatMoney(billing.fyForecast)}
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
          subtitle="Every charge line the SSC has raised this month, across all services."
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
          {formatPercent((billing.modelSplit.txn / billing.fyForecast) * 100)} of your full-year fee is
          transaction-based and flexes with volume.
        </p>
      </section>
    </div>
  );
}
