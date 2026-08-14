"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getSynergyView } from "@/lib/api";
import type { CompanyOutcome } from "@/lib/api";
import { DEFAULT_PERIOD_ID } from "@/lib/mock/calendar";
import { PortalMark } from "@/components/portal/PortalMark";
import {
  Badge,
  Card,
  CardHeader,
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
import { formatNumber, formatPercent } from "@/lib/format";

/**
 * Synergy — a public page, reached from the landing page rather than from
 * inside anyone's portal.
 *
 * It is the group's shared record of what the Shared Service Centre delivers
 * and what those services have returned. Because anyone with the link can
 * read it, it carries no money at all: no fees, budgets, savings, rate cards
 * or volumes. The data layer does not hand this page a currency field.
 */
export default function SynergyPage() {
  const view = useMemo(() => getSynergyView(DEFAULT_PERIOD_ID), []);

  if (!view) {
    return <p className="py-20 text-center text-[13px] text-ink-3">Building the group view…</p>;
  }

  const t = view.totals;

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Public header — this page sits outside the signed-in portal. */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex min-h-[68px] max-w-[1240px] flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/" title="GMR Shared Service Centre">
            <PortalMark tone="dark" name="SSC" sub="Shared Service Centre" />
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/"
              className="flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Home
            </Link>
            <Link href="/login" className="btn-cta px-4 py-2.5 text-[13px] hover:-translate-y-px">
              Customer login
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pt-8 pb-16">
        <header className="mb-7 max-w-[760px]">
          <p className="eyebrow mb-2">Shared services across GMR</p>
          <h1
            className="text-[38px] leading-[1.1] font-bold tracking-[-0.035em]"
            style={{ color: "var(--color-navy)" }}
          >
            Synergy
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            What every GMR company takes from the Shared Service Centre, and what those services
            have returned. One shared record for the whole group, so any company can see what is
            already working elsewhere before deciding what to take next.
          </p>
          <p className="mt-2 text-[12.5px] text-ink-4">
            {view.periodLabel} · data as at {view.asOf}
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Companies served"
            value={t.companies}
            caption={`${t.liveSubscriptions} live service subscriptions between them`}
            emphasis
          />
          <StatTile
            label="Effort released"
            value={`${formatNumber(t.hoursSavedYtd)} hrs`}
            caption="by automation, across the group, year to date"
            status="good"
            emphasis
          />
          <StatTile
            label="Transactions automated"
            value={formatNumber(t.transactionsAutomated)}
            caption={`${formatNumber(t.issuesResolved)} issues resolved this period`}
            emphasis
          />
          <StatTile
            label="Group service level"
            value={formatPercent(t.sla)}
            caption={`${t.csat.toFixed(1)} / 5 average satisfaction`}
            emphasis
          />
        </div>

        {/* ---------------------------------------------------------- */}
        {/* The catalogue, group-wide                                   */}
        {/* ---------------------------------------------------------- */}

        <section className="mt-10">
          <SectionHeading
            title="Every offering, across the group"
            subtitle="Who runs each service today, and what they achieve on it."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {view.offerings.map((o) => (
              <Card key={o.service.id} className="flex flex-col">
                <header className="flex items-start gap-3">
                  <ServiceGlyph serviceId={o.service.id} code={o.service.code} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className="text-[16px] font-bold tracking-[-0.015em]"
                        style={{ color: "var(--color-navy)" }}
                      >
                        {o.service.name}
                      </h3>
                      {o.users.length === 0 && <Badge tone="warn">Being built out</Badge>}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                      {o.service.tagline}
                    </p>
                  </div>
                </header>

                <p className="mt-3.5 text-[13px] leading-relaxed text-ink-2">
                  {o.service.description}
                </p>

                <div className="mt-4 rounded-lg border border-line bg-surface-sunken p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[11.5px] font-semibold text-ink-2">Contracted by</p>
                    <p className="tnum text-[12px] font-bold" style={{ color: "var(--color-navy)" }}>
                      {o.takenBy} of {o.total} GMR companies
                    </p>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={o.takenBy}
                      max={o.total}
                      color={serviceColor(o.service.id)}
                      height={5}
                      label={`${o.takenBy} of ${o.total} companies contract this service`}
                    />
                  </div>

                  {o.users.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {o.users.map((u) => (
                        <span
                          key={u.shortName}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-[3px] text-[11px] font-medium text-ink-2"
                          title={`Service level ${formatPercent(u.sla)}`}
                        >
                          {u.shortName}
                          <span className="tnum text-ink-4">{formatPercent(u.sla, 0)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {o.users.length > 0 ? (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-line p-3">
                      <div>
                        <p className="eyebrow-muted">Group SLA</p>
                        <p
                          className="tnum mt-1 text-[14px] font-bold"
                          style={{ color: "var(--color-navy)" }}
                        >
                          {formatPercent(o.groupSla)}
                        </p>
                      </div>
                      <div>
                        <p className="eyebrow-muted">Satisfaction</p>
                        <p
                          className="tnum mt-1 text-[14px] font-bold"
                          style={{ color: "var(--color-navy)" }}
                        >
                          {o.groupCsat.toFixed(1)} / 5
                        </p>
                      </div>
                      <div>
                        <p className="eyebrow-muted">Hours released</p>
                        <p className="tnum mt-1 text-[14px] font-bold text-good">
                          {formatNumber(o.groupHoursSaved)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
                      Best performing today: <b className="text-ink">{o.users[0].shortName}</b> at{" "}
                      {formatPercent(o.users[0].sla)} service level.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
                    Contracted by {o.takenBy} companies and being built out now. Results will appear
                    here once it goes live.
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* How each company benefited                                  */}
        {/* ---------------------------------------------------------- */}

        <section className="mt-10">
          <SectionHeading
            title="How each company benefited"
            subtitle="Every GMR company on the SSC, ordered by the effort automation has released for them."
          />
          <Card padded={false} className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Services taken</Th>
                  <Th align="right">SLA</Th>
                  <Th>Status</Th>
                  <Th align="right">CSAT</Th>
                  <Th align="right">Issues resolved</Th>
                  <Th align="right">Hours released</Th>
                  <Th align="right">Automated</Th>
                </tr>
              </thead>
              <tbody>
                {view.companies.map((c) => (
                  <CompanyRow key={c.entityId} company={c} />
                ))}
              </tbody>
            </Table>
          </Card>
        </section>

        <Card className="mt-4">
          <CardHeader
            eyebrow="What is on this page"
            title="Service outcomes only. No commercials."
            subtitle="This page is public, so it carries no money at all — no fees, budgets, savings, rate cards, volumes or open issues. It shows which services each GMR company runs and how those services performed: service levels, satisfaction, issues resolved and effort released. Everything commercial stays inside each company's own portal, visible only to that company."
          />
          <Link
            href="/login"
            className="inline-flex text-[13px] font-semibold text-accent hover:underline"
          >
            Sign in to your company portal →
          </Link>
        </Card>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1240px] px-5 py-6 text-[11.5px] text-ink-4">
          GMR Shared Service Centre — prototype. All figures are illustrative and no production
          system is connected.
        </div>
      </footer>
    </div>
  );
}

function CompanyRow({ company: c }: { company: CompanyOutcome }) {
  return (
    <tr className="transition-colors hover:bg-surface-sunken">
      <Td>
        <span className="block font-semibold">{c.name}</span>
        <span className="block text-[11.5px] text-ink-4">
          {c.locationName} · {c.sector}
        </span>
      </Td>
      <Td>
        <span className="flex flex-wrap gap-1">
          {c.towers
            .filter((t) => t.state === "live")
            .map((t) => (
              <span
                key={t.service.id}
                className="inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-extrabold"
                style={{
                  background: `color-mix(in srgb, ${serviceColor(t.service.id)} 12%, white)`,
                  color: serviceColor(t.service.id),
                }}
              >
                {t.service.code}
              </span>
            ))}
        </span>
      </Td>
      <Td align="right" className="font-semibold">
        {formatPercent(c.slaActual)}
      </Td>
      <Td>
        <StatusPill status={c.slaStatus} size="sm" />
      </Td>
      <Td align="right">{c.csat.toFixed(1)}</Td>
      <Td align="right">{formatNumber(c.issuesResolved)}</Td>
      <Td align="right">{formatNumber(c.hoursSavedYtd)}</Td>
      <Td align="right">{formatPercent(c.automationCoverage * 100, 0)}</Td>
    </tr>
  );
}
