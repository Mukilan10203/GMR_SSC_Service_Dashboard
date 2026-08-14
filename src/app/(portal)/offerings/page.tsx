"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/state/session";
import { usePortalData } from "@/components/portal/usePortalData";
import { listOfferings } from "@/lib/api";
import type { Offering } from "@/lib/api";
import { PageHeader } from "@/components/portal/blocks";
import {
  Badge,
  Card,
  ProgressBar,
  SectionHeading,
  ServiceGlyph,
  StatTile,
  StatusPill,
  serviceColor,
} from "@/components/ui/primitives";
import { formatMoney, formatPercent } from "@/lib/format";

/**
 * Offerings — the full SSC catalogue, not just what this entity already buys.
 *
 * The Services pages answer "how is what I take performing". This page answers
 * the question before it: "what else can the SSC do for me, and who else in
 * the group is already using it".
 */

const STATE_META = {
  live: { label: "Live for you", tone: "good" as const },
  "coming-soon": { label: "Coming soon", tone: "warn" as const },
  available: { label: "Available to add", tone: "accent" as const },
};

export default function OfferingsPage() {
  const { user, snapshot } = usePortalData();
  const { entityId, periodId } = useSession();
  const [enquired, setEnquired] = useState<string[]>([]);

  const offerings = useMemo(
    () => (user && entityId && periodId ? listOfferings(user, entityId, periodId) : []),
    [user, entityId, periodId],
  );

  if (!snapshot || offerings.length === 0) return null;

  const live = offerings.filter((o) => o.state === "live");
  const soon = offerings.filter((o) => o.state === "coming-soon");
  const available = offerings.filter((o) => o.state === "available");

  return (
    <>
      <PageHeader
        eyebrow="Service catalogue"
        title="Offerings"
        subtitle={
          <>
            Everything the Shared Service Centre can deliver, and where{" "}
            {snapshot.entity.name} stands on each one.
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Live for you"
          value={live.length}
          caption={`${formatMoney(snapshot.billing.fyForecast)} full-year fee`}
          status="good"
          emphasis
        />
        <StatTile
          label="Available to add"
          value={available.length}
          caption="contracted by other GMR entities, not by you"
          emphasis
        />
        <StatTile
          label="Coming soon"
          value={soon.length}
          caption="already in your contract, not yet released"
          emphasis
        />
      </div>

      {available.length > 0 && (
        <section className="mt-9">
          <SectionHeading
            title="Available to add"
            subtitle="Delivered today to other entities in the group. Ask your relationship manager to extend your contract."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {available.map((o) => (
              <OfferingCard
                key={o.service.id}
                offering={o}
                enquired={enquired.includes(o.service.id)}
                onEnquire={() => setEnquired((prev) => [...prev, o.service.id])}
                manager={snapshot.entity.relationshipManager}
              />
            ))}
          </div>
        </section>
      )}

      {live.length > 0 && (
        <section className="mt-9">
          <SectionHeading
            title="Live for you"
            subtitle="Running today, with the service level and spend you can open in full."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {live.map((o) => (
              <OfferingCard
                key={o.service.id}
                offering={o}
                enquired={false}
                onEnquire={() => undefined}
                manager={snapshot.entity.relationshipManager}
              />
            ))}
          </div>
        </section>
      )}

      {soon.length > 0 && (
        <section className="mt-9">
          <SectionHeading
            title="Coming soon"
            subtitle="In your contract and being built out. You will see them here the moment they are released."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {soon.map((o) => (
              <OfferingCard
                key={o.service.id}
                offering={o}
                enquired={enquired.includes(o.service.id)}
                onEnquire={() => setEnquired((prev) => [...prev, o.service.id])}
                manager={snapshot.entity.relationshipManager}
              />
            ))}
          </div>
        </section>
      )}

      <Card className="mt-9">
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          <b style={{ color: "var(--color-navy)" }}>Automation and analytics are included.</b> They
          are not separately contracted towers — every offering above carries its own bots, agents
          and reporting, charged inside that tower&rsquo;s rate card rather than added on top.
        </p>
      </Card>
    </>
  );
}

function OfferingCard({
  offering,
  enquired,
  onEnquire,
  manager,
}: {
  offering: Offering;
  enquired: boolean;
  onEnquire: () => void;
  manager: string;
}) {
  const { service, state, adoption, delivers, live } = offering;
  const meta = STATE_META[state];
  const color = serviceColor(service.id);

  return (
    <Card className="flex flex-col">
      <header className="flex items-start gap-3">
        <ServiceGlyph serviceId={service.id} code={service.code} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="text-[16px] font-bold tracking-[-0.015em]"
              style={{ color: "var(--color-navy)" }}
            >
              {service.name}
            </h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{service.tagline}</p>
        </div>
      </header>

      <p className="mt-3.5 text-[13px] leading-relaxed text-ink-2">{service.description}</p>

      <ul className="mt-3.5 space-y-1.5">
        {delivers.map((d) => (
          <li key={d} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-3">
            <span aria-hidden style={{ color }}>
              ▸
            </span>
            <span className="min-w-0">{d}</span>
          </li>
        ))}
      </ul>

      {/* Group adoption — the "who else uses this" question. */}
      <div className="mt-4 rounded-lg border border-line bg-surface-sunken p-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11.5px] font-semibold text-ink-2">Taken across the group</p>
          <p className="tnum text-[12px] font-bold" style={{ color: "var(--color-navy)" }}>
            {adoption.taken} of {adoption.total} entities
          </p>
        </div>
        <div className="mt-2">
          <ProgressBar
            value={adoption.taken}
            max={adoption.total}
            color={color}
            height={5}
            label={`${adoption.taken} of ${adoption.total} entities contract this service`}
          />
        </div>
      </div>

      {live && (
        <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-line p-3">
          <div>
            <p className="eyebrow-muted">Service level</p>
            <p className="tnum mt-1 text-[14px] font-bold" style={{ color: "var(--color-navy)" }}>
              {formatPercent(live.slaActual)}
            </p>
            <div className="mt-1">
              <StatusPill status={live.status} size="sm">
                {`vs ${formatPercent(live.slaTarget)}`}
              </StatusPill>
            </div>
          </div>
          <div>
            <p className="eyebrow-muted">Billed YTD</p>
            <p className="tnum mt-1 text-[14px] font-bold" style={{ color: "var(--color-navy)" }}>
              {formatMoney(live.ytdSpend)}
            </p>
          </div>
          <div>
            <p className="eyebrow-muted">Measured by</p>
            <p className="tnum mt-1 text-[14px] font-bold" style={{ color: "var(--color-navy)" }}>
              {live.kpiCount} KPIs
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
        {state === "live" ? (
          <Link
            href={`/services/${service.id}`}
            className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent"
          >
            Open service →
          </Link>
        ) : enquired ? (
          <p className="rounded-lg border border-good-line bg-good-soft px-3 py-2 text-[12px] font-medium text-good">
            Noted — {manager} will pick this up with you.
          </p>
        ) : (
          <button
            type="button"
            onClick={onEnquire}
            className="btn-cta px-4 py-2.5 text-[12.5px] hover:-translate-y-px"
          >
            {state === "available" ? "Register interest" : "Ask to be notified"}
          </button>
        )}
      </div>
    </Card>
  );
}
