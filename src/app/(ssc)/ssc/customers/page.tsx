"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { getAdoption } from "@/lib/api";
import type { CustomerAdoption, OfferingState } from "@/lib/api";
import { PageHeader } from "@/components/portal/blocks";
import {
  Badge,
  Card,
  CardHeader,
  ProgressBar,
  SectionHeading,
  StatTile,
  StatusPill,
  Table,
  Td,
  Th,
  serviceColor,
} from "@/components/ui/primitives";
import { SERVICES } from "@/lib/mock/organisation";
import { cx, formatMoney, formatNumber, formatPercent } from "@/lib/format";

/**
 * Customers & adoption — who the SSC serves, what they took, what it returned.
 *
 * Three questions in three sections: which customers exist, which offerings
 * each of them has taken, and what measurable benefit came back out. Every
 * benefit figure is read from that customer's own snapshot, so nothing here
 * is a claim the customer's own portal would contradict.
 */

const CELL: Record<OfferingState, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-good-soft text-good border-good-line" },
  "coming-soon": { label: "Soon", className: "bg-warn-soft text-warn border-warn-line" },
  available: { label: "—", className: "bg-transparent text-ink-4 border-transparent" },
};

export default function SscCustomersPage() {
  const { user, periodId, monthIndex, setEntity } = useSession();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () => (user && periodId ? getAdoption(user, periodId, monthIndex) : []),
    [user, periodId, monthIndex],
  );

  if (rows.length === 0) {
    return <p className="py-20 text-center text-[13px] text-ink-3">Building the customer view…</p>;
  }

  const totals = rows.reduce(
    (a, r) => ({
      billed: a.billed + r.benefits.billedYtd,
      hours: a.hours + r.benefits.hoursSavedYtd,
      saving: a.saving + r.benefits.costSavingYtd,
      automated: a.automated + r.benefits.transactionsAutomated,
      analytics: a.analytics + r.benefits.analyticsValue,
      resolved: a.resolved + r.benefits.issuesResolved,
      live: a.live + r.liveCount,
      contracted: a.contracted + r.contractedCount,
    }),
    {
      billed: 0,
      hours: 0,
      saving: 0,
      automated: 0,
      analytics: 0,
      resolved: 0,
      live: 0,
      contracted: 0,
    },
  );

  /** Adoption per tower across the estate — the sales view of the catalogue. */
  const byTower = SERVICES.map((service) => {
    const cells = rows.map((r) => r.towers.find((t) => t.service.id === service.id)?.state);
    return {
      service,
      live: cells.filter((c) => c === "live").length,
      soon: cells.filter((c) => c === "coming-soon").length,
      notTaken: cells.filter((c) => c === "available").length,
    };
  });

  const viewAsCustomer = (entityId: string) => {
    setEntity(entityId);
    router.push("/overview");
  };

  return (
    <>
      <PageHeader
        eyebrow="SSC delivery console"
        title="Customers & adoption"
        subtitle={
          <>
            {rows.length} customers · {totals.live} live tower subscriptions of{" "}
            {totals.contracted} contracted · what each of them took, and what it returned
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Customers served"
          value={rows.length}
          caption={`${formatMoney(totals.billed)} billed year to date`}
          emphasis
        />
        <StatTile
          label="Effort released"
          value={`${formatNumber(totals.hours)} hrs`}
          caption="automation, year to date, across every customer"
          status="good"
          emphasis
        />
        <StatTile
          label="Cost taken out"
          value={formatMoney(totals.saving)}
          caption={`${formatNumber(totals.automated)} transactions run by bots`}
          status="good"
          emphasis
        />
        <StatTile
          label="Issues resolved"
          value={formatNumber(totals.resolved)}
          caption={`plus ${formatMoney(totals.analytics)} of value identified by analytics`}
          emphasis
        />
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Which offerings each customer has taken                     */}
      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <SectionHeading
          title="Offerings taken"
          subtitle="Live means running today. Soon means contracted but not yet released. A dash means the customer has not taken it — that is the sales opportunity."
        />
        <Card padded={false} className="p-5">
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                {SERVICES.map((s) => (
                  <Th key={s.id} align="center">
                    {s.code}
                  </Th>
                ))}
                <Th align="right">Live</Th>
                <Th align="right">Billed YTD</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.entity.id} className="transition-colors hover:bg-surface-sunken">
                  <Td>
                    <span className="block font-semibold">{r.entity.name}</span>
                    <span className="block text-[11.5px] text-ink-4">
                      {r.location.name} · {r.entity.sector}
                    </span>
                  </Td>
                  {r.towers.map((t) => (
                    <Td key={t.service.id} align="center">
                      <span
                        className={cx(
                          "inline-flex items-center rounded-full border px-2 py-[3px] text-[10px] font-extrabold",
                          CELL[t.state].className,
                        )}
                      >
                        {CELL[t.state].label}
                      </span>
                    </Td>
                  ))}
                  <Td align="right" className="font-semibold">
                    {r.liveCount} / {r.contractedCount}
                  </Td>
                  <Td align="right">{formatMoney(r.benefits.billedYtd)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {byTower.map((t) => (
            <Card key={t.service.id}>
              <p className="text-[12.5px] font-bold" style={{ color: serviceColor(t.service.id) }}>
                {t.service.code}
              </p>
              <p className="tnum mt-1 text-[22px] font-bold" style={{ color: "var(--color-navy)" }}>
                {t.live + t.soon}
                <span className="text-[13px] font-medium text-ink-4"> / {rows.length}</span>
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-4">
                {t.live} live · {t.soon} soon · {t.notTaken} not taken
              </p>
              <div className="mt-2.5">
                <ProgressBar
                  value={t.live + t.soon}
                  max={rows.length}
                  color={serviceColor(t.service.id)}
                  height={5}
                  label={`${t.live + t.soon} of ${rows.length} customers contract ${t.service.name}`}
                />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* What it returned                                            */}
      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <SectionHeading
          title="What the customer got back"
          subtitle="Measured outcomes per customer — service level, satisfaction, effort released and cost taken out. Open a row for the full picture."
        />
        <Card padded={false} className="p-5">
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th align="right">SLA</Th>
                <Th>Status</Th>
                <Th align="right">CSAT</Th>
                <Th align="right">NPS</Th>
                <Th align="right">Issues resolved</Th>
                <Th align="right">Hours released</Th>
                <Th align="right">Cost taken out</Th>
                <Th align="right">Automation ROI</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <BenefitRow
                  key={r.entity.id}
                  row={r}
                  open={openId === r.entity.id}
                  onToggle={() => setOpenId(openId === r.entity.id ? null : r.entity.id)}
                  onViewAs={() => viewAsCustomer(r.entity.id)}
                />
              ))}
            </tbody>
          </Table>
        </Card>
      </section>

      <Card className="mt-4">
        <CardHeader
          eyebrow="How to read this"
          title="Every figure here is the customer's own number"
          subtitle="Service level, satisfaction, hours released and cost taken out are read from the same snapshot that customer sees in their portal. Nothing on this page is a separate marketing claim, so an account review cannot be contradicted by the customer's own screen."
        />
      </Card>
    </>
  );
}

