"use client";

import { useMemo, useState } from "react";
import { useSession } from "@/state/session";
import { useEstate } from "@/components/ssc/SscShell";
import { PageHeader } from "@/components/portal/blocks";
import { IssueDrawer } from "@/components/portal/issue-blocks";
import { Select } from "@/components/portal/PortalShell";
import {
  Badge,
  Card,
  FilterChip,
  PRIORITY_TONE,
  StatTile,
  Table,
  Td,
  Th,
  serviceColor,
} from "@/components/ui/primitives";
import type { EstateIssue } from "@/lib/api";
import { providerTowers } from "@/lib/api";
import type { Issue, IssueStatus, Priority, ServiceId } from "@/lib/domain/types";
import { cx, formatNumber } from "@/lib/format";

/**
 * The issue queue — every open item across every customer, in one list.
 *
 * This is the screen the customer portal cannot give the SSC: each customer
 * sees only their own register, so nobody could answer "what is oldest
 * across the estate" without opening nine portals. Sorted worst-first:
 * breached before on-track, then furthest past target.
 */

const STATUSES: { id: IssueStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "in-progress", label: "In progress" },
  { id: "awaiting-customer", label: "Awaiting customer" },
  { id: "resolved", label: "Resolved" },
];

type AgeBucket = "all" | "breached" | "due-soon";

