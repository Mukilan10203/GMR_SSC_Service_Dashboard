"use client";

import Link from "next/link";
import { usePortalData } from "@/components/portal/usePortalData";
import { AttentionSection, LockedPage, PageHeader } from "@/components/portal/blocks";
import {
  Badge,
  Card,
  CardHeader,
  DataRow,
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
import { HBarList, QuarterStrip, Sparkline, TrendChart } from "@/components/charts";
import { FeedbackCard } from "@/components/portal/issue-blocks";
import { formatMetric, formatNumber, formatPercent } from "@/lib/format";

export default function PerformancePage() {
  const { snapshot } = usePortalData();
  if (!snapshot) return null;
  return <LockedPage title="Performance" />;
}

function PerformancePageUnlocked() {
  const { snapshot } = usePortalData();
  if (!snapshot) return null;

  const { services, sla, cx: exp, attention, counts, period } = snapshot;

  const allKpis = services.flatMap((s) => s.kpis.map((k) => ({ kpi: k, service: s })));
  const offTarget = allKpis.filter((x) => x.kpi.status === "bad");
  const atRisk = allKpis.filter((x) => x.kpi.status === "warn");

  // Entity SLA trend = billing-weighted service SLA, month by month.
  const slaTrend = period.months.map((m, i) => ({
    label: m.short,
    value:
      Math.round(
        services.reduce((a, s) => a + s.sla.monthly[i].value * s.billing.mix, 0) * 100,
      ) / 100,
    isActual: m.isActual,
  }));

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="Performance"
        title="How the SSC is performing for you"
        subtitle="Service levels, key performance indicators and customer experience across every service tower, with the exceptions that need a decision surfaced first."
        actions={
          <StatusPill status={sla.status}>
            Overall SLA {formatPercent(sla.overall)} · target {sla.target.toFixed(1)}%
          </StatusPill>
        }
      />

      {/* ============================================================ */}
      <section className="mb-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Overall SLA"
            value={formatPercent(sla.overall)}
            emphasis
            status={sla.status}
            caption={`Target ${sla.target.toFixed(1)}%`}
            delta={<TrendPill trend={sla.trend} value={sla.deltaPts} direction="higher-better" unit=" pts" label="MoM" />}
          />
          <StatTile
            label="KPIs on target"
            value={`${allKpis.length - offTarget.length - atRisk.length} of ${allKpis.length}`}
            emphasis
            status={offTarget.length > 0 ? "bad" : atRisk.length > 0 ? "warn" : "good"}
            caption={`${offTarget.length} off target, ${atRisk.length} at risk`}
          />
          <StatTile
            label="Customer satisfaction"
            value={`${exp.csat.toFixed(1)} / 5`}
            emphasis
            caption={`${exp.respondents} responses`}
          />
          <StatTile
            label="Net promoter score"
            value={`${exp.nps >= 0 ? "+" : ""}${exp.nps}`}
            emphasis
            caption={exp.npsQuarters[exp.npsQuarters.length - 1]?.label}
          />
          <StatTile
            label="Open issues"
            value={formatNumber(counts.openIssues)}
            emphasis
            caption={`${counts.criticalIssues} critical`}
            status={counts.criticalIssues > 0 ? "bad" : "good"}
          />
          <StatTile
            label="Average resolution"
            value={`${counts.avgResolutionDays.toFixed(1)} days`}
            emphasis
            caption={`${counts.resolvedThisPeriod} resolved recently`}
          />
        </div>
      </section>

      {/* ============================================================ */}
      <div className="mb-8">
        <AttentionSection items={attention} limit={6} />
      </div>

      {/* ============================================================ */}
      {/* SLA by service                                               */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Service levels"
          subtitle="Each service's weighted SLA against its contracted target, and the trend through the year."
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card padded={false}>
            <div className="p-5">
              <Table>
                <thead>
                  <tr>
                    <Th>Service</Th>
                    <Th align="right">Achieved</Th>
                    <Th align="right">Target</Th>
                    <Th align="right">Gap</Th>
                    <Th>Trend</Th>
                    <Th align="right">Weight</Th>
                    <Th align="center">Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => {
                    const gap = s.sla.overall - s.sla.target;
                    return (
                      <tr key={s.service.id} className="transition-colors hover:bg-surface-sunken">
                        <Td>
                          <Link
                            href={`/services/${s.service.id}?tab=kpi`}
                            className="flex items-center gap-2.5"
                          >
                            <span
                              className="size-2.5 rounded-full"
                              style={{ background: serviceColor(s.service.id) }}
                            />
                            <span>
                              <span className="block font-medium text-ink">{s.service.code}</span>
                              <span className="block text-[11.5px] text-ink-4">{s.service.name}</span>
                            </span>
                          </Link>
                          <div className="mt-2 max-w-[200px]">
                            <ProgressBar
                              value={s.sla.overall}
                              max={100}
                              height={4}
                              color={
                                s.sla.status === "good"
                                  ? "var(--color-good)"
                                  : s.sla.status === "warn"
                                    ? "var(--color-warn)"
                                    : "var(--color-bad)"
                              }
                              label={`${s.service.code} SLA ${s.sla.overall}%`}
                            />
                          </div>
                        </Td>
                        <Td align="right" className="font-semibold">
                          {s.sla.overall.toFixed(1)}%
                        </Td>
                        <Td align="right" muted>
                          {s.sla.target}%
                        </Td>
                        <Td align="right">
                          <span className={gap >= 0 ? "text-good" : "text-bad"}>
                            {gap >= 0 ? "+" : "−"}
                            {Math.abs(gap).toFixed(1)} pts
                          </span>
                        </Td>
                        <Td>
                          <Sparkline
                            values={s.sla.monthly.filter((m) => m.isActual).map((m) => m.value)}
                            width={80}
                            height={22}
                            color={serviceColor(s.service.id)}
                            area={false}
                          />
                        </Td>
                        <Td align="right" muted>
                          {(s.billing.mix * 100).toFixed(0)}%
                        </Td>
                        <Td align="center">
                          <StatusPill status={s.sla.status} size="sm" />
                        </Td>
                      </tr>
                    );
                  })}
                  <tr>
                    <Td className="font-semibold">Weighted overall</Td>
                    <Td align="right" className="font-semibold">
                      {sla.overall.toFixed(1)}%
                    </Td>
                    <Td align="right" muted>
                      {sla.target.toFixed(1)}%
                    </Td>
                    <Td align="right" className="font-semibold">
                      {sla.overall - sla.target >= 0 ? "+" : "−"}
                      {Math.abs(sla.overall - sla.target).toFixed(1)} pts
                    </Td>
                    <Td colSpan={2} />
                    <Td align="center">
                      <StatusPill status={sla.status} size="sm" />
                    </Td>
                  </tr>
                </tbody>
              </Table>
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-4">
                The overall figure is weighted by each service&rsquo;s share of your spend, so a large
                service moving matters more than a small one.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Overall trend"
              title="Weighted SLA across the year"
              subtitle="Hatched months are projected on current performance."
            />
            <TrendChart
              data={slaTrend}
              format={(n) => `${n.toFixed(1)}%`}
              height={210}
              zeroAnchored={false}
              valueLabel="Weighted SLA"
            />
            <div className="mt-4 space-y-0 border-t border-line-soft pt-3">
              <DataRow label="Best performing" value={
                [...services].sort((a, b) => b.sla.overall - a.sla.overall)[0].service.name
              } />
              <DataRow label="Weakest" value={
                [...services].sort((a, b) => a.sla.overall - b.sla.overall)[0].service.name
              } />
              <DataRow
                label="Services meeting target"
                value={`${services.filter((s) => s.sla.status === "good").length} of ${services.length}`}
                emphasis
              />
            </div>
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/* All KPIs                                                     */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Every contracted KPI"
          subtitle={`${allKpis.length} indicators across ${services.length} services. Anything off target is listed first.`}
          action={
            <div className="flex gap-2">
              {offTarget.length > 0 && <Badge tone="bad">{offTarget.length} off target</Badge>}
              {atRisk.length > 0 && <Badge tone="warn">{atRisk.length} at risk</Badge>}
              <Badge tone="good">
                {allKpis.length - offTarget.length - atRisk.length} on target
              </Badge>
            </div>
          }
        />
        <Card padded={false}>
          <div className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Indicator</Th>
                  <Th>Service</Th>
                  <Th align="right">Actual</Th>
                  <Th align="right">Target</Th>
                  <Th align="right">Trend</Th>
                  <Th align="center">Status</Th>
                  <Th>What sits behind it</Th>
                </tr>
              </thead>
              <tbody>
                {[...allKpis]
                  .sort((a, b) => {
                    const rank = { bad: 0, warn: 1, good: 2 } as const;
                    return rank[a.kpi.status] - rank[b.kpi.status];
                  })
                  .map(({ kpi, service }) => (
                    <tr key={kpi.id} className="transition-colors hover:bg-surface-sunken">
                      <Td>
                        <Link href={`/services/${service.service.id}?tab=kpi`} className="font-medium text-ink">
                          {kpi.name}
                        </Link>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: serviceColor(service.service.id) }}
                          />
                          {service.service.code}
                        </span>
                      </Td>
                      <Td align="right" className="font-semibold">
                        {formatMetric(kpi.actual, kpi.unit)}
                      </Td>
                      <Td align="right" muted>
                        {kpi.direction === "higher-better" ? "≥" : "≤"} {formatMetric(kpi.target, kpi.unit)}
                      </Td>
                      <Td align="right">
                        <TrendPill trend={kpi.trend} value={kpi.deltaPct} direction={kpi.direction} />
                      </Td>
                      <Td align="center">
                        <StatusPill status={kpi.status} size="sm" />
                      </Td>
                      <Td muted className="max-w-[280px] text-[12px]">
                        {kpi.gapNarrative}
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Customer experience                                          */}
      {/* ============================================================ */}
      <section className="scroll-mt-24" id="experience">
        <SectionHeading
          title="Customer experience"
          subtitle="Satisfaction, advocacy and the comments behind them."
          action={
            <Link href="/issues#feedback" className="text-[12.5px] font-medium text-accent hover:text-accent-strong">
              All feedback →
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader
              eyebrow="Net promoter score"
              title="Quarterly relationship survey"
              subtitle="Surveyed once a quarter — NPS measures the relationship, not the transaction."
            />
            <QuarterStrip
              points={exp.npsQuarters.map((q) => ({
                label: q.label,
                value: q.score,
                isPartial: q.isPartial,
              }))}
            />
            <Table className="mt-5">
              <thead>
                <tr>
                  <Th>Quarter</Th>
                  <Th align="right">Promoters</Th>
                  <Th align="right">Passives</Th>
                  <Th align="right">Detractors</Th>
                  <Th align="right">NPS</Th>
                </tr>
              </thead>
              <tbody>
                {exp.npsQuarters.map((q) => (
                  <tr key={q.key}>
                    <Td>
                      {q.label}
                      {q.isPartial && <span className="ml-1 text-ink-4">*</span>}
                    </Td>
                    <Td align="right">{q.promoters}</Td>
                    <Td align="right" muted>
                      {q.passives}
                    </Td>
                    <Td align="right">{q.detractors}</Td>
                    <Td align="right" className="font-semibold">
                      {q.score >= 0 ? "+" : ""}
                      {q.score}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {exp.npsQuarters.some((q) => q.isPartial) && (
              <p className="mt-2 text-[11px] text-ink-4">* Survey still open for the current quarter.</p>
            )}
          </Card>

          <Card>
            <CardHeader
              eyebrow="Satisfaction"
              title={`${exp.csat.toFixed(1)} / 5 across all services`}
              subtitle="Collected from the business users who consume each service."
            />
            <HBarList
              items={exp.csatByService.map((c) => ({
                key: c.serviceId,
                label: services.find((s) => s.service.id === c.serviceId)?.service.name ?? c.serviceId,
                sublabel: `${c.responses} responses`,
                value: c.score,
                color: serviceColor(c.serviceId),
              }))}
              format={(n) => `${n.toFixed(1)} / 5`}
            />
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line-soft pt-4">
              <div className="rounded-lg border border-line bg-surface-sunken p-3">
                <p className="eyebrow-muted">Open complaints</p>
                <p className="mt-1.5 text-[19px] font-semibold text-ink tnum">{exp.openComplaints}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface-sunken p-3">
                <p className="eyebrow-muted">Escalations</p>
                <p className="mt-1.5 text-[19px] font-semibold text-ink tnum">{exp.escalations}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Voice of the customer"
              title="What people are saying"
              subtitle="The most recent comments across all services."
            />
            <div className="space-y-3">
              {snapshot.feedback.slice(0, 3).map((f) => (
                <FeedbackCard key={f.id} feedback={f} />
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
