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
  FilterChip,
  SectionHeading,
  StatTile,
  serviceColor,
} from "@/components/ui/primitives";
import { HBarList } from "@/components/charts";
import type { Issue, Priority, ServiceId } from "@/lib/domain/types";
import { cx, formatNumber } from "@/lib/format";
import { useSession } from "@/state/session";
import { useTickets, type RaiseTicketInput } from "@/state/tickets";
import { IconClose } from "@/components/portal/icons";

export default function IssuesPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[13px] text-ink-3">Loading…</div>}>
      <IssuesView />
    </Suspense>
  );
}

function IssuesView() {
  const { snapshot, user } = usePortalData();
  const { entityId } = useSession();
  const { tickets, raiseTicket } = useTickets(entityId);
  const search = useSearchParams();
  const [selected, setSelected] = useState<Issue | null>(null);
  const [raising, setRaising] = useState(false);
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

  if (!snapshot || !user) return null;

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
        title="Issues & feedback"
        actions={
          <button
            type="button"
            onClick={() => setRaising(true)}
            className="btn-cta px-4 py-2.5 text-[13px] hover:-translate-y-px"
          >
            + Raise a ticket
          </button>
        }
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
            label="Raised by you"
            value={formatNumber(tickets.length)}
            emphasis
            caption={tickets.length > 0 ? "With the SSC Service Desk" : "None yet"}
          />
        </div>
      </section>

      {/* ============================================================ */}
      {/* Your tickets                                                 */}
      {/* ============================================================ */}
      {tickets.length > 0 && (
        <section className="mb-8">
          <SectionHeading
            title="Your tickets"
            action={<Badge tone="accent">{tickets.length} raised from this account</Badge>}
          />
          <Card padded={false}>
            <div className="p-5">
              <IssueTable issues={tickets} onSelect={setSelected} />
            </div>
          </Card>
        </section>
      )}

      {/* ============================================================ */}
      {/* Issue register                                               */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading title="Issue register" />

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
                  ? "Nothing is open against your services."
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
          <CardHeader eyebrow="Distribution" title="Open items by service" />
          {byService.some((b) => b.value > 0) ? (
            <HBarList items={byService.filter((b) => b.value > 0)} format={(n) => formatNumber(n)} showShare />
          ) : (
            <p className="py-6 text-center text-[13px] text-ink-3">No open items.</p>
          )}

          <div className="mt-5 border-t border-line-soft pt-4">
            <p className="eyebrow-muted mb-3">By priority</p>
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
            <CardHeader eyebrow="Closed" title="Recently resolved" />
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

      {raising && (
        <RaiseTicketModal
          services={snapshot.services.map((s) => ({
            id: s.service.id,
            name: s.service.name,
            subServices: s.service.subServices.map((sub) => sub.name),
          }))}
          onClose={() => setRaising(false)}
          onSubmit={(input) => {
            const ticket = raiseTicket({ ...input, raisedBy: user.name });
            setRaising(false);
            setSelected(ticket);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Raise-a-ticket modal                                                */
/* ------------------------------------------------------------------ */

function RaiseTicketModal({
  services,
  onClose,
  onSubmit,
}: {
  services: { id: ServiceId; name: string; subServices: string[] }[];
  onClose: () => void;
  onSubmit: (input: Omit<RaiseTicketInput, "raisedBy">) => void;
}) {
  const [serviceId, setServiceId] = useState<ServiceId>(services[0]?.id);
  const [subServiceName, setSubServiceName] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const subServices = services.find((s) => s.id === serviceId)?.subServices ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the ticket a subject.");
      return;
    }
    if (!description.trim()) {
      setError("Describe the issue so the SSC team can act on it.");
      return;
    }
    onSubmit({
      serviceId,
      subServiceName: subServiceName || undefined,
      priority,
      title: title.trim(),
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-[520px] rounded-xl border border-line bg-surface shadow-pop">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="eyebrow-muted">SSC Service Desk</p>
            <h2 className="mt-1 text-[16px] font-semibold text-ink">Raise a ticket</h2>
          </div>
          <button type="button" onClick={onClose} className="text-ink-4 hover:text-ink-2" aria-label="Close">
            <IconClose size={18} />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tk-service" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                Service
              </label>
              <select
                id="tk-service"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value as ServiceId);
                  setSubServiceName("");
                }}
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-accent"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tk-sub" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                Sub-service <span className="font-normal text-ink-4">(optional)</span>
              </label>
              <select
                id="tk-sub"
                value={subServiceName}
                onChange={(e) => setSubServiceName(e.target.value)}
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-accent"
              >
                <option value="">—</option>
                {subServices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Priority</p>
            <div className="flex flex-wrap gap-1.5">
              {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cx(
                    "rounded-md border px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors",
                    priority === p
                      ? "border-accent-line bg-accent-soft text-accent-strong"
                      : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="tk-title" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Subject
            </label>
            <input
              id="tk-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Vendor payment stuck beyond due date"
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] text-ink outline-none placeholder:text-ink-4 focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="tk-desc" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Description
            </label>
            <textarea
              id="tk-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Reference numbers, dates, amounts — whatever helps the SSC team resolve it."
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-4 focus:border-accent"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-bad-line bg-bad-soft px-3 py-2.5 text-[12.5px] text-bad">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-cta px-4 py-2.5 text-[13px] hover:-translate-y-px"
            >
              Submit to SSC
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

