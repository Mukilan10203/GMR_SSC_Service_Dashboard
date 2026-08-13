"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePortalData } from "@/components/portal/usePortalData";
import { LockedPage, PageHeader } from "@/components/portal/blocks";
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
  serviceColor,
} from "@/components/ui/primitives";
import { ColumnChart, HBarList } from "@/components/charts";
import { SERVICE_MAP } from "@/lib/mock/organisation";
import type { BotStatus } from "@/lib/domain/types";
import { cx, formatMoney, formatNumber, formatPercent } from "@/lib/format";

const STATUS_META: Record<BotStatus, { label: string; tone: "good" | "warn" | "bad" | "neutral"; dot: string }> = {
  running: { label: "Running", tone: "good", dot: "var(--color-good)" },
  idle: { label: "Idle", tone: "neutral", dot: "var(--color-ink-4)" },
  warning: { label: "Warning", tone: "warn", dot: "var(--color-warn)" },
  failed: { label: "Failed", tone: "bad", dot: "var(--color-bad)" },
};

export default function AutomationPage() {
  return <LockedPage title="Automation" />;
}

function AutomationPageUnlocked() {
  const { snapshot } = usePortalData();
  const [filter, setFilter] = useState<"all" | BotStatus>("all");

  const automation = snapshot?.automation ?? null;

  const byService = useMemo(() => {
    if (!automation) return [];
    const map = new Map<string, { hours: number; txns: number; bots: number }>();
    for (const b of automation.bots) {
      const cur = map.get(b.serviceId) ?? { hours: 0, txns: 0, bots: 0 };
      cur.hours += b.hoursSaved;
      cur.txns += b.transactions;
      cur.bots += 1;
      map.set(b.serviceId, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].hours - a[1].hours);
  }, [automation]);

  if (!snapshot) return null;

  if (!automation) {
    return (
      <div className="mx-auto max-w-[820px]">
        <PageHeader
          eyebrow="Automation"
          title="Bot & AI control tower"
          subtitle="Automation is not currently contracted for this entity."
        />
        <Card>
          <CardHeader
            title="A digital workforce is available for this account"
            subtitle="The SSC operates a managed fleet of RPA bots and AI agents that execute high-volume, rules-based work and route exceptions back to human teams."
          />
          <p className="text-[13px] leading-relaxed text-ink-2">
            At comparable entities the fleet removes roughly 6 minutes of manual effort per transaction
            and returns close to two rupees of released effort for every rupee of automation fee. Your
            relationship manager, {snapshot.entity.relationshipManager}, can scope an assessment against
            your current transaction profile.
          </p>
          <Link
            href="/services"
            className="mt-5 inline-block rounded-lg bg-rail px-4 py-2.5 text-[13px] font-medium text-white"
          >
            Back to my services
          </Link>
        </Card>
      </div>
    );
  }

  const bots = filter === "all" ? automation.bots : automation.bots.filter((b) => b.status === filter);
  const trouble = automation.bots.filter((b) => b.status === "warning" || b.status === "failed");
  const pipelineHours = automation.pipeline.reduce((a, p) => a + p.estHoursMonth, 0);

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="Automation"
        title="Bot & AI control tower"
        subtitle={
          <>
            The digital workforce running transactions for {snapshot.entity.name}. Automation is
            delivered inside your service towers rather than sold separately, so every bot belongs to
            a tower — and every job, exception and hour released reconciles to the digital workforce
            lines on that tower&rsquo;s invoice.
          </>
        }
        actions={
          <>
            <StatusPill status={automation.successRate >= 97 ? "good" : "warn"}>
              Fleet success {formatPercent(automation.successRate)}
            </StatusPill>
            <Link
              href="/billing"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Automation billing →
            </Link>
          </>
        }
      />

      {/* ============================================================ */}
      {/* Fleet status                                                 */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading title="Fleet status" subtitle={`As at ${snapshot.period.asOf}.`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Bots & AI agents"
            value={formatNumber(automation.totalBots)}
            emphasis
            caption={`${automation.activeBots} running`}
            accent={serviceColor("automation")}
          />
          <StatTile
            label="Jobs executed"
            value={formatNumber(automation.totalJobs)}
            emphasis
            caption="This month"
          />
          <StatTile
            label="Successful jobs"
            value={formatNumber(automation.successfulJobs)}
            emphasis
            status="good"
            caption={formatPercent(automation.successRate)}
          />
          <StatTile
            label="Failed jobs"
            value={formatNumber(automation.failedJobs)}
            emphasis
            status={automation.failedJobs > 0 ? "warn" : "good"}
            caption="Automatically re-queued"
          />
          <StatTile
            label="Transactions automated"
            value={formatNumber(automation.transactionsAutomated)}
            emphasis
            caption="This month"
          />
          <StatTile
            label="Exceptions queued"
            value={formatNumber(automation.exceptions)}
            emphasis
            status={automation.exceptions > 60 ? "warn" : "good"}
            caption="Routed to human review"
          />
        </div>
      </section>

      {/* ============================================================ */}
      {/* Value                                                        */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="What the digital workforce is worth"
          subtitle="Effort released, valued at the blended cost of the manual effort it replaces, against the digital workforce fee charged inside your service towers."
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              eyebrow="Effort released"
              title="Hours returned to the business each month"
              subtitle="Hatched months are forecast as further automations go live."
            />
            <ColumnChart
              data={automation.monthlyHoursSaved.map((m) => ({
                label: m.short,
                value: m.value,
                isActual: m.isActual,
              }))}
              format={(n) => formatNumber(n)}
              height={220}
              color={serviceColor("automation")}
              valueLabel="Hours released"
            />
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line-soft pt-4 sm:grid-cols-4">
              {[
                { label: "This month", value: `${formatNumber(automation.hoursSavedMonth)} hrs` },
                { label: "Year to date", value: `${formatNumber(automation.hoursSavedYtd)} hrs` },
                {
                  label: "Valued at",
                  value: formatMoney(automation.costSavingMonth),
                  hint: `₹${automation.blendedHourlyCost}/hr blended`,
                },
                {
                  label: "Coverage",
                  value: formatPercent(automation.automationCoverage * 100),
                  hint: "of automatable volume",
                },
              ].map((t) => (
                <div key={t.label}>
                  <p className="eyebrow">{t.label}</p>
                  <p className="mt-1.5 text-[17px] font-semibold text-ink tnum">{t.value}</p>
                  {t.hint && <p className="mt-0.5 text-[11.5px] text-ink-4">{t.hint}</p>}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Return on investment"
              title="Value against fee"
              subtitle="The arithmetic behind the automation business case, for this month."
            />
            <div className="mb-5 flex items-end gap-3">
              <p className="metric text-[38px] leading-10 font-semibold tracking-[-0.025em] text-ink">
                {automation.roi.toFixed(2)}×
              </p>
              <p className="pb-2 text-[12.5px] text-ink-3">released per rupee of fee</p>
            </div>
            <div className="space-y-0">
              <DataRow
                label="Effort released, valued"
                value={formatMoney(automation.costSavingMonth)}
                hint={`${formatNumber(automation.hoursSavedMonth)} hours × ₹${automation.blendedHourlyCost}`}
              />
              <DataRow
                label="Automation fee charged"
                value={`− ${formatMoney(automation.automationCostMonth)}`}
                hint="Runtime licences and bot transactions, billed within your towers"
              />
              <DataRow
                label="Net monthly value"
                value={formatMoney(automation.netValueMonth)}
                emphasis
              />
            </div>
            <div className="mt-5 rounded-lg border border-line bg-surface-sunken p-4">
              <p className="eyebrow mb-2">Year to date</p>
              <DataRow label="Effort released" value={`${formatNumber(automation.hoursSavedYtd)} hrs`} />
              <DataRow label="Value released" value={formatMoney(automation.costSavingYtd)} />
            </div>
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Control tower                                                */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Bot & AI control tower"
          subtitle="Every automation running on your account, its current state and its contribution."
          action={
            <div className="flex flex-wrap gap-1.5">
              {(["all", "running", "warning", "idle"] as const).map((f) => {
                const count =
                  f === "all" ? automation.bots.length : automation.bots.filter((b) => b.status === f).length;
                if (count === 0 && f !== "all") return null;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cx(
                      "rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      filter === f
                        ? "border-accent-line bg-accent-soft text-accent-strong"
                        : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2",
                    )}
                  >
                    {f === "all" ? "All" : STATUS_META[f].label} ({count})
                  </button>
                );
              })}
            </div>
          }
        />

        {trouble.length > 0 && (
          <div className="mb-4 rounded-lg border border-warn-line bg-warn-soft p-4">
            <p className="text-[13px] font-semibold text-warn">
              {trouble.length} automation{trouble.length > 1 ? "s require" : " requires"} attention
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
              {trouble.map((b) => `${b.name} (${b.successRate.toFixed(1)}% success)`).join(", ")}.
              Affected work has reverted to manual processing while the Automation CoE deploys a fix.
            </p>
          </div>
        )}

        <Card padded={false}>
          <div className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Bot / agent</Th>
                  <Th>Process</Th>
                  <Th>Service</Th>
                  <Th align="center">Status</Th>
                  <Th align="right">Jobs</Th>
                  <Th align="right">Success</Th>
                  <Th align="right">Transactions</Th>
                  <Th align="right">Hours saved</Th>
                  <Th align="right">Last run</Th>
                </tr>
              </thead>
              <tbody>
                {bots.map((b) => {
                  const meta = STATUS_META[b.status];
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-surface-sunken">
                      <Td>
                        <span className="block font-medium text-ink">{b.name}</span>
                        <span className="mt-0.5 inline-flex items-center gap-1.5">
                          <Badge tone={b.kind === "AI Agent" ? "accent" : "neutral"}>{b.kind}</Badge>
                        </span>
                      </Td>
                      <Td muted>{b.process}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: serviceColor(b.serviceId) }}
                          />
                          {SERVICE_MAP[b.serviceId].code}
                        </span>
                      </Td>
                      <Td align="center">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                          <span className="size-2 rounded-full" style={{ background: meta.dot }} />
                          {meta.label}
                        </span>
                      </Td>
                      <Td align="right">{formatNumber(b.jobs)}</Td>
                      <Td align="right">
                        <span
                          className={cx(
                            "font-medium",
                            b.successRate < 97 ? "text-warn" : "text-ink",
                          )}
                        >
                          {b.successRate.toFixed(1)}%
                        </span>
                        {b.failedJobs > 0 && (
                          <span className="block text-[11px] text-ink-4">{b.failedJobs} failed</span>
                        )}
                      </Td>
                      <Td align="right">{formatNumber(b.transactions)}</Td>
                      <Td align="right">{formatNumber(b.hoursSaved)}</Td>
                      <Td align="right" muted>
                        {b.lastRun}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Where automation is working + pipeline                       */}
      {/* ============================================================ */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Distribution"
            title="Where automation is working hardest"
            subtitle="Effort released this month, by service tower."
          />
          <HBarList
            items={byService.map(([sid, v]) => ({
              key: sid,
              label: SERVICE_MAP[sid as keyof typeof SERVICE_MAP].name,
              sublabel: `${v.bots} bot${v.bots > 1 ? "s" : ""} · ${formatNumber(v.txns)} transactions`,
              value: v.hours,
              color: serviceColor(sid),
            }))}
            format={(n) => `${formatNumber(n)} hrs`}
            showShare
          />
          <div className="mt-5 border-t border-line-soft pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="eyebrow">Automation coverage</p>
              <p className="text-[13px] font-semibold text-ink tnum">
                {formatPercent(automation.automationCoverage * 100)}
              </p>
            </div>
            <ProgressBar
              value={automation.automationCoverage * 100}
              color={serviceColor("automation")}
              height={7}
              label="Automation coverage"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-4">
              Share of the volume the SSC considers automatable that the digital workforce currently
              executes. The remainder is processed by people, either because it is not yet automated or
              because it requires judgement.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Pipeline"
            title="Automations in build"
            subtitle={`Four automations are in the pipeline, estimated to release a further ${formatNumber(
              pipelineHours,
            )} hours a month once live.`}
          />
          <Table>
            <thead>
              <tr>
                <Th>Automation</Th>
                <Th>Stage</Th>
                <Th align="right">Est. hours / month</Th>
                <Th align="right">Go live</Th>
              </tr>
            </thead>
            <tbody>
              {automation.pipeline.map((p) => (
                <tr key={p.name}>
                  <Td>
                    <span className="font-medium">{p.name}</span>
                  </Td>
                  <Td>
                    <Badge tone={p.stage === "In test" ? "accent" : "neutral"}>{p.stage}</Badge>
                  </Td>
                  <Td align="right">{formatNumber(p.estHoursMonth)}</Td>
                  <Td align="right" muted>
                    {p.goLive}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-5 rounded-lg border border-accent-line bg-accent-soft p-4">
            <p className="text-[13px] font-semibold text-accent-strong">Estimated additional value</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
              {formatNumber(pipelineHours)} hours a month is worth approximately{" "}
              <span className="font-semibold text-ink">
                {formatMoney(pipelineHours * automation.blendedHourlyCost)}
              </span>{" "}
              at the blended rate — before any change to the automation fee.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
