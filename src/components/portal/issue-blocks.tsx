"use client";


import { useEffect } from "react";
import Link from "next/link";
import type { Feedback, Issue, IssueStatus, Kpi } from "@/lib/domain/types";
import { ageLabel, cx, formatDate } from "@/lib/format";
import { SERVICE_MAP } from "@/lib/mock/organisation";
import {
  Badge,
  Card,
  CardHeader,
  PRIORITY_TONE,
  ServiceGlyph,
  StatusPill,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { IconClose } from "./icons";

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  "in-progress": "In progress",
  "awaiting-customer": "Awaiting customer",
  resolved: "Resolved",
};

const STATUS_TONE: Record<IssueStatus, "neutral" | "accent" | "warn" | "good"> = {
  open: "neutral",
  "in-progress": "accent",
  "awaiting-customer": "warn",
  resolved: "good",
};

export function IssueTable({
  issues,
  onSelect,
  showService = true,
  emptyNote,
}: {
  issues: Issue[];
  onSelect: (issue: Issue) => void;
  showService?: boolean;
  emptyNote?: string;
}) {
  if (issues.length === 0) {
    return (
      <p className="rounded-lg border border-good-line bg-good-soft px-4 py-6 text-center text-[13px] text-good">
        {emptyNote ?? "No open items. Everything in this area is within its resolution target."}
      </p>
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Issue</Th>
          {showService && <Th>Service</Th>}
          <Th>Priority</Th>
          <Th>Status</Th>
          <Th align="right">Ageing</Th>
          <Th>Owner</Th>
          <Th align="right">Opened</Th>
        </tr>
      </thead>
      <tbody>
        {issues.map((i) => {
          const overdue = i.status !== "resolved" && i.agingDays > i.slaTargetDays;
          return (
            <tr
              key={i.id}
              onClick={() => onSelect(i)}
              className="cursor-pointer transition-colors hover:bg-surface-sunken"
            >
              <Td>
                <span className="block font-medium text-ink">{i.title}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-ink-4">
                  {i.ref} · {i.category}
                </span>
              </Td>
              {showService && (
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: `var(--color-svc-${i.serviceId})` }}
                    />
                    {SERVICE_MAP[i.serviceId].code}
                  </span>
                </Td>
              )}
              <Td>
                <Badge tone={PRIORITY_TONE[i.priority]}>{i.priority}</Badge>
              </Td>
              <Td>
                <Badge tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Badge>
              </Td>
              <Td align="right">
                <span className={cx("font-medium", overdue && "text-bad")}>{ageLabel(i.agingDays)}</span>
                <span className="block text-[11px] text-ink-4">target {i.slaTargetDays}d</span>
              </Td>
              <Td muted>
                <span className="block">{i.owner}</span>
                <span className="block text-[11px] text-ink-4">{i.ownerTeam}</span>
              </Td>
              <Td align="right" muted>
                {formatDate(i.openedOn)}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

export function IssueDrawer({
  issue,
  kpi,
  feedback,
  onClose,
}: {
  issue: Issue | null;
  kpi?: Kpi;
  feedback: Feedback[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!issue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [issue, onClose]);

  if (!issue) return null;

  const overdue = issue.status !== "resolved" && issue.agingDays > issue.slaTargetDays;
  const related = feedback.filter((f) => f.serviceId === issue.serviceId && f.linkedKpiId === issue.linkedKpiId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={issue.title}
        className="animate-in relative flex h-full w-full max-w-[560px] flex-col overflow-y-auto bg-surface shadow-pop"
      >
        <header className="sticky top-0 z-10 border-b border-line bg-surface px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={PRIORITY_TONE[issue.priority]}>{issue.priority}</Badge>
                <Badge tone={STATUS_TONE[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
                <span className="font-mono text-[11.5px] text-ink-4">{issue.ref}</span>
              </div>
              <h2 className="text-[16px] leading-snug font-semibold text-ink">{issue.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-sunken hover:text-ink"
              aria-label="Close"
            >
              <IconClose size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 py-5">
          <dl className="mb-5 grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface-sunken p-4 sm:grid-cols-4">
            {[
              { label: "Service", value: SERVICE_MAP[issue.serviceId].code },
              { label: "Category", value: issue.category },
              {
                label: "Ageing",
                value: ageLabel(issue.agingDays),
                tone: overdue ? "bad" : undefined,
              },
              { label: "Resolution target", value: `${issue.slaTargetDays} days` },
            ].map((d) => (
              <div key={d.label}>
                <dt className="eyebrow">{d.label}</dt>
                <dd
                  className={cx(
                    "mt-1.5 text-[13px] font-medium",
                    d.tone === "bad" ? "text-bad" : "text-ink",
                  )}
                >
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>

          <section className="mb-5">
            <h3 className="eyebrow mb-2">What is happening</h3>
            <p className="text-[13.5px] leading-relaxed text-ink-2">{issue.description}</p>
          </section>

          <section className="mb-5 rounded-lg border border-line p-4">
            <h3 className="eyebrow mb-2">Business impact</h3>
            <p className="text-[13px] leading-relaxed text-ink-2">{issue.impact}</p>
          </section>

          {kpi && (
            <section className="mb-5">
              <h3 className="eyebrow mb-2">Linked performance indicator</h3>
              <Link
                href={`/services/${kpi.serviceId}?tab=kpi`}
                className="block rounded-lg border border-line p-4 transition-colors hover:border-line-strong hover:bg-surface-sunken"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{kpi.name}</p>
                    <p className="mt-1 text-[12.5px] text-ink-3">{kpi.gapNarrative}</p>
                  </div>
                  <StatusPill status={kpi.status} size="sm" />
                </div>
                <div className="mt-3 flex gap-6 border-t border-line-soft pt-3">
                  <span className="text-[12px] text-ink-3">
                    Actual <span className="font-semibold text-ink tnum">{kpi.actual}</span>
                  </span>
                  <span className="text-[12px] text-ink-3">
                    Target{" "}
                    <span className="font-medium text-ink-2 tnum">
                      {kpi.direction === "higher-better" ? "≥" : "≤"} {kpi.target}
                    </span>
                  </span>
                </div>
              </Link>
            </section>
          )}

          <section className="mb-5">
            <h3 className="eyebrow mb-3">Ownership</h3>
            <div className="flex items-center gap-3 rounded-lg border border-line p-4">
              <ServiceGlyph serviceId={issue.serviceId} code={SERVICE_MAP[issue.serviceId].code} />
              <div>
                <p className="text-[13.5px] font-medium text-ink">{issue.owner}</p>
                <p className="text-[12px] text-ink-3">{issue.ownerTeam}</p>
              </div>
              <p className="ml-auto text-right text-[12px] text-ink-4">
                Opened
                <span className="block font-medium text-ink-2">{formatDate(issue.openedOn)}</span>
              </p>
            </div>
          </section>

          <section className="mb-5">
            <h3 className="eyebrow mb-3">Activity</h3>
            <ol className="space-y-0">
              {issue.timeline.map((u, i) => (
                <li key={i} className="relative flex gap-3.5 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span
                      className={cx(
                        "mt-1 size-2.5 shrink-0 rounded-full border-2",
                        i === issue.timeline.length - 1
                          ? "border-accent bg-accent"
                          : "border-line-strong bg-surface",
                      )}
                    />
                    {i < issue.timeline.length - 1 && <span className="w-px flex-1 bg-line" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-[13px] leading-relaxed text-ink-2">{u.note}</p>
                    <p className="mt-1 text-[11.5px] text-ink-4">
                      {formatDate(u.on)} · {u.by}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {related.length > 0 && (
            <section>
              <h3 className="eyebrow mb-3">Related customer feedback</h3>
              <div className="space-y-3">
                {related.map((f) => (
                  <FeedbackCard key={f.id} feedback={f} compact />
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

const TYPE_META = {
  compliment: { label: "Compliment", tone: "good" },
  complaint: { label: "Complaint", tone: "bad" },
  suggestion: { label: "Suggestion", tone: "accent" },
} as const;

export function FeedbackCard({
  feedback,
  compact = false,
}: {
  feedback: Feedback;
  compact?: boolean;
}) {
  const meta = TYPE_META[feedback.type];
  return (
    <figure
      className={cx(
        "rounded-lg border bg-surface p-4",
        feedback.type === "complaint" ? "border-bad-line" : "border-line",
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {!compact && <Badge tone="outline">{SERVICE_MAP[feedback.serviceId].code}</Badge>}
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-3 tnum">
          <span aria-hidden style={{ color: feedback.rating >= 4 ? "var(--color-good)" : feedback.rating >= 3 ? "var(--color-warn)" : "var(--color-bad)" }}>
            {"★".repeat(feedback.rating)}
            <span className="text-ink-4">{"★".repeat(5 - feedback.rating)}</span>
          </span>
          {feedback.rating} / 5
        </span>
      </div>

      <blockquote className="text-[13px] leading-relaxed text-ink-2 italic">
        “{feedback.quote}”
      </blockquote>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line-soft pt-2.5 text-[11.5px] text-ink-4">
        <span className="font-medium text-ink-3">{feedback.author}</span>
        <span>· {feedback.authorRole}</span>
        <span>· {formatDate(feedback.on)}</span>
        {feedback.responded ? (
          <span className="ml-auto inline-flex items-center gap-1 text-good">
            <span aria-hidden>✓</span> Responded
          </span>
        ) : (
          <span className="ml-auto text-warn">Awaiting response</span>
        )}
      </figcaption>
    </figure>
  );
}

export function FeedbackList({ feedback, title, subtitle }: { feedback: Feedback[]; title: string; subtitle?: string }) {
  return (
    <Card>
      <CardHeader eyebrow="Voice of the customer" title={title} subtitle={subtitle} />
      {feedback.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-3">
          No feedback has been submitted against this service in the current period.
        </p>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <FeedbackCard key={f.id} feedback={f} />
          ))}
        </div>
      )}
    </Card>
  );
}
