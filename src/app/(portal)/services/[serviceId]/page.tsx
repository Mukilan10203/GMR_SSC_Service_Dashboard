"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { usePortalData } from "@/components/portal/usePortalData";
import { MetricGrid, MonthlyTrendCard, PageHeader } from "@/components/portal/blocks";
import {
  BillingDrivers,
  BillingTrend,
  ChargingModel,
  CompletionCard,
  KpiDetailDrawer,
  KpiGroupSection,
  KpiOverviewPanel,
  SubServiceExplorer,
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
  StatusPill,
  StatTile,
  TrendPill,
  serviceColor,
} from "@/components/ui/primitives";
import { BulletGauge } from "@/components/charts";
import type { Issue, Kpi, ServiceId, ServiceSnapshot } from "@/lib/domain/types";
import { LOCKED_SERVICE_IDS } from "@/lib/mock/organisation";
import { getPriorPeriodId, listPeriods } from "@/lib/mock/calendar";
import {
  billedTotal,
  billedTotalLabel,
  cx,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/lib/format";

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
  const [openKpi, setOpenKpi] = useState<Kpi | null>(null);

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
          className="mt-5 inline-block btn-cta px-4 py-2.5 text-[13px] hover:-translate-y-px"
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

  /** KPIs bucketed by sub-service in catalogue order; the aggregate SLA KPI leads as "Overall". */
  const kpiGroups: [string, typeof service.kpis][] = (() => {
    const overall = service.kpis.filter((k) => !k.subServiceId);
    const bySub: [string, typeof service.kpis][] = def.subServices
      .map((sub): [string, typeof service.kpis] => [
        sub.name,
        service.kpis.filter((k) => k.subServiceId === sub.id),
      ])
      .filter(([, kpis]) => kpis.length > 0);
    return overall.length > 0 ? [["Overall", overall], ...bySub] : bySub;
  })();

  /** Each sub-service joined to the SLA component that measures it. */
  const subServices = def.subServices.map((sub) => ({
    ...sub,
    sla: service.sla.components.find((c) => c.id === sub.slaComponentId),
    kpis: service.kpis.filter((k) => k.subServiceId === sub.id),
    bots: serviceBots.filter((b) => b.subServiceId === sub.id).length,
  }));

  const priorPeriodLabel =
    listPeriods().find((p) => p.id === getPriorPeriodId(snapshot.period.id))?.label ?? "Prior year";

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
              <p className="eyebrow-muted">This month</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tnum">
                {formatMoney(service.billing.currentTotal)}
              </p>
            </div>
            <div>
              <p className="eyebrow-muted">Year to date</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tnum">
                {formatMoney(service.billing.ytd)}
              </p>
            </div>
            <div>
              <p className="eyebrow-muted">Share of spend</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tnum">
                {(service.billing.mix * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="eyebrow-muted">Open items</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tnum">{openIssues.length}</p>
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
            <div
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}
            >
              {subServices.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setTab("kpi")}
                  className="card group !p-4 text-left transition-shadow hover:shadow-raised"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[13.5px] leading-snug font-semibold text-ink">{sub.name}</p>
                    {sub.sla && (
                      <StatusPill status={sub.sla.status} size="sm">
                        {sub.sla.actual.toFixed(1)}%
                      </StatusPill>
                    )}
                  </div>

                  {sub.sla && (
                    <div className="mt-3.5">
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
                      <p className="mt-1.5 text-right text-[10.5px] text-ink-4 tnum">
                        Target {sub.sla.target}%
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line-soft pt-2.5">
                    {sub.kpis.map((k) => (
                      <span
                        key={k.id}
                        title={k.name}
                        className="size-1.5 rounded-full"
                        style={{
                          background:
                            k.status === "bad"
                              ? "var(--color-bad)"
                              : k.status === "warn"
                                ? "var(--color-warn)"
                                : "var(--color-good)",
                        }}
                      />
                    ))}
                    <span className="ml-1.5 text-[11px] text-ink-4 tnum">{sub.kpis.length} KPIs</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {def.id === "hrops" && <HrVisualRow service={service} color={color} />}

          <SubServiceExplorer
            subServices={service.subServices}
            kpis={service.kpis}
            color={color}
            monthLabel={service.billing.currentMonthLabel}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <MonthlyTrendCard
              eyebrow="Tower volume"
              title={service.activityChart.title}
              data={service.activityChart.series.map((x) => ({
                label: x.short,
                value: x.value,
                isActual: x.isActual,
                prior: x.prior,
              }))}
              format={(n) => formatNumber(n)}
              color={color}
              valueLabel={service.activityChart.unit}
            />

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
                label={billedTotalLabel(snapshot.period.isCurrent)}
                value={formatMoney(
                  billedTotal(
                    snapshot.period.isCurrent,
                    service.billing.ytd,
                    service.billing.fyForecast,
                  ),
                )}
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
            <div className="mb-4">
              <KpiOverviewPanel kpis={service.kpis} subServices={service.subServices} />
            </div>
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
                  onOpenKpi={setOpenKpi}
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

      <KpiDetailDrawer
        kpi={openKpi}
        issues={issues}
        feedback={feedback}
        color={color}
        periodLabel={snapshot.period.label}
        priorPeriodLabel={priorPeriodLabel}
        onClose={() => setOpenKpi(null)}
      />

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

/* ------------------------------------------------------------------ */
/* HR Ops visual row — TA pipeline, hiring channels, payroll & L&D     */
/* ------------------------------------------------------------------ */

/** Adjacent-pair CVD-validated ordering of the service palette. */
const MIX_COLORS = [
  "var(--color-svc-fna)",
  "var(--color-svc-procurement)",
  "var(--color-svc-idt)",
  "var(--color-svc-automation)",
  "var(--color-svc-analytics)",
];

function HrVisualRow({ service, color }: { service: ServiceSnapshot; color: string }) {
  const metric = (id: string) => service.overview.find((m) => m.id === id)?.value ?? 0;

  const funnel = [
    { label: "Open positions", value: metric("open-positions") },
    { label: "In progress", value: metric("in-progress") },
    { label: "Offers pending", value: metric("offers") },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  const channels = service.kpis
    .filter((k) => k.id.startsWith("hrops-raw-source-channel-"))
    .map((k) => ({ label: k.name.replace(/^Source Channel - /, ""), value: k.actual }));
  const channelTotal = channels.reduce((a, c) => a + c.value, 0) || 1;

  const gauges = [
    { label: "Payroll accuracy", value: metric("payroll-acc"), target: 99.5 },
    { label: "Learning completion", value: metric("lnd-completion"), target: 85 },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader eyebrow="Talent acquisition" title="Hiring pipeline" />
        <div className="space-y-3.5">
          {funnel.map((f, i) => (
            <div key={f.label}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[12.5px] text-ink-2">{f.label}</span>
                <span className="text-[13px] font-semibold text-ink tnum">{formatNumber(f.value)}</span>
              </div>
              <div className="h-[18px] w-full">
                <div
                  className="mx-auto h-full rounded"
                  style={{
                    width: `${Math.max(6, (f.value / funnelMax) * 100)}%`,
                    background: `color-mix(in srgb, ${color} ${100 - i * 26}%, white)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-3.5">
          <div>
            <p className="eyebrow-muted">Closed YTD</p>
            <p className="mt-1 text-[17px] font-semibold text-ink tnum">
              {formatNumber(metric("closed"))}
            </p>
          </div>
          <div>
            <p className="eyebrow-muted">Time to hire</p>
            <p className="mt-1 text-[17px] font-semibold text-ink tnum">
              {metric("tth").toFixed(1)} d
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader eyebrow="Talent acquisition" title="Hiring channel mix" />
        <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
          {channels.map((c, i) => (
            <div
              key={c.label}
              style={{
                width: `${(c.value / channelTotal) * 100}%`,
                background: MIX_COLORS[i % MIX_COLORS.length],
              }}
            />
          ))}
        </div>
        <ul className="mt-4 space-y-2.5">
          {channels.map((c, i) => (
            <li key={c.label} className="flex items-center gap-2.5">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: MIX_COLORS[i % MIX_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{c.label}</span>
              <span className="text-[12.5px] font-medium text-ink tnum">
                {((c.value / channelTotal) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader eyebrow="Payroll · L&D" title="Delivery quality" />
        <div className="space-y-6">
          {gauges.map((g) => (
            <div key={g.label}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[12.5px] text-ink-2">{g.label}</span>
                <span className="text-[17px] font-semibold text-ink tnum">{g.value.toFixed(1)}%</span>
              </div>
              <BulletGauge
                actual={g.value}
                target={g.target}
                direction="higher-better"
                color={g.value >= g.target ? "var(--color-good)" : "var(--color-warn)"}
                format={(n) => `${n.toFixed(1)}%`}
                scaleMax={100}
                scaleMin={Math.max(0, Math.min(g.value, g.target) - 20)}
              />
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
