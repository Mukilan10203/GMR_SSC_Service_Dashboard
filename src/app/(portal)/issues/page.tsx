"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePortalData } from "@/components/portal/usePortalData";
import { PageHeader } from "@/components/portal/blocks";
import { FeedbackCard, IssueDrawer, IssueTable } from "@/components/portal/issue-blocks";
import {
  Badge,
  Card,
  CardHeader,
  SectionHeading,
  StatTile,
  serviceColor,
} from "@/components/ui/primitives";
import { HBarList } from "@/components/charts";
import type { Issue, Priority, ServiceId } from "@/lib/domain/types";
import { cx, formatNumber } from "@/lib/format";

export default function IssuesPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[13px] text-ink-3">Loading…</div>}>
      <IssuesView />
    </Suspense>
  );
}

function IssuesView() {
  const { snapshot } = usePortalData();
  const search = useSearchParams();
  const [selected, setSelected] = useState<Issue | null>(null);
  const [serviceFilter, setServiceFilter] = useState<ServiceId | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">(
    (search.get("priority") as Priority) ?? "all",
  );
  const [query, setQuery] = useState("");

  // Deep link from an alert or search result opens the drawer directly.
  const deepLink = search.get("issue");
  useEffect(() => {
    if (!deepLink || !snapshot) return;
    const found = snapshot.issues.find((i) => i.id === deepLink);
    if (found) setSelected(found);
  }, [deepLink, snapshot]);

  const allIssues = useMemo(() => snapshot?.issues ?? [], [snapshot]);

  const open = allIssues.filter((i) => i.status !== "resolved");
  const resolved = allIssues.filter((i) => i.status === "resolved");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return open.filter((i) => {
      if (serviceFilter !== "all" && i.serviceId !== serviceFilter) return false;
      if (priorityFilter !== "all" && i.priority !== priorityFilter) return false;
      if (needle && !`${i.title} ${i.ref} ${i.owner} ${i.category}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [open, serviceFilter, priorityFilter, query]);

  if (!snapshot) return null;

  const byService = snapshot.services.map((s) => ({
    key: s.service.id,
    label: s.service.name,
    value: open.filter((i) => i.serviceId === s.service.id).length,
    color: serviceColor(s.service.id),
  }));

  const overdue = open.filter((i) => i.agingDays > i.slaTargetDays);
  const feedback = snapshot.feedback;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="Issues & feedback"
        title="What is open, and what your people are saying"
        subtitle="Every item raised against your services, with ownership, ageing against the agreed resolution target, and the customer feedback connected to it."
      />

      {/* ============================================================ */}
      <section className="mb-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Open items" value={formatNumber(open.length)} emphasis />
          <StatTile
            label="Critical"
            value={formatNumber(open.filter((i) => i.priority === "critical").length)}
            emphasis
            status={open.some((i) => i.priority === "critical") ? "bad" : "good"}
          />
          <StatTile
            label="High priority"
            value={formatNumber(open.filter((i) => i.priority === "high").length)}
            emphasis
            status={open.some((i) => i.priority === "high") ? "warn" : "good"}
          />
          <StatTile
            label="Past resolution target"
            value={formatNumber(overdue.length)}
            emphasis
            status={overdue.length > 0 ? "warn" : "good"}
          />
          <StatTile
            label="Resolved recently"
            value={formatNumber(resolved.length)}
            emphasis
            status="good"
            caption={`${snapshot.counts.avgResolutionDays.toFixed(1)} day average`}
          />
          <StatTile
            label="Awaiting your input"
            value={formatNumber(open.filter((i) => i.status === "awaiting-customer").length)}
            emphasis
            caption="Blocked on the customer side"
          />
        </div>
      </section>

      {/* ============================================================ */}
      {/* Issue register                                               */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Issue register"
          subtitle="Select any row for the full history, business impact and the KPI it affects."
        />

        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search issues, references, owners…"
              className="h-9 min-w-[220px] flex-1 rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
            />

            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={serviceFilter === "all"} onClick={() => setServiceFilter("all")}>
                All services
              </FilterChip>
              {snapshot.services.map((s) => {
                const n = open.filter((i) => i.serviceId === s.service.id).length;
                if (n === 0) return null;
                return (
                  <FilterChip
                    key={s.service.id}
                    active={serviceFilter === s.service.id}
                    onClick={() => setServiceFilter(s.service.id)}
                    dot={serviceColor(s.service.id)}
                  >
                    {s.service.code} ({n})
                  </FilterChip>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={priorityFilter === "all"} onClick={() => setPriorityFilter("all")}>
                Any priority
              </FilterChip>
              {(["critical", "high", "medium", "low"] as Priority[]).map((p) => {
                const n = open.filter((i) => i.priority === p).length;
                if (n === 0) return null;
                return (
                  <FilterChip
                    key={p}
                    active={priorityFilter === p}
                    onClick={() => setPriorityFilter(p)}
                  >
                    {p} ({n})
                  </FilterChip>
                );
              })}
            </div>
          </div>

          <div className="p-5">
            <IssueTable
              issues={filtered}
              onSelect={setSelected}
              emptyNote={
                open.length === 0
                  ? "Nothing is open against your services. Everything raised has been resolved."
                  : "No issues match these filters."
              }
            />
          </div>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Distribution + resolved                                      */}
      {/* ============================================================ */}
      <section className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader
            eyebrow="Distribution"
            title="Open items by service"
            subtitle="Where attention is concentrated."
          />
          {byService.some((b) => b.value > 0) ? (
            <HBarList items={byService.filter((b) => b.value > 0)} format={(n) => formatNumber(n)} showShare />
          ) : (
            <p className="py-6 text-center text-[13px] text-ink-3">No open items.</p>
          )}

          <div className="mt-5 border-t border-line-soft pt-4">
            <p className="eyebrow mb-3">By priority</p>
            <HBarList
              items={(["critical", "high", "medium", "low"] as Priority[])
                .map((p) => ({
                  key: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                  value: open.filter((i) => i.priority === p).length,
                  color:
                    p === "critical"
                      ? "var(--color-bad)"
                      : p === "high"
                        ? "var(--color-warn)"
                        : p === "medium"
                          ? "var(--color-accent)"
                          : "var(--color-ink-4)",
                }))
                .filter((x) => x.value > 0)}
              format={(n) => formatNumber(n)}
            />
          </div>
        </Card>

        <Card padded={false}>
          <div className="p-5">
            <CardHeader
              eyebrow="Closed"
              title="Recently resolved"
              subtitle={`${resolved.length} items closed in the last 30 days, at an average of ${snapshot.counts.avgResolutionDays.toFixed(
                1,
              )} days.`}
            />
            <IssueTable issues={resolved} onSelect={setSelected} />
          </div>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Feedback                                                     */}
      {/* ============================================================ */}
      <section className="scroll-mt-24" id="feedback">
        <SectionHeading
          title="Customer feedback"
          subtitle={`${feedback.length} comments submitted by the business users who consume your services. Complaints are linked to the indicator they relate to.`}
          action={
            <div className="flex gap-2">
              <Badge tone="bad">{feedback.filter((f) => f.type === "complaint").length} complaints</Badge>
              <Badge tone="accent">{feedback.filter((f) => f.type === "suggestion").length} suggestions</Badge>
              <Badge tone="good">{feedback.filter((f) => f.type === "compliment").length} compliments</Badge>
            </div>
          }
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {feedback.map((f) => (
            <FeedbackCard key={f.id} feedback={f} />
          ))}
        </div>
      </section>

      <IssueDrawer
        issue={selected}
        kpi={
          selected?.linkedKpiId
            ? snapshot.services.flatMap((s) => s.kpis).find((k) => k.id === selected.linkedKpiId)
            : undefined
        }
        feedback={snapshot.feedback}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium capitalize transition-colors",
        active
          ? "border-accent-line bg-accent-soft text-accent-strong"
          : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2",
      )}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}
