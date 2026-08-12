"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { usePortalData } from "@/components/portal/usePortalData";
import { PageHeader, MetricGrid } from "@/components/portal/blocks";
import {
  BillingDrivers,
  BillingTrend,
  ChargingModel,
  CompletionCard,
  KpiCard,
  SlaBreakdown,
  UtilisationCard,
} from "@/components/portal/service-blocks";
import { FeedbackList, IssueDrawer, IssueTable } from "@/components/portal/issue-blocks";
import {
  Badge,
  Card,
  CardHeader,
  SectionHeading,
  ServiceGlyph,
  SourceTag,
  StatusPill,
  StatTile,
  TrendPill,
  serviceColor,
} from "@/components/ui/primitives";
import { ColumnChart } from "@/components/charts";
import type { Issue, ServiceId } from "@/lib/domain/types";
import { cx, formatMoney, formatNumber, formatPercent } from "@/lib/format";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "billing", label: "Billing" },
  { id: "kpi", label: "KPI" },
  { id: "issues", label: "Issues" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ServiceDetailPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[13px] text-ink-3">Loading service…</div>}>
      <ServiceDetail />
    </Suspense>
  );
}

function ServiceDetail() {
  const params = useParams<{ serviceId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { snapshot } = usePortalData();
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);

  const serviceId = params.serviceId as ServiceId;
  const tab = ((search.get("tab") as TabId) ?? "overview") as TabId;

  if (!snapshot) return null;

  const service = snapshot.services.find((s) => s.service.id === serviceId);

  if (!service) {
    return (
      <div className="mx-auto max-w-[720px] py-20 text-center">
        <h1 className="text-[20px] font-semibold text-ink">This service is not in your scope</h1>
        <p className="mt-2 text-[13.5px] text-ink-3">
          {snapshot.entity.name} either does not consume this service, or your account is not
          authorised to view it.
        </p>
        <Link
          href="/services"
          className="mt-5 inline-block rounded-lg bg-rail px-4 py-2.5 text-[13px] font-medium text-white"
        >
          Back to my services
        </Link>
      </div>
    );
  }

  const def = service.service;
  const color = serviceColor(def.id);
  const issues = snapshot.issues.filter((i) => i.serviceId === def.id);
  const openIssues = issues.filter((i) => i.status !== "resolved");
  const feedback = snapshot.feedback.filter((f) => f.serviceId === def.id);

  const setTab = (next: TabId) => {
    router.replace(next === "overview" ? `/services/${def.id}` : `/services/${def.id}?tab=${next}`, {
      scroll: false,
    });
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        back={{ href: "/services", label: "Back to services" }}
        title={def.name}
        eyebrow={def.code}
        subtitle={def.description}
        actions={
          <>
            <StatusPill status={service.sla.status}>
              SLA {service.sla.overall.toFixed(1)}% · target {service.sla.target}%
            </StatusPill>
            {def.id === "automation" && (
              <Link
                href="/automation"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                Open control tower →
              </Link>
            )}
            {def.id === "analytics" && (
              <Link
                href="/analytics"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                Open analytics portfolio →
              </Link>
            )}
          </>
        }
      />

      {/* Service identity strip */}
      <Card className="mb-6 !p-0" padded={false}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
          <div className="flex items-center gap-3">
            <ServiceGlyph serviceId={def.id} code={def.code} size={40} />
            <div>
              <p className="text-[13.5px] font-semibold text-ink">{def.code}</p>
              <p className="text-[12px] text-ink-3">{def.tagline}</p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="eyebrow">This month</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tnum">
                {formatMoney(service.billing.currentTotal)}
              </p>
            </div>
            <div>
              <p className="eyebrow">Year to date</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tnum">
                {formatMoney(service.billing.ytd)}
              </p>
            </div>
            <div>
              <p className="eyebrow">Share of spend</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tnum">
                {(service.billing.mix * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="eyebrow">Open items</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tnum">{openIssues.length}</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="eyebrow">Fed by</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {def.sourceSystems.map((s) => (
                  <SourceTag key={s} system={s} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-line px-5">
          <nav className="-mb-px flex gap-1" aria-label="Service sections">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cx(
                    "relative border-b-2 px-4 py-3 text-[13.5px] font-medium transition-colors",
                    active
                      ? "border-accent text-ink"
                      : "border-transparent text-ink-3 hover:text-ink-2",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {t.label}
                  {t.id === "issues" && openIssues.length > 0 && (
                    <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-neutral-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-2 tnum">
                      {openIssues.length}
                    </span>
                  )}
                  {t.id === "kpi" && service.kpis.some((k) => k.status === "bad") && (
                    <span className="ml-2 inline-block size-1.5 rounded-full bg-bad align-middle" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </Card>

      {/* ============================================================ */}
      {tab === "overview" && (
        <div className="space-y-6">
          <section>
            <SectionHeading
              title="Service activity"
              subtitle={`What the SSC processed for you in ${service.billing.currentMonthLabel}, and how that has moved through the year.`}
            />
            <MetricGrid metrics={service.overview} color={color} />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                eyebrow="Volume"
                title={service.activityChart.title}
                subtitle="Solid bars are closed months; outlined bars are forecast at the current run rate."
              />
              <ColumnChart
                data={service.activityChart.series.map((s) => ({
                  label: s.short,
                  value: s.value,
                  isActual: s.isActual,
                }))}
                format={(n) => formatNumber(n)}
                height={230}
                color={color}
                valueLabel={service.activityChart.unit}
              />
            </Card>

            <div className="grid gap-4">
              <CompletionCard
                completion={service.completion}
                unit={service.activityChart.unit}
                color={color}
              />
              <UtilisationCard
                utilisation={service.utilisation}
                note={service.utilisationNote}
                color={color}
                activity={service.activityChart}
              />
            </div>
          </div>

          <section>
            <SectionHeading
              title="Performance summary"
              subtitle="The headline indicators for this service. Full detail is on the KPI tab."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {service.kpis.slice(0, 4).map((k) => (
                <StatTile
                  key={k.id}
                  label={k.name}
                  value={
                    k.unit === "percent"
                      ? formatPercent(k.actual)
                      : k.unit === "days"
                        ? `${k.actual.toFixed(1)} d`
                        : k.unit === "score"
                          ? `${k.actual.toFixed(1)} / 5`
                          : k.unit === "ratio"
                            ? `${k.actual.toFixed(2)}×`
                            : formatNumber(k.actual)
                  }
                  status={k.status}
                  caption={`Target ${k.direction === "higher-better" ? "≥" : "≤"} ${k.target}`}
                  delta={<TrendPill trend={k.trend} value={k.deltaPct} direction={k.direction} />}
                  accent={
                    k.status === "bad"
                      ? "var(--color-bad)"
                      : k.status === "warn"
                        ? "var(--color-warn)"
                        : undefined
                  }
                />
              ))}
            </div>
          </section>

          {def.id === "automation" && snapshot.automation && (
            <Card>
              <CardHeader
                eyebrow="Digital workforce"
                title="Bots and AI agents working on your account"
                subtitle="A summary view. The full control tower shows each bot, its jobs and its exceptions."
                action={
                  <Link
                    href="/automation"
                    className="text-[12.5px] font-medium text-accent hover:text-accent-strong"
                  >
                    Open control tower →
                  </Link>
                }
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Bots & agents", value: formatNumber(snapshot.automation.totalBots) },
                  { label: "Jobs this month", value: formatNumber(snapshot.automation.totalJobs) },
                  { label: "Success rate", value: formatPercent(snapshot.automation.successRate) },
                  {
                    label: "Effort released",
                    value: `${formatNumber(snapshot.automation.hoursSavedMonth)} hrs`,
                  },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg border border-line bg-surface-sunken p-3.5">
                    <p className="eyebrow">{t.label}</p>
                    <p className="mt-1.5 text-[18px] font-semibold text-ink tnum">{t.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {def.id === "analytics" && snapshot.analytics && (
            <Card>
              <CardHeader
                eyebrow="Analytics portfolio"
                title="Products live on your data"
                action={
                  <Link
                    href="/analytics"
                    className="text-[12.5px] font-medium text-accent hover:text-accent-strong"
                  >
                    Open the portfolio →
                  </Link>
                }
              />
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {snapshot.analytics.products.map((p) => (
                  <div key={p.id} className="rounded-lg border border-line p-3.5">
                    <p className="text-[13px] font-medium text-ink">{p.name}</p>
                    <p className="mt-1 text-[11.5px] text-ink-4">{p.category}</p>
                    <p className="mt-2.5 text-[11.5px] text-ink-3">
                      {p.insights} insights · {p.reports} reports
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {tab === "billing" && (
        <div className="space-y-6">
          <section>
            <SectionHeading
              title={`Why you are charged ${formatMoney(service.billing.currentTotal)} this month`}
              subtitle="Two charging models apply to this service. Every line below is a counted volume multiplied by a contracted rate."
            />
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label={`${service.billing.currentMonthLabel} billing`}
                value={formatMoney(service.billing.currentTotal)}
                emphasis
                delta={
                  <TrendPill
                    trend={
                      service.billing.momPct > 0.75 ? "up" : service.billing.momPct < -0.75 ? "down" : "flat"
                    }
                    value={service.billing.momPct}
                    direction="lower-better"
                    label="MoM"
                  />
                }
                accent={color}
              />
              <StatTile
                label="Year to date"
                value={formatMoney(service.billing.ytd)}
                emphasis
                caption={`Budget ${formatMoney(service.billing.ytdBudget)}`}
              />
              <StatTile
                label="Variance to budget"
                value={`${service.billing.ytdVariancePct >= 0 ? "+" : "−"}${Math.abs(
                  service.billing.ytdVariancePct,
                ).toFixed(1)}%`}
                emphasis
                status={Math.abs(service.billing.ytdVariancePct) < 5 ? "good" : "warn"}
                caption={`${formatMoney(
                  Math.abs(service.billing.ytd - service.billing.ytdBudget),
                )} ${service.billing.ytd >= service.billing.ytdBudget ? "over" : "under"}`}
              />
              <StatTile
                label="Full-year forecast"
                value={formatMoney(service.billing.fyForecast)}
                emphasis
                caption={`${(service.billing.mix * 100).toFixed(1)}% of total SSC spend`}
              />
            </div>
          </section>

          <ChargingModel billing={service.billing} color={color} />
          <BillingDrivers billing={service.billing} color={color} />
          <BillingTrend billing={service.billing} color={color} />
        </div>
      )}

      {/* ============================================================ */}
      {tab === "kpi" && (
        <div className="space-y-6">
          <section>
            <SectionHeading
              title="Key performance indicators"
              subtitle={`${service.kpis.length} indicators are contracted for this service. Each one shows the actual, the target, the direction of travel, and the work sitting behind the number.`}
              action={
                <div className="flex gap-2">
                  {(["good", "warn", "bad"] as const).map((st) => {
                    const n = service.kpis.filter((k) => k.status === st).length;
                    if (n === 0) return null;
                    return (
                      <Badge key={st} tone={st === "good" ? "good" : st === "warn" ? "warn" : "bad"}>
                        {n} {st === "good" ? "on target" : st === "warn" ? "at risk" : "off target"}
                      </Badge>
                    );
                  })}
                </div>
              }
            />
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {service.kpis.map((k) => (
                <KpiCard key={k.id} kpi={k} issues={issues} feedback={feedback} color={color} />
              ))}
            </div>
          </section>

          <SlaBreakdown sla={service.sla} color={color} />
        </div>
      )}

      {/* ============================================================ */}
      {tab === "issues" && (
        <div className="space-y-6">
          <section>
            <SectionHeading
              title="Open issues"
              subtitle="Everything currently open against this service, with ownership and ageing against the agreed resolution target. Select any row for the full history."
            />
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Open items", value: openIssues.length, status: undefined },
                {
                  label: "Critical",
                  value: openIssues.filter((i) => i.priority === "critical").length,
                  status: openIssues.some((i) => i.priority === "critical") ? ("bad" as const) : ("good" as const),
                },
                {
                  label: "Past resolution target",
                  value: openIssues.filter((i) => i.agingDays > i.slaTargetDays).length,
                  status: openIssues.some((i) => i.agingDays > i.slaTargetDays)
                    ? ("warn" as const)
                    : ("good" as const),
                },
                {
                  label: "Resolved recently",
                  value: issues.filter((i) => i.status === "resolved").length,
                  status: undefined,
                },
              ].map((t) => (
                <StatTile key={t.label} label={t.label} value={formatNumber(t.value)} status={t.status} />
              ))}
            </div>
            <Card padded={false}>
              <div className="p-5">
                <IssueTable
                  issues={openIssues}
                  onSelect={setOpenIssue}
                  showService={false}
                  emptyNote="No open issues against this service. Everything raised has been resolved within target."
                />
              </div>
            </Card>
          </section>

          {issues.some((i) => i.status === "resolved") && (
            <Card padded={false}>
              <div className="p-5">
                <CardHeader
                  eyebrow="Closed"
                  title="Recently resolved"
                  subtitle="Closed in the last 30 days, with the resolution recorded."
                />
                <IssueTable
                  issues={issues.filter((i) => i.status === "resolved")}
                  onSelect={setOpenIssue}
                  showService={false}
                />
              </div>
            </Card>
          )}

          <FeedbackList
            feedback={feedback}
            title="What your people are saying about this service"
            subtitle="Feedback submitted by the business users who consume this service, linked to the indicator it relates to."
          />
        </div>
      )}

      <IssueDrawer
        issue={openIssue}
        kpi={
          openIssue?.linkedKpiId
            ? snapshot.services.flatMap((s) => s.kpis).find((k) => k.id === openIssue.linkedKpiId)
            : undefined
        }
        feedback={snapshot.feedback}
        onClose={() => setOpenIssue(null)}
      />
    </div>
  );
}
