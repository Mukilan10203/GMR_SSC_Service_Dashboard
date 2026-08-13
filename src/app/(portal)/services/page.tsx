"use client";

import Link from "next/link";
import { usePortalData } from "@/components/portal/usePortalData";
import { LockedServiceCard, PageHeader, ServiceCard } from "@/components/portal/blocks";
import { lockedServicesFor } from "@/lib/mock/organisation";
import {
  Badge,
  Card,
  CardHeader,
  SectionHeading,
  StatusPill,
  Table,
  Td,
  Th,
  TrendPill,
  serviceColor,
} from "@/components/ui/primitives";
import { HBarList } from "@/components/charts";
import { DATA_SOURCE_MAP } from "@/lib/api";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

export default function ServicesPage() {
  const { snapshot } = usePortalData();
  if (!snapshot) return null;

  const { services, entity, billing, cx: exp } = snapshot;
  const locked = lockedServicesFor(entity);

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="My SSC services"
        title="Services provided to your organisation"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((s) => (
          <ServiceCard key={s.service.id} service={s} />
        ))}
        {locked.map((s) => (
          <LockedServiceCard key={s.id} service={s} />
        ))}
      </div>

      {/* ============================================================ */}
      {/* Comparison                                                   */}
      {/* ============================================================ */}
      <section className="mb-8">
        <SectionHeading
          title="Compare services side by side" />
        <Card padded={false}>
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <Th>Service</Th>
                  <Th align="right">This month</Th>
                  <Th align="right">Year to date</Th>
                  <Th align="right">Full year</Th>
                  <Th align="right">Share</Th>
                  <Th align="right">MoM</Th>
                  <Th align="right">vs budget</Th>
                  <Th align="center">SLA</Th>
                  <Th align="right">Capacity used</Th>
                  <Th align="right">Open items</Th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.service.id} className="transition-colors hover:bg-surface-sunken">
                    <Td>
                      <Link href={`/services/${s.service.id}`} className="flex items-center gap-2.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: serviceColor(s.service.id) }}
                        />
                        <span>
                          <span className="block font-medium text-ink">{s.service.code}</span>
                          <span className="block text-[11.5px] text-ink-4">{s.service.name}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td align="right">{formatMoney(s.billing.currentTotal)}</Td>
                    <Td align="right">{formatMoney(s.billing.ytd)}</Td>
                    <Td align="right" className="font-medium">
                      {formatMoney(s.billing.fyForecast)}
                    </Td>
                    <Td align="right" muted>
                      {(s.billing.mix * 100).toFixed(1)}%
                    </Td>
                    <Td align="right">
                      <TrendPill
                        trend={s.billing.momPct > 0.75 ? "up" : s.billing.momPct < -0.75 ? "down" : "flat"}
                        value={s.billing.momPct}
                        direction="lower-better"
                      />
                    </Td>
                    <Td align="right" muted>
                      {s.billing.ytdVariancePct >= 0 ? "+" : "−"}
                      {Math.abs(s.billing.ytdVariancePct).toFixed(1)}%
                    </Td>
                    <Td align="center">
                      <StatusPill status={s.sla.status} size="sm">
                        {s.sla.overall.toFixed(1)}%
                      </StatusPill>
                    </Td>
                    <Td align="right" muted>
                      {(s.utilisation * 100).toFixed(0)}%
                    </Td>
                    <Td align="right">{s.issueIds.length}</Td>
                  </tr>
                ))}
                {locked.map((s) => (
                  <tr key={s.id} className="opacity-50">
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <span className="size-2.5 shrink-0 rounded-full bg-line-strong" />
                        <span>
                          <span className="block font-medium text-ink-3">{s.code}</span>
                          <span className="block text-[11.5px] text-ink-4">{s.name}</span>
                        </span>
                      </span>
                    </Td>
                    <Td align="right" colSpan={9} muted>
                      Locked — not yet available in this preview
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td className="font-semibold">All services</Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(billing.currentTotal)}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(billing.ytd)}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(billing.fyForecast)}
                  </Td>
                  <Td align="right" muted>
                    100%
                  </Td>
                  <Td align="right">
                    <TrendPill
                      trend={billing.momPct > 0.75 ? "up" : billing.momPct < -0.75 ? "down" : "flat"}
                      value={billing.momPct}
                      direction="lower-better"
                    />
                  </Td>
                  <Td align="right" muted>
                    {billing.ytdVariancePct >= 0 ? "+" : "−"}
                    {Math.abs(billing.ytdVariancePct).toFixed(1)}%
                  </Td>
                  <Td align="center">
                    <StatusPill status={snapshot.sla.status} size="sm">
                      {formatPercent(snapshot.sla.overall)}
                    </StatusPill>
                  </Td>
                  <Td />
                  <Td align="right" className="font-semibold">
                    {snapshot.counts.openIssues}
                  </Td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Consumption + satisfaction                                   */}
      {/* ============================================================ */}
      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Consumption"
            title="Where your service spend goes"
          />
          <HBarList
            items={services.map((s) => ({
              key: s.service.id,
              label: s.service.name,
              sublabel: `${formatNumber(
                s.activityChart.series.filter((x) => x.isActual).reduce((a, b) => a + b.value, 0),
              )} ${s.activityChart.unit} YTD`,
              value: s.billing.fyForecast,
              color: serviceColor(s.service.id),
            }))}
            format={(n) => formatMoney(n)}
            showShare
          />
        </Card>

        <Card>
          <CardHeader
            eyebrow="Experience"
            title="Satisfaction by service"
          />
          <HBarList
            items={exp.csatByService.map((c) => ({
              key: c.serviceId,
              label: services.find((s) => s.service.id === c.serviceId)?.service.name ?? c.serviceId,
              sublabel: `${c.responses} responses`,
              value: c.score,
              color: serviceColor(c.serviceId),
            }))}
            format={(n) => `${n.toFixed(1)} / 5`}
          />
          <p className="mt-4 border-t border-line-soft pt-3 text-[11.5px] leading-relaxed text-ink-4">
            Scores are collected from the business users who consume each service, and weighted into
            the overall {exp.csat.toFixed(1)} / 5 by each service&rsquo;s share of spend.
          </p>
        </Card>
      </section>

    </div>
  );
}