function BenefitRow({
  row,
  open,
  onToggle,
  onViewAs,
}: {
  row: CustomerAdoption;
  open: boolean;
  onToggle: () => void;
  onViewAs: () => void;
}) {
  const b = row.benefits;

  return (
    <>
      <tr className="cursor-pointer transition-colors hover:bg-surface-sunken" onClick={onToggle}>
        <Td>
          <span className="block font-semibold">{row.entity.name}</span>
          <span className="block text-[11.5px] text-ink-4">
            {row.liveCount} live {row.liveCount === 1 ? "tower" : "towers"} ·{" "}
            {row.entity.relationshipManager}
          </span>
        </Td>
        <Td align="right" className="font-semibold">
          {formatPercent(b.slaActual)}
        </Td>
        <Td>
          <StatusPill status={b.slaStatus} size="sm" />
        </Td>
        <Td align="right">{b.csat.toFixed(1)}</Td>
        <Td align="right">{b.nps > 0 ? `+${b.nps}` : b.nps}</Td>
        <Td align="right">{formatNumber(b.issuesResolved)}</Td>
        <Td align="right">{formatNumber(b.hoursSavedYtd)}</Td>
        <Td align="right" className="font-semibold text-good">
          {formatMoney(b.costSavingYtd)}
        </Td>
        <Td align="right">{b.automationRoi.toFixed(2)}×</Td>
        <Td align="right">
          <span className="text-[11.5px] font-semibold text-accent">
            {open ? "Hide" : "Detail"}
          </span>
        </Td>
      </tr>

      {open && (
        <tr>
          <Td colSpan={10} className="bg-surface-sunken">
            <div className="grid gap-4 py-2 lg:grid-cols-3">
              <div>
                <p className="eyebrow-muted mb-2">Offerings taken</p>
                <div className="flex flex-wrap gap-1.5">
                  {row.towers
                    .filter((t) => t.state !== "available")
                    .map((t) => (
                      <Badge key={t.service.id} tone={t.state === "live" ? "good" : "warn"}>
                        {t.service.code} · {t.state === "live" ? "live" : "soon"}
                      </Badge>
                    ))}
                  {row.towers
                    .filter((t) => t.state === "available")
                    .map((t) => (
                      <Badge key={t.service.id} tone="outline">
                        {t.service.code} · not taken
                      </Badge>
                    ))}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
                  Billed {formatMoney(b.billedYtd)} year to date. Service level{" "}
                  {formatPercent(b.slaActual)} against a {formatPercent(b.slaTarget)} commitment.
                </p>
              </div>

              <div>
                <p className="eyebrow-muted mb-2">Effort and cost</p>
                <dl className="space-y-1.5 text-[12.5px]">
                  <Metric label="Hours released by automation" value={`${formatNumber(b.hoursSavedYtd)} hrs`} />
                  <Metric label="Cost taken out" value={formatMoney(b.costSavingYtd)} />
                  <Metric
                    label="Transactions run by bots"
                    value={formatNumber(b.transactionsAutomated)}
                  />
                  <Metric
                    label="Eligible volume automated"
                    value={formatPercent(b.automationCoverage * 100, 0)}
                  />
                  <Metric label="Return on automation spend" value={`${b.automationRoi.toFixed(2)}×`} />
                </dl>
              </div>

              <div>
                <p className="eyebrow-muted mb-2">Service and experience</p>
                <dl className="space-y-1.5 text-[12.5px]">
                  <Metric label="Issues resolved this period" value={formatNumber(b.issuesResolved)} />
                  <Metric
                    label="Average resolution time"
                    value={`${b.avgResolutionDays.toFixed(1)} days`}
                  />
                  <Metric label="Customer satisfaction" value={`${b.csat.toFixed(1)} / 5`} />
                  <Metric label="Net promoter score" value={b.nps > 0 ? `+${b.nps}` : `${b.nps}`} />
                  <Metric label="Value identified by analytics" value={formatMoney(b.analyticsValue)} />
                </dl>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewAs();
                  }}
                  className="mt-3 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent"
                >
                  View as customer
                </button>
              </div>
            </div>
          </Td>
        </tr>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="tnum shrink-0 font-semibold text-ink">{value}</dd>
    </div>
  );
}
