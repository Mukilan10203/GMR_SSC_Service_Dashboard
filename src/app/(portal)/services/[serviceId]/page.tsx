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
  KpiGroupSection,
  SlaBreakdown,
  UtilisationCard,
} from "@/components/portal/service-blocks";
import { FeedbackList, IssueDrawer, IssueTable } from "@/components/portal/issue-blocks";
import {
  Badge,
  Card,
  CardHeader,
  ProgressBar,
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
import { LOCKED_SERVICE_IDS } from "@/lib/mock/organisation";
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
    const locked = LOCKED_SERVICE_IDS.includes(serviceId);
    return (
      <div className="mx-auto max-w-[720px] py-20 text-center">
        <h1 className="text-[20px] font-semibold text-ink">
          {locked ? "This service is locked" : "This service is not in your scope"}
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-3">
          {locked
            ? "It is not yet available in this preview."
            : `${snapshot.entity.name} either does not consume this service, or your account is not authorised to view it.`}
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
  const serviceBots = (snapshot.automation?.bots ?? []).filter((b) => b.serviceId === def.id);

  /** KPIs bucketed by subfunction, "Overall" (the aggregate SLA KPI) first, then in first-seen order. */
  const kpiGroups: [string, typeof service.kpis][] = (() => {
    const overall = service.kpis.filter((k) => !k.group);
    const rest = new Map<string, typeof service.kpis>();
    for (const k of service.kpis) {
      if (!k.group) continue;
      if (!rest.has(k.group)) rest.set(k.group, []);
      rest.get(k.group)!.push(k);
    }
    const groups: [string, typeof service.kpis][] = [...rest.entries()];
    return overall.length > 0 ? [["Overall", overall], ...groups] : groups;
  })();

  /** Each sub-service joined to the SLA component that measures it. */
  const subServices = def.subServices.map((sub) => ({
    ...sub,
    sla: service.sla.components.find((c) => c.id === sub.slaComponentId),
    kpis: service.kpis.filter((k) => k.subServiceId === sub.id),
    bots: serviceBots.filter((b) => b.subServiceId === sub.id).length,
  }));

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
        actions={
          <>
            <StatusPill status={service.sla.status}>
              SLA {service.sla.overall.toFixed(1)}% · target {service.sla.target}%
            </StatusPill>
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
              <p className="text-[12px] text-ink-3">{def.name}</p>
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
            <SectionHeading title={`What sits inside ${def.code}`} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {subServices.map((sub) => (
                <Card key={sub.id} className="!p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13.5px] leading-snug font-semibold text-ink">{sub.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-ink-4">{sub.code}</p>
                    </div>
                    {sub.sla && (
                      <StatusPill status={sub.sla.status} size="sm">
                        {sub.sla.actual.toFixed(1)}%
                      </StatusPill>
                    )}
                  </div>

                  {sub.sla && (
                    <div className="mt-3.5">
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-[11.5px] text-ink-4">
                          Weight {(sub.sla.weight * 100).toFixed(0)}% of tower SLA
                        </span>
                        <span className="text-[11.5px] font-medium text-ink-2 tnum">
                          Target {sub.sla.target}%
                        </span>
                      </div>
                      <ProgressBar
                        value={sub.sla.actual}
                        max={100}
                        color={
                          sub.sla.status === "bad"
                            ? "var(--color-bad)"
                            : sub.sla.status === "warn"
                              ? "var(--color-warn)"
                              : color
                        }
                        height={5}
                        label={`${sub.name} service level ${sub.sla.actual.toFixed(1)}%`}
                      />
                    </div>
                  )}

                  <p className="mt-3.5 border-t border-line-soft pt-2.5 text-[11.5px] text-ink-4">
                    {sub.kpis.length} indicator{sub.kpis.length === 1 ? "" : "s"}
                    {sub.bots > 0 && ` · ${sub.bots} automation${sub.bots === 1 ? "" : "s"}`}
                  </p>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <SectionHeading title="Service activity" />
            <MetricGrid metrics={service.overview} color={color} />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader eyebrow="Volume" title={service.activityChart.title} />
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
            <SectionHeading title="Performance summary" />
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

          {serviceBots.length > 0 && snapshot.automation && (
            <Card>
              <CardHeader
                eyebrow="Digital workforce"
                title={`${serviceBots.length} automation${serviceBots.length > 1 ? "s are" : " is"} running inside ${def.code}`}
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
                  { label: "Bots & agents", value: formatNumber(serviceBots.length) },
                  {
                    label: "Transactions automated",
                    value: formatNumber(serviceBots.reduce((a, b) => a + b.transactions, 0)),
                  },
                  {
                    label: "Jobs this month",
                    value: formatNumber(serviceBots.reduce((a, b) => a + b.jobs, 0)),
                  },
                  {
                    label: "Effort released",
                    value: `${formatNumber(serviceBots.reduce((a, b) => a + b.hoursSaved, 0))} hrs`,
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
        </div>
      )}

      {/* ============================================================ */}
      {tab === "billing" && (
        <div className="space-y-6">
          <section>
            <SectionHeading
              title={`Why you are charged ${formatMoney(service.billing.currentTotal)} this month`}
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
            <div className="space-y-3">
              {kpiGroups.map(([group, kpis], i) => (
                <KpiGroupSection
                  key={group}
                  title={group}
                  kpis={kpis}
                  issues={issues}
                  feedback={feedback}
                  color={color}
                  defaultOpen={i === 0}
                />
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
            <SectionHeading title="Open issues" />
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
                <CardHeader eyebrow="Closed" title="Recently resolved" />
                <IssueTable
                  issues={issues.filter((i) => i.status === "resolved")}
                  onSelect={setOpenIssue}
                  showService={false}
                />
              </div>
            </Card>
          )}

          <FeedbackList feedback={feedback} title="What your people are saying about this service" />
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
