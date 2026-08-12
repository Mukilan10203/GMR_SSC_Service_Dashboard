"use client";

import { useMemo } from "react";
import { useSession } from "@/state/session";
import { getPortfolio } from "@/lib/api";
import { PageHeader } from "@/components/portal/blocks";
import {
  Card,
  CardHeader,
  SectionHeading,
  StatTile,
  StatusPill,
  Table,
  Td,
  Th,
  TrendPill,
} from "@/components/ui/primitives";
import { HBarList } from "@/components/charts";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

/**
 * Group-scope view. Only reachable for users authorised on more than one
 * entity — it answers "which of my entities needs attention" before the
 * user has to pick one from the scope switcher.
 */
export default function PortfolioPage() {
  const { user, periodId, setEntity } = useSession();

  const rows = useMemo(
    () => (user && periodId ? getPortfolio(user, periodId) : []),
    [user, periodId],
  );

  if (!user) return null;

  if (rows.length <= 1) {
    return (
      <div className="mx-auto max-w-[720px] py-20 text-center">
        <h1 className="text-[20px] font-semibold text-ink">Portfolio view is for group scope</h1>
        <p className="mt-2 text-[13.5px] text-ink-3">
          Your account is authorised for a single entity, so the executive dashboard already shows
          everything in your scope.
        </p>
      </div>
    );
  }

  const totalFy = rows.reduce((a, r) => a + r.fyForecast, 0);
  const totalYtd = rows.reduce((a, r) => a + r.ytdBilling, 0);
  const totalIssues = rows.reduce((a, r) => a + r.openIssues, 0);
  const totalCritical = rows.reduce((a, r) => a + r.criticalIssues, 0);
  const weightedSla =
    rows.reduce((a, r) => a + r.sla * r.fyForecast, 0) / Math.max(1, totalFy);
  const weightedCsat =
    rows.reduce((a, r) => a + r.csat * r.fyForecast, 0) / Math.max(1, totalFy);

  const byLocation = rows.reduce<Record<string, { name: string; value: number }>>((acc, r) => {
    const cur = acc[r.location.id] ?? { name: r.location.name, value: 0 };
    cur.value += r.fyForecast;
    acc[r.location.id] = cur;
    return acc;
  }, {});

  const worst = [...rows].sort((a, b) => a.sla - a.slaTarget - (b.sla - b.slaTarget))[0];

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="Group scope"
        title="Portfolio across all entities"
        subtitle={`${rows.length} entities across ${Object.keys(byLocation).length} locations. Select any entity to switch the whole portal to it.`}
      />

      <section className="mb-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Group SSC billing" value={formatMoney(totalFy)} emphasis caption="Full-year forecast" />
          <StatTile label="Billed year to date" value={formatMoney(totalYtd)} emphasis />
          <StatTile
            label="Weighted SLA"
            value={formatPercent(weightedSla)}
            emphasis
            status={weightedSla >= 95 ? "good" : weightedSla >= 92 ? "warn" : "bad"}
          />
          <StatTile label="Weighted CSAT" value={`${weightedCsat.toFixed(1)} / 5`} emphasis />
          <StatTile label="Open issues" value={formatNumber(totalIssues)} emphasis />
          <StatTile
            label="Critical issues"
            value={formatNumber(totalCritical)}
            emphasis
            status={totalCritical > 0 ? "bad" : "good"}
          />
        </div>
      </section>

      {worst && worst.sla < worst.slaTarget && (
        <div className="mb-8 rounded-lg border border-bad-line bg-bad-soft p-4">
          <p className="text-[13.5px] font-semibold text-bad">
            {worst.entity.name} is the weakest performer in the portfolio
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
            SLA is {worst.sla.toFixed(1)}% against a {worst.slaTarget.toFixed(1)}% commitment, with{" "}
            {worst.criticalIssues} critical issue{worst.criticalIssues === 1 ? "" : "s"} open. Switch to
            that entity for the service-level breakdown.
          </p>
          <button
            type="button"
            onClick={() => setEntity(worst.entity.id)}
            className="mt-3 rounded-lg bg-rail px-3.5 py-2 text-[12.5px] font-medium text-white"
          >
            Switch to {worst.entity.shortName} →
          </button>
        </div>
      )}

      <section className="mb-8">
        <SectionHeading
          title="Entities"
          subtitle="Ranked by full-year SSC spend. Select a row to make it the active entity across the portal."
        />
        <Card padded={false}>
          <div className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Entity</Th>
                  <Th>Location</Th>
                  <Th align="right">Services</Th>
                  <Th align="right">YTD billing</Th>
                  <Th align="right">Full year</Th>
                  <Th align="right">MoM</Th>
                  <Th align="center">SLA</Th>
                  <Th align="right">CSAT</Th>
                  <Th align="right">NPS</Th>
                  <Th align="right">Open</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.entity.id}
                    onClick={() => setEntity(r.entity.id)}
                    className="cursor-pointer transition-colors hover:bg-surface-sunken"
                  >
                    <Td>
                      <span className="block font-medium text-ink">{r.entity.name}</span>
                      <span className="block text-[11.5px] text-ink-4">{r.entity.sector}</span>
                    </Td>
                    <Td muted>{r.location.name}</Td>
                    <Td align="right">{r.serviceCount}</Td>
                    <Td align="right">{formatMoney(r.ytdBilling)}</Td>
                    <Td align="right" className="font-medium">
                      {formatMoney(r.fyForecast)}
                    </Td>
                    <Td align="right">
                      <TrendPill
                        trend={r.momPct > 0.75 ? "up" : r.momPct < -0.75 ? "down" : "flat"}
                        value={r.momPct}
                        direction="lower-better"
                      />
                    </Td>
                    <Td align="center">
                      <StatusPill
                        status={r.sla >= r.slaTarget ? "good" : r.sla >= r.slaTarget - 3 ? "warn" : "bad"}
                        size="sm"
                      >
                        {r.sla.toFixed(1)}%
                      </StatusPill>
                    </Td>
                    <Td align="right">{r.csat.toFixed(1)}</Td>
                    <Td align="right">
                      {r.nps >= 0 ? "+" : ""}
                      {r.nps}
                    </Td>
                    <Td align="right">
                      <span className={r.criticalIssues > 0 ? "font-semibold text-bad" : ""}>
                        {r.openIssues}
                      </span>
                      {r.criticalIssues > 0 && (
                        <span className="block text-[11px] text-bad">{r.criticalIssues} critical</span>
                      )}
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td className="font-semibold">Group total</Td>
                  <Td muted>{Object.keys(byLocation).length} locations</Td>
                  <Td />
                  <Td align="right" className="font-semibold">
                    {formatMoney(totalYtd)}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(totalFy)}
                  </Td>
                  <Td />
                  <Td align="center">
                    <StatusPill status={weightedSla >= 95 ? "good" : "warn"} size="sm">
                      {weightedSla.toFixed(1)}%
                    </StatusPill>
                  </Td>
                  <Td align="right" className="font-semibold">
                    {weightedCsat.toFixed(1)}
                  </Td>
                  <Td />
                  <Td align="right" className="font-semibold">
                    {totalIssues}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Geography" title="SSC spend by location" subtitle="Full-year forecast." />
          <HBarList
            items={Object.entries(byLocation).map(([id, v]) => ({
              key: id,
              label: v.name,
              value: v.value,
              color: "var(--color-accent)",
            }))}
            format={(n) => formatMoney(n)}
            showShare
          />
        </Card>

        <Card>
          <CardHeader
            eyebrow="Service quality"
            title="SLA gap by entity"
            subtitle="Percentage points above or below each entity's contracted target."
          />
          <HBarList
            items={[...rows]
              .sort((a, b) => a.sla - a.slaTarget - (b.sla - b.slaTarget))
              .map((r) => ({
                key: r.entity.id,
                label: r.entity.shortName,
                sublabel: `${r.sla.toFixed(1)}% vs ${r.slaTarget.toFixed(1)}%`,
                value: Math.round((r.sla - r.slaTarget) * 10) / 10,
                color: r.sla >= r.slaTarget ? "var(--color-good)" : "var(--color-bad)",
              }))}
            format={(n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)} pts`}
          />
        </Card>
      </section>
    </div>
  );
}