export default function SscIssueQueuePage() {
  const { estate } = useEstate();
  const { user } = useSession();
  const [selected, setSelected] = useState<Issue | null>(null);

  const [query, setQuery] = useState("");
  const [tower, setTower] = useState<ServiceId | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [status, setStatus] = useState<IssueStatus | "all">("all");
  const [customer, setCustomer] = useState("all");
  const [age, setAge] = useState<AgeBucket>("all");

  const towers = user ? providerTowers(user) : [];

  // Everything but resolved items — the queue is a work list, and resolved
  // items are reachable through the status filter when they are wanted.
  const queue = useMemo(
    () => estate?.issues.filter((i) => i.status !== "resolved") ?? [],
    [estate],
  );

  const filtered = useMemo(() => {
    const source = status === "resolved" ? (estate?.issues ?? []) : queue;
    const q = query.trim().toLowerCase();
    return source.filter((i) => {
      if (tower !== "all" && i.serviceId !== tower) return false;
      if (priority !== "all" && i.priority !== priority) return false;
      if (status !== "all" && i.status !== status) return false;
      if (customer !== "all" && i.entityId !== customer) return false;
      if (age === "breached" && !i.breached) return false;
      if (age === "due-soon" && (i.breached || i.agingDays < i.slaTargetDays * 0.7)) return false;
      if (
        q &&
        !`${i.ref} ${i.title} ${i.owner} ${i.ownerTeam} ${i.entityName} ${i.category}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [estate, queue, query, tower, priority, status, customer, age]);

  if (!estate) {
    return <p className="py-20 text-center text-[13px] text-ink-3">Building the estate view…</p>;
  }

  const breached = queue.filter((i) => i.breached);
  const critical = queue.filter((i) => i.priority === "critical");
  const awaitingCustomer = queue.filter((i) => i.status === "awaiting-customer");
  const oldest = queue.reduce((max, i) => Math.max(max, i.agingDays), 0);

  /** Which teams are carrying the breached work — the staffing question. */
  const byTeam = Object.entries(
    breached.reduce<Record<string, number>>((acc, i) => {
      acc[i.ownerTeam] = (acc[i.ownerTeam] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const resetAll = () => {
    setQuery("");
    setTower("all");
    setPriority("all");
    setStatus("all");
    setCustomer("all");
    setAge("all");
  };

  const filtersActive =
    query !== "" ||
    tower !== "all" ||
    priority !== "all" ||
    status !== "all" ||
    customer !== "all" ||
    age !== "all";

  return (
    <>
      <PageHeader
        eyebrow="SSC delivery console"
        title="Issue queue"
        subtitle={
          <>
            Every open item across {estate.totals.customers} customers · {estate.periodLabel} · data
            as at {estate.asOf}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Open across the estate"
          value={formatNumber(queue.length)}
          caption={`oldest item is ${oldest} days old`}
          emphasis
        />
        <StatTile
          label="Past resolution target"
          value={formatNumber(breached.length)}
          status={breached.length > 0 ? "bad" : "good"}
          caption="agreed target already missed"
          emphasis
        />
        <StatTile
          label="Critical"
          value={formatNumber(critical.length)}
          status={critical.length > 0 ? "warn" : "good"}
          caption="highest priority band"
          emphasis
        />
        <StatTile
          label="Awaiting the customer"
          value={formatNumber(awaitingCustomer.length)}
          caption="blocked on the customer, not on the SSC"
          emphasis
        />
      </div>

      {byTeam.length > 0 && (
        <Card className="mt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[12px] font-semibold text-ink-2">Breached work sits with:</p>
            {byTeam.map(([team, n]) => (
              <Badge key={team} tone="outline">
                {team} · {n}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Filters                                                     */}
      {/* ---------------------------------------------------------- */}

      <Card padded={false} className="mt-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, title, owner, customer…"
            className="h-9 min-w-[240px] flex-1 rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
          />

          <Select
            label="Customer"
            value={customer}
            minWidth={230}
            options={[
              { id: "all", label: "All customers", hint: `${estate.customers.length} entities` },
              ...estate.customers.map((c) => ({
                id: c.entity.id,
                label: c.entity.name,
                hint: `${c.openIssues} open · ${c.breachedIssues} breached`,
              })),
            ]}
            onChange={setCustomer}
          />

          {filtersActive && (
            <button
              type="button"
              onClick={resetAll}
              className="h-9 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={tower === "all"} onClick={() => setTower("all")}>
              All towers
            </FilterChip>
            {towers.map((t) => {
              const n = queue.filter((i) => i.serviceId === t.id).length;
              return (
                <FilterChip
                  key={t.id}
                  active={tower === t.id}
                  onClick={() => setTower(t.id)}
                  dot={serviceColor(t.id)}
                >
                  {t.code} ({n})
                </FilterChip>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={priority === "all"} onClick={() => setPriority("all")}>
              Any priority
            </FilterChip>
            {(["critical", "high", "medium", "low"] as Priority[]).map((p) => {
              const n = queue.filter((i) => i.priority === p).length;
              if (n === 0) return null;
              return (
                <FilterChip key={p} active={priority === p} onClick={() => setPriority(p)}>
                  {p} ({n})
                </FilterChip>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
              Any status
            </FilterChip>
            {STATUSES.map((s) => {
              const n =
                s.id === "resolved"
                  ? estate.issues.filter((i) => i.status === "resolved").length
                  : queue.filter((i) => i.status === s.id).length;
              if (n === 0) return null;
              return (
                <FilterChip key={s.id} active={status === s.id} onClick={() => setStatus(s.id)}>
                  {s.label} ({n})
                </FilterChip>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={age === "all"} onClick={() => setAge("all")}>
              Any age
            </FilterChip>
            <FilterChip active={age === "breached"} onClick={() => setAge("breached")}>
              Breached ({breached.length})
            </FilterChip>
            <FilterChip active={age === "due-soon"} onClick={() => setAge("due-soon")}>
              Close to target
            </FilterChip>
          </div>
        </div>

        {/* -------------------------------------------------------- */}
        {/* Queue                                                     */}
        {/* -------------------------------------------------------- */}

        <div className="p-5">
          <p className="mb-3 text-[12px] text-ink-3">
            Showing <b className="text-ink">{filtered.length}</b> of {queue.length} open items.
            Worst first — breached, then furthest past target.
          </p>

          {filtered.length === 0 ? (
            <p className="rounded-lg border border-good-line bg-good-soft px-4 py-8 text-center text-[13px] text-good">
              Nothing matches these filters.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Issue</Th>
                  <Th>Customer</Th>
                  <Th>Tower</Th>
                  <Th>Priority</Th>
                  <Th align="right">Age / target</Th>
                  <Th>Owner team</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <QueueRow key={i.id} issue={i} onSelect={setSelected} />
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <IssueDrawer issue={selected} feedback={[]} onClose={() => setSelected(null)} />
    </>
  );
}

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  "in-progress": "In progress",
  "awaiting-customer": "Awaiting customer",
  resolved: "Resolved",
};

function QueueRow({
  issue,
  onSelect,
}: {
  issue: EstateIssue;
  onSelect: (issue: Issue) => void;
}) {
  const over = issue.agingDays - issue.slaTargetDays;

  return (
    <tr
      onClick={() => onSelect(issue)}
      className="cursor-pointer transition-colors hover:bg-surface-sunken"
    >
      <Td>
        <span className="font-mono text-[11.5px] text-ink-3">{issue.ref}</span>
      </Td>
      <Td>
        <span className="block max-w-[380px] truncate font-medium text-ink">{issue.title}</span>
        <span className="block text-[11.5px] text-ink-4">{issue.category}</span>
      </Td>
      <Td>
        <span className="block text-[12.5px] font-medium text-ink-2">{issue.entityShortName}</span>
        <span className="block text-[11px] text-ink-4">{issue.locationName}</span>
      </Td>
      <Td>
        <span
          className="text-[12px] font-semibold"
          style={{ color: serviceColor(issue.serviceId) }}
        >
          {issue.serviceCode}
        </span>
      </Td>
      <Td>
        <Badge tone={PRIORITY_TONE[issue.priority]}>{issue.priority}</Badge>
      </Td>
      <Td align="right">
        <span className={cx("font-semibold", issue.breached && "text-bad")}>
          {issue.agingDays}d
        </span>
        <span className="text-ink-4"> / {issue.slaTargetDays}d</span>
        {issue.breached && (
          <span className="block text-[11px] font-bold text-bad">+{over}d over</span>
        )}
      </Td>
      <Td muted>{issue.ownerTeam}</Td>
      <Td>
        <Badge tone={issue.status === "awaiting-customer" ? "warn" : "neutral"}>
          {STATUS_LABEL[issue.status]}
        </Badge>
      </Td>
    </tr>
  );
}
