"use client";

import Link from "next/link";
import { usePortalData } from "@/components/portal/usePortalData";
import {
  AttentionSection,
  ServiceCard,
  WelcomeHeader,
} from "@/components/portal/blocks";
import {
  Badge,
  Card,
  CardHeader,
  DataRow,
  SectionHeading,
  StatTile,
  StatusPill,
  TrendPill,
  serviceColor,
} from "@/components/ui/primitives";
import {
  DonutChart,
  HBarList,
  QuarterStrip,
  Sparkline,
  TrendChart,
} from "@/components/charts";
import { FeedbackCard } from "@/components/portal/issue-blocks";
import {
  formatMetric,
  formatMoney,
  formatMoneyAxis,
  formatNumber,
  formatPercent,
} from "@/lib/format";

export default function OverviewPage() {
  const { snapshot, user } = usePortalData();
  if (!snapshot || !user) return null;

  const { billing, sla, cx: exp, services, attention, counts, automation, analytics, exec } = snapshot;

  const criticalCount = counts.criticalIssues;
  const npsTrend = exp.npsQuarters.length >= 2
    ? exp.nps - exp.npsQuarters[exp.npsQuarters.length - 2].score
    : 0;

  const monthlyTrend = billing.monthly.map((m) => ({
    label: m.short,
    value: m.total,
    isActual: m.isActual,
    budget: m.budget,
  }));

  const automationSaving = automation?.costSavingYtd ?? 0;
  const analyticsValue = analytics?.valueIdentified ?? 0;

  return (
    <div className="mx-auto max-w-[1440px]">
      <WelcomeHeader snapshot={snapshot} userName={user.name} role={user.title} />

      {/* ============================================================ */}
      {/* Executive summary                                            */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Executive summary"
          subtitle={`Your Shared Service Centre position for ${snapshot.period.label}, as at ${snapshot.period.asOf}.`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Total SSC billing"
            value={formatMoney(billing.fyForecast)}
            emphasis
            caption={`${formatMoney(billing.ytd)} billed to date`}
            delta={
              <TrendPill
                trend={billing.yoyPct > 0.75 ? "up" : billing.yoyPct < -0.75 ? "down" : "flat"}
                value={billing.yoyPct}
                direction="lower-better"
                label="YoY"
              />
            }
            href="/billing"
          />
          <StatTile
            label="Overall SLA"
            value={formatPercent(sla.overall)}
            emphasis
            status={sla.status}
            caption={`Target ${sla.target.toFixed(1)}%`}
            delta={
              <TrendPill trend={sla.trend} value={sla.deltaPts} direction="higher-better" unit="pts" label="MoM" />
            }
            href="/performance"
          />
          <StatTile
            label="Customer satisfaction"
            value={`${exp.csat.toFixed(1)} / 5`}
            emphasis
            caption={`${exp.respondents} responses`}
            delta={
              <TrendPill
                trend={exp.csatDelta > 0.05 ? "up" : exp.csatDelta < -0.05 ? "down" : "flat"}
                value={exp.csatDelta}
                direction="higher-better"
                unit=""
                decimals={2}
                label="QoQ"
              />
            }
            href="/performance#experience"
          />
          <StatTile
            label="Net promoter score"
            value={`${exp.nps >= 0 ? "+" : ""}${exp.nps}`}
            emphasis
            caption={exp.npsQuarters[exp.npsQuarters.length - 1]?.label}
            delta={
              <TrendPill
                trend={npsTrend > 0 ? "up" : npsTrend < 0 ? "down" : "flat"}
                value={npsTrend}
                direction="higher-better"
                unit=" pts"
                decimals={0}
                label="QoQ"
              />
            }
            href="/performance#experience"
          />
          <StatTile
            label="Open issues"
            value={formatNumber(counts.openIssues)}
            emphasis
            caption={`${counts.resolvedThisPeriod} resolved recently`}
            href="/issues"
          />
          <StatTile
            label="Critical issues"
            value={formatNumber(criticalCount)}
            emphasis
            status={criticalCount > 0 ? "bad" : "good"}
            caption={criticalCount > 0 ? "Need a decision" : "Nothing critical"}
            accent={criticalCount > 0 ? "var(--color-bad)" : undefined}
            href="/issues?priority=critical"
          />
        </div>
      </section>

      {/* ============================================================ */}
      {/* Attention required                                           */}
      {/* ============================================================ */}
      <div className="mb-8">
        <AttentionSection items={attention} limit={4} showAllHref="/performance#attention" />
      </div>

      {/* ============================================================ */}
      {/* Services                                                     */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Services provided by the SSC"
          subtitle={`${services.length} services delivered to ${snapshot.entity.name}. Select any service for usage, billing, performance and issues.`}
          action={
            <Link href="/services" className="text-[12.5px] font-medium text-accent hover:text-accent-strong">
              Compare all services →
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.service.id} service={s} />
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* Billing                                                      */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Billing"
          subtitle="What you are paying, what is driving it, and how it compares with the agreed budget."
          action={
            <Link href="/billing" className="text-[12.5px] font-medium text-accent hover:text-accent-strong">
              Full billing analysis →
            </Link>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              eyebrow="Monthly billing"
              title="Twelve-month billing against budget"
              subtitle={billing.narrative}
            />
            <TrendChart
              data={monthlyTrend}
              format={(n) => `₹${formatMoneyAxis(n)}`}
              height={228}
              valueLabel="Billed"
              budgetLabel="Budget"
            />

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line-soft pt-4 sm:grid-cols-4">
              {[
                {
                  label: "This month",
                  value: formatMoney(billing.currentTotal),
                  hint: billing.currentMonthLabel,
                },
                {
                  label: "Previous month",
                  value: formatMoney(billing.prevMonthTotal),
                  hint: `${billing.momPct >= 0 ? "+" : "−"}${Math.abs(billing.momPct).toFixed(1)}% movement`,
                },
                {
                  label: "Year to date",
                  value: formatMoney(billing.ytd),
                  hint: `Budget ${formatMoney(billing.ytdBudget)}`,
                },
                {
                  label: "Outstanding",
                  value: formatMoney(billing.outstanding),
                  hint: `${formatMoney(billing.outstandingAgeing[3].amount)} over 90 days`,
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

          <div className="grid gap-4">
            <Card>
              <CardHeader
                eyebrow="Where the money goes"
                title="Full-year billing by service"
                action={
                  <Badge tone={billing.fyVariancePct >= 0 ? "warn" : "good"}>
                    {billing.fyVariancePct >= 0 ? "+" : "−"}
                    {Math.abs(billing.fyVariancePct).toFixed(1)}% vs budget
                  </Badge>
                }
              />
              <DonutChart
                segments={services.map((s) => ({
                  key: s.service.id,
                  label: s.service.code,
                  value: s.billing.fyForecast,
                  color: serviceColor(s.service.id),
                }))}
                format={(n) => formatMoney(n)}
                size={148}
                centerValue={formatMoney(billing.fyForecast)}
                centerLabel="Full year"
              />
            </Card>

            <Card>
              <CardHeader eyebrow="Charging model" title="How your fee is constructed" />
              <HBarList
                items={[
                  {
                    key: "txn",
                    label: "Transaction-based",
                    sublabel: "volume × rate",
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
                Every charge traces to a counted transaction or a named role on your account. Open any
                service and choose Billing to see the line-by-line calculation.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Customer experience                                          */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Customer experience"
          subtitle="What your people say about the service they are receiving."
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
              title="Measured quarterly"
              subtitle="NPS is a relationship measure, so it is surveyed once a quarter rather than tracked daily."
            />
            <QuarterStrip
              points={exp.npsQuarters.map((q) => ({
                label: q.label,
                value: q.score,
                isPartial: q.isPartial,
              }))}
            />
            <div className="mt-5 space-y-0 border-t border-line-soft pt-3">
              {(() => {
                const q = exp.npsQuarters[exp.npsQuarters.length - 1];
                return (
                  <>
                    <DataRow label="Promoters" value={`${q.promoters} (${((q.promoters / q.respondents) * 100).toFixed(0)}%)`} />
                    <DataRow label="Passives" value={`${q.passives} (${((q.passives / q.respondents) * 100).toFixed(0)}%)`} />
                    <DataRow label="Detractors" value={`${q.detractors} (${((q.detractors / q.respondents) * 100).toFixed(0)}%)`} />
                    <DataRow label="Responses" value={formatNumber(q.respondents)} emphasis />
                  </>
                );
              })()}
            </div>
            {exp.npsQuarters.some((q) => q.isPartial) && (
              <p className="mt-2 text-[11px] text-ink-4">* Current quarter is still in survey.</p>
            )}
          </Card>

          <Card>
            <CardHeader
              eyebrow="Satisfaction by service"
              title={`${exp.csat.toFixed(1)} / 5 overall`}
              subtitle="Weighted by each service's share of your spend."
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
          </Card>

          <Card>
            <CardHeader eyebrow="Open with the service desk" title="Complaints and escalations" />
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Open complaints", value: exp.openComplaints, tone: "warn" as const },
                { label: "Escalations", value: exp.escalations, tone: "bad" as const },
                { label: "Survey response rate", value: `${exp.responseRate.toFixed(0)}%`, tone: null },
                { label: "Avg resolution", value: `${counts.avgResolutionDays.toFixed(1)}d`, tone: null },
              ].map((t) => (
                <div key={t.label} className="rounded-lg border border-line bg-surface-sunken p-3.5">
                  <p className="eyebrow">{t.label}</p>
                  <p className="mt-1.5 text-[20px] font-semibold text-ink tnum">{t.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-line-soft pt-4">
              <p className="eyebrow mb-3">Most recent comment</p>
              {snapshot.feedback[0] ? (
                <FeedbackCard feedback={snapshot.feedback[0]} />
              ) : (
                <p className="text-[13px] text-ink-3">No feedback recorded this period.</p>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Value beyond transaction processing                          */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Value the SSC is creating"
          subtitle="Beyond processing transactions — effort released through automation, and money found through analytics."
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
          {automation && (
            <Card>
              <CardHeader
                eyebrow="Automation"
                title="Your digital workforce"
                action={<StatusPill status={automation.successRate >= 97 ? "good" : "warn"} size="sm">{automation.successRate.toFixed(1)}%</StatusPill>}
              />
              <div className="mb-4 flex items-end gap-3">
                <p className="metric text-[28px] leading-8 font-semibold tracking-[-0.02em] text-ink">
                  {formatMoney(automationSaving)}
                </p>
                <p className="pb-1 text-[12.5px] text-ink-3">saved year to date</p>
              </div>
              <div className="space-y-0">
                <DataRow label="Bots and AI agents" value={formatNumber(automation.totalBots)} />
                <DataRow
                  label="Transactions automated"
                  value={formatNumber(automation.transactionsAutomated)}
                  hint="This month"
                />
                <DataRow
                  label="Effort released"
                  value={`${formatNumber(automation.hoursSavedYtd)} hrs`}
                  hint="Year to date"
                />
                <DataRow
                  label="Return on automation fee"
                  value={`${automation.roi.toFixed(2)}×`}
                  emphasis
                />
              </div>
              <Link
                href="/automation"
                className="mt-4 inline-block text-[12.5px] font-medium text-accent hover:text-accent-strong"
              >
                Open the control tower →
              </Link>
            </Card>
          )}

          {analytics && (
            <Card>
              <CardHeader eyebrow="Analytics" title="Insight from your own data" />
              <div className="mb-4 flex items-end gap-3">
                <p className="metric text-[28px] leading-8 font-semibold tracking-[-0.02em] text-ink">
                  {formatMoney(analyticsValue)}
                </p>
                <p className="pb-1 text-[12.5px] text-ink-3">identified year to date</p>
              </div>
              <div className="space-y-0">
                <DataRow label="Live analytics products" value={formatNumber(analytics.liveProducts)} />
                <DataRow label="Scheduled reports & feeds" value={formatNumber(analytics.totalReports)} />
                <DataRow label="Insights generated" value={formatNumber(analytics.totalInsights)} />
                <DataRow label="Active business users" value={formatNumber(analytics.activeUsers)} emphasis />
              </div>
              <Link
                href="/analytics"
                className="mt-4 inline-block text-[12.5px] font-medium text-accent hover:text-accent-strong"
              >
                See the analytics portfolio →
              </Link>
            </Card>
          )}

          <Card>
            <CardHeader
              eyebrow="Executive analytics"
              title="Your business, not just your service"
              subtitle="Indicators the SSC produces from your finance data."
            />
            <ul className="divide-y divide-line-soft">
              {exec.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink-2">{m.label}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-4">{m.note}</p>
                  </div>
                  <p className="shrink-0 text-[14px] font-semibold text-ink tnum">
                    {m.format === "percent" && m.value > 0 ? "+" : ""}
                    {formatMetric(m.value, m.format)}
                  </p>
                </li>
              ))}
            </ul>
            <Link
              href="/analytics#executive"
              className="mt-3 inline-block text-[12.5px] font-medium text-accent hover:text-accent-strong"
            >
              All executive indicators →
            </Link>
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Service performance summary                                  */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Service performance at a glance"
          subtitle="Every service, side by side, on the four measures that matter."
          action={
            <Link href="/performance" className="text-[12.5px] font-medium text-accent hover:text-accent-strong">
              Full performance view →
            </Link>
          }
        />
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr>
                  {["Service", "Share of spend", "Billing (FY)", "SLA", "Trend", "Open items", "Satisfaction"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`border-b border-line px-4 py-3 text-[11px] font-semibold tracking-[0.05em] text-ink-3 uppercase ${
                          i > 1 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {services.map((s) => {
                  const csat = exp.csatByService.find((c) => c.serviceId === s.service.id);
                  return (
                    <tr key={s.service.id} className="transition-colors hover:bg-surface-sunken">
                      <td className="border-b border-line-soft px-4 py-3">
                        <Link href={`/services/${s.service.id}`} className="flex items-center gap-2.5">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: serviceColor(s.service.id) }}
                          />
                          <span>
                            <span className="block font-medium text-ink">{s.service.code}</span>
                            <span className="block text-[11.5px] text-ink-4">{s.service.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="border-b border-line-soft px-4 py-3 text-ink-2 tnum">
                        {(s.billing.mix * 100).toFixed(1)}%
                      </td>
                      <td className="border-b border-line-soft px-4 py-3 text-right font-medium tnum">
                        {formatMoney(s.billing.fyForecast)}
                      </td>
                      <td className="border-b border-line-soft px-4 py-3 text-right">
                        <StatusPill status={s.sla.status} size="sm">
                          {s.sla.overall.toFixed(1)}%
                        </StatusPill>
                      </td>
                      <td className="border-b border-line-soft px-4 py-3">
                        <div className="flex justify-end">
                          <Sparkline
                            values={s.sla.monthly.filter((m) => m.isActual).map((m) => m.value)}
                            width={72}
                            height={22}
                            color={serviceColor(s.service.id)}
                            area={false}
                          />
                        </div>
                      </td>
                      <td className="border-b border-line-soft px-4 py-3 text-right tnum">
                        {s.issueIds.length}
                      </td>
                      <td className="border-b border-line-soft px-4 py-3 text-right tnum">
                        {csat ? `${csat.score.toFixed(1)} / 5` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
