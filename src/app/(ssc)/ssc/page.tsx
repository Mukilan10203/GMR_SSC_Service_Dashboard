"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { useEstate } from "@/components/ssc/SscShell";
import { PageHeader } from "@/components/portal/blocks";
import {
  Badge,
  Card,
  CardHeader,
  PRIORITY_TONE,
  ProgressBar,
  SectionHeading,
  ServiceGlyph,
  StatTile,
  StatusPill,
  Table,
  Td,
  Th,
  serviceColor,
} from "@/components/ui/primitives";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

/**
 * Command centre — the estate on one screen.
 *
 * Reads exactly the same snapshots the customer portal reads, pivoted two
 * ways: by tower (how is F&A doing across everyone) and by customer (which
 * account needs a conversation this week).
 */
export default function SscCommandCentrePage() {
  const { estate } = useEstate();
  const { setEntity } = useSession();
  const router = useRouter();

  if (!estate) {
    return <p className="py-20 text-center text-[13px] text-ink-3">Building the estate view…</p>;
  }

  const t = estate.totals;
  const slaStatus = t.sla >= t.slaTarget ? "good" : t.sla >= t.slaTarget - 1.5 ? "warn" : "bad";

  /** Open a customer's own portal exactly as that customer sees it. */
  const viewAsCustomer = (entityId: string) => {
    setEntity(entityId);
    router.push("/overview");
  };

  return (
    <>
      <PageHeader
        eyebrow="SSC delivery console"
        title="Delivery command centre"
        subtitle={
          <>
            {t.customers} customers · {t.towers} live towers · {estate.periodLabel} · data as at{" "}
            {estate.asOf}
          </>
        }
        actions={
          <Link
            href="/ssc/issues"
            className="btn-cta px-4 py-2.5 text-[13px] hover:-translate-y-px"
          >
            Open issue queue →
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Estate SLA"
          value={formatPercent(t.sla)}
          status={slaStatus}
          caption={`target ${formatPercent(t.slaTarget)} · fee-weighted`}
          emphasis
        />
        <StatTile
          label="Open issues"
          value={formatNumber(t.openIssues)}
          status={t.breachedIssues > 0 ? "bad" : "good"}
          caption={`${t.breachedIssues} past resolution target · ${t.criticalIssues} critical`}
          href="/ssc/issues"
          emphasis
        />
        <StatTile
          label="Customers off target"
          value={`${t.customersOffTarget} / ${t.customers}`}
          status={t.customersOffTarget === 0 ? "good" : t.customersOffTarget > 2 ? "bad" : "warn"}
          caption="entities below their agreed service level"
          emphasis
        />
        <StatTile
          label="Estate CSAT"
          value={`${t.csat.toFixed(1)} / 5`}
          status={t.csat >= 4.3 ? "good" : t.csat >= 4 ? "warn" : "bad"}
          caption={`${t.unansweredFeedback} comments awaiting a reply`}
          emphasis
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label={estate.isCurrentPeriod ? "Billed year to date" : "Billed, full year"}
          value={formatMoney(t.ytdBilling)}
          caption={`${estate.periodLabel} · ${t.customers} customers`}
        />
        <StatTile
          label="Outstanding"
          value={formatMoney(t.outstanding)}
          caption="invoiced and not yet settled, across the estate"
        />
        <StatTile
          label="Unanswered feedback"
          value={formatNumber(t.unansweredFeedback)}
          status={t.unansweredFeedback > 0 ? "warn" : "good"}
          caption="customer comments with no SSC response"
        />
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Towers — one service across every customer                  */}
      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <SectionHeading
          title="Service towers"
          subtitle="The same tower measured across every customer it is delivered to."
        />
        <Card padded={false} className="p-5">
          <Table>
            <thead>
              <tr>
                <Th>Tower</Th>
                <Th align="right">Customers</Th>
                <Th align="right">SLA</Th>
                <Th align="right">Target</Th>
                <Th>Status</Th>
                <Th align="right">Open</Th>
                <Th align="right">Breached</Th>
                <Th align="right">CSAT</Th>
                <Th align="right">Billed YTD</Th>
                <Th>Weakest customer</Th>
              </tr>
            </thead>
            <tbody>
              {estate.towers.map((tower) => (
                <tr key={tower.service.id} className="transition-colors hover:bg-surface-sunken">
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <ServiceGlyph
                        serviceId={tower.service.id}
                        code={tower.service.code}
                        size={30}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{tower.service.name}</span>
                        <span className="block text-[11.5px] text-ink-4">
                          {formatPercent(tower.utilisation * 100, 0)} of contracted capacity in use
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td align="right">{tower.customerCount}</Td>
                  <Td align="right" className="font-semibold">
                    {formatPercent(tower.sla)}
                  </Td>
                  <Td align="right" muted>
                    {formatPercent(tower.target)}
                  </Td>
                  <Td>
                    <StatusPill status={tower.status} size="sm" />
                  </Td>
                  <Td align="right">{tower.openIssues}</Td>
                  <Td align="right" className={tower.breachedIssues > 0 ? "font-bold text-bad" : ""}>
                    {tower.breachedIssues}
                  </Td>
                  <Td align="right">{tower.csat.toFixed(1)}</Td>
                  <Td align="right">{formatMoney(tower.ytd)}</Td>
                  <Td muted>
                    {tower.weakest
                      ? `${tower.weakest.name} · ${formatPercent(tower.weakest.sla)}`
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Customers                                                   */}
      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <SectionHeading
          title="Customers"
          subtitle="Every entity the SSC delivers to, largest fee first. Open one to see exactly what that customer sees."
        />
        <Card padded={false} className="p-5">
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Relationship manager</Th>
                <Th align="right">SLA</Th>
                <Th>Status</Th>
                <Th align="right">Open issues</Th>
                <Th align="right">Breached</Th>
                <Th align="right">CSAT</Th>
                <Th align="right">Billed YTD</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {estate.customers.map((c) => (
                <tr key={c.entity.id} className="transition-colors hover:bg-surface-sunken">
                  <Td>
                    <span className="block font-semibold">{c.entity.name}</span>
                    <span className="block text-[11.5px] text-ink-4">
                      {c.location.name} · {c.serviceCount} live{" "}
                      {c.serviceCount === 1 ? "tower" : "towers"}
                    </span>
                  </Td>
                  <Td muted>{c.relationshipManager}</Td>
                  <Td align="right" className="font-semibold">
                    {formatPercent(c.sla)}
                  </Td>
                  <Td>
                    <StatusPill status={c.status} size="sm" />
                  </Td>
                  <Td align="right">
                    {c.openIssues}
                    {c.criticalIssues > 0 && (
                      <span className="ml-1.5 text-[11px] font-bold text-bad">
                        {c.criticalIssues} crit
                      </span>
                    )}
                  </Td>
                  <Td align="right" className={c.breachedIssues > 0 ? "font-bold text-bad" : ""}>
                    {c.breachedIssues}
                  </Td>
                  <Td align="right">{c.csat.toFixed(1)}</Td>
                  <Td align="right">{formatMoney(c.ytdBilling)}</Td>
                  <Td align="right">
                    <button
                      type="button"
                      onClick={() => viewAsCustomer(c.entity.id)}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent"
                    >
                      View as customer
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Estate-wide attention + worst issues                        */}
      {/* ---------------------------------------------------------- */}

      <section className="mt-9 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Across every customer"
            title="Needs attention"
            subtitle="Alerts raised on any customer, worst first."
          />
          {estate.attention.length === 0 ? (
            <p className="rounded-lg border border-good-line bg-good-soft px-4 py-6 text-center text-[13px] text-good">
              Nothing is flagged across the estate this month.
            </p>
          ) : (
            <ul className="space-y-2">
              {estate.attention.slice(0, 7).map((a) => (
                <li
                  key={`${a.entityId}-${a.id}`}
                  className="rounded-lg border border-line bg-surface p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-semibold text-ink">{a.title}</p>
                    <Badge
                      tone={
                        a.severity === "critical"
                          ? "bad"
                          : a.severity === "warning"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {a.entityName}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{a.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="Service desk"
            title="Most overdue issues"
            subtitle="Open items furthest past their agreed resolution target."
            action={
              <Link
                href="/ssc/issues"
                className="text-[12px] font-semibold text-accent hover:underline"
              >
                Full queue →
              </Link>
            }
          />
          <ul className="space-y-2">
            {estate.issues
              .filter((i) => i.status !== "resolved")
              .slice(0, 7)
              .map((i) => (
                <li key={i.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-[13px] font-semibold text-ink">{i.title}</p>
                    <Badge tone={PRIORITY_TONE[i.priority]}>{i.priority}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-4">
                    <span
                      className="inline-flex items-center gap-1.5 font-semibold"
                      style={{ color: serviceColor(i.serviceId) }}
                    >
                      {i.serviceCode}
                    </span>
                    <span>·</span>
                    <span>{i.entityShortName}</span>
                    <span>·</span>
                    <span className={i.breached ? "font-bold text-bad" : ""}>
                      {i.agingDays}d open / {i.slaTargetDays}d target
                    </span>
                    <span>·</span>
                    <span>{i.ownerTeam}</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={Math.min(i.agingDays, i.slaTargetDays * 2)}
                      max={i.slaTargetDays * 2}
                      color={i.breached ? "var(--color-bad)" : "var(--color-accent)"}
                      height={4}
                      label={`${i.agingDays} days open against a ${i.slaTargetDays} day target`}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      </section>
    </>
  );
}
