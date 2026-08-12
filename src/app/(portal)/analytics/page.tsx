"use client";

import { useState } from "react";
import Link from "next/link";
import { usePortalData } from "@/components/portal/usePortalData";
import { PageHeader } from "@/components/portal/blocks";
import {
  Badge,
  Card,
  CardHeader,
  DataRow,
  SectionHeading,
  SourceTag,
  StatTile,
  TrendPill,
  serviceColor,
} from "@/components/ui/primitives";
import { DonutChart, HBarList, Sparkline } from "@/components/charts";
import { ANALYTICS_CATALOGUE } from "@/lib/mock/analytics-products";
import type { AnalyticsProduct } from "@/lib/domain/types";
import { cx, formatMetric, formatMoney, formatNumber, formatPercent } from "@/lib/format";

export default function AnalyticsPage() {
  const { snapshot } = usePortalData();
  const [selected, setSelected] = useState<string | null>(null);

  if (!snapshot) return null;
  const analytics = snapshot.analytics;
  const exec = snapshot.exec;
  const color = serviceColor("analytics");

  const active = analytics?.products.find((p) => p.id === selected) ?? analytics?.products[0] ?? null;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="Analytics"
        title="Analytics & insight"
        subtitle={
          <>
            The SSC does more than process your transactions — it reads them. These are the analytics
            products running on {snapshot.entity.name}&rsquo;s finance, procurement and revenue data.
          </>
        }
        actions={
          analytics && (
            <Link
              href="/services/analytics"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Analytics service detail →
            </Link>
          )
        }
      />

      {/* ============================================================ */}
      {/* Executive analytics                                          */}
      {/* ============================================================ */}
      <section className="mb-8 scroll-mt-24" id="executive">
        <SectionHeading
          title="Executive indicators"
          subtitle="The business measures the SSC produces for your leadership team from the finance data it already processes."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {exec.map((m) => {
            const good =
              m.direction === "higher-better" ? m.value >= 0 : m.format === "percent" ? m.value <= 3 : true;
            return (
              <Card key={m.id} className="!p-4">
                <p className="eyebrow">{m.label}</p>
                <p className="metric mt-2 text-[24px] leading-7 font-semibold tracking-[-0.02em] text-ink">
                  {m.format === "percent" && m.value > 0 ? "+" : ""}
                  {formatMetric(m.value, m.format)}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  {m.deltaPct != null && (
                    <TrendPill
                      trend={m.deltaPct > 0 ? "up" : m.deltaPct < 0 ? "down" : "flat"}
                      value={m.deltaPct}
                      direction={m.direction}
                      label="YoY"
                    />
                  )}
                  {m.deltaPct == null && (
                    <span
                      className={cx(
                        "text-[11.5px] font-medium",
                        good ? "text-good" : "text-warn",
                      )}
                    >
                      {m.direction === "higher-better" ? "Higher is better" : "Lower is better"}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[11.5px] leading-relaxed text-ink-4">
                  {m.note}
                </p>
                <p className="mt-1.5">
                  <SourceTag system={m.sourceSystem} />
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {analytics ? (
        <>
          {/* ======================================================== */}
          {/* Portfolio summary                                        */}
          {/* ======================================================== */}
          <section className="mb-8">
            <SectionHeading
              title="Analytics portfolio"
              subtitle={`${analytics.liveProducts} products are live on your data, producing ${analytics.totalReports} scheduled reports and feeds.`}
            />
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile
                label="Live products"
                value={formatNumber(analytics.liveProducts)}
                emphasis
                accent={color}
              />
              <StatTile label="Scheduled reports" value={formatNumber(analytics.totalReports)} emphasis />
              <StatTile
                label="Insights generated"
                value={formatNumber(analytics.totalInsights)}
                emphasis
                caption="Year to date"
              />
              <StatTile label="Active business users" value={formatNumber(analytics.activeUsers)} emphasis />
              <StatTile
                label="Value identified"
                value={formatMoney(analytics.valueIdentified)}
                emphasis
                status="good"
                caption="Year to date"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {analytics.products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  color={color}
                  selected={active?.id === p.id}
                  onSelect={() => setSelected(p.id)}
                />
              ))}
            </div>
          </section>

          {/* ======================================================== */}
          {/* Selected product detail                                  */}
          {/* ======================================================== */}
          {active && (
            <section className="mb-8">
              <SectionHeading
                title={active.name}
                subtitle={active.description}
                action={<Badge tone="outline">{active.sourceSystem}</Badge>}
              />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <Card>
                  <CardHeader eyebrow={active.headlineLabel} title={formatMetric(active.headlineValue, active.headlineFormat)} />
                  {active.headlineDeltaPct != null && (
                    <div className="mb-4">
                      <TrendPill
                        trend={active.headlineDeltaPct > 0 ? "up" : "down"}
                        value={active.headlineDeltaPct}
                        direction={active.headlineDirection ?? "higher-better"}
                        label="year on year"
                      />
                    </div>
                  )}
                  <Sparkline
                    values={active.series}
                    width={320}
                    height={64}
                    color={color}
                    strokeWidth={2}
                  />
                  <div className="mt-5 space-y-0 border-t border-line-soft pt-3">
                    <DataRow label="Source system" value={active.sourceSystem} />
                    <DataRow label="Refresh" value={active.refresh} />
                    <DataRow label="Insights generated" value={formatNumber(active.insights)} />
                    <DataRow label="Scheduled reports" value={formatNumber(active.reports)} />
                    <DataRow label="Active users" value={formatNumber(active.users)} emphasis />
                  </div>
                </Card>

                <div className="grid gap-4">
                  {active.breakdown && active.breakdown.length > 0 && (
                    <Card>
                      <CardHeader eyebrow="Composition" title={`${active.headlineLabel} by component`} />
                      {active.headlineFormat === "currency" && active.breakdown.length <= 4 ? (
                        <DonutChart
                          segments={active.breakdown.map((b, i) => ({
                            key: b.label,
                            label: b.label,
                            value: b.value,
                            color: `color-mix(in srgb, ${color} ${100 - i * 20}%, white)`,
                          }))}
                          format={(n) => formatMoney(n)}
                          size={148}
                        />
                      ) : (
                        <HBarList
                          items={active.breakdown.map((b, i) => ({
                            key: b.label,
                            label: b.label,
                            value: b.value,
                            color: `color-mix(in srgb, ${color} ${100 - i * 13}%, white)`,
                          }))}
                          format={(n) =>
                            active.headlineFormat === "percent"
                              ? formatPercent(n)
                              : formatMoney(n)
                          }
                          showShare={active.headlineFormat !== "percent"}
                        />
                      )}
                    </Card>
                  )}

                  <Card>
                    <CardHeader eyebrow="What this product found" title="Recent insights" />
                    <ul className="space-y-2.5">
                      {active.highlights.map((h) => (
                        <li key={h} className="flex gap-2.5">
                          <span
                            aria-hidden
                            className="mt-[7px] size-1.5 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span className="text-[13px] leading-relaxed text-ink-2">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="mb-8">
          <Card>
            <CardHeader
              eyebrow="Not yet contracted"
              title="Analytics is available for this entity"
              subtitle="The SSC already processes the transactions these products read from. Standing them up does not require new source systems."
            />
            <p className="text-[13px] leading-relaxed text-ink-2">
              At comparable entities the analytics portfolio has identified spend leakage, unbilled
              revenue and ageing exposure worth several times its subscription. Your relationship
              manager, {snapshot.entity.relationshipManager}, can scope which products would apply.
            </p>
          </Card>
        </section>
      )}

      {/* ============================================================ */}
      {/* Catalogue                                                    */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Available to add"
          subtitle="Further analytics the SSC can build on the data it already processes for you. Indicative delivery effort shown."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ANALYTICS_CATALOGUE.map((c) => (
            <Card key={c.name} className="!p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-[13.5px] leading-snug font-semibold text-ink">{c.name}</p>
                <Badge tone="outline">{c.effort}</Badge>
              </div>
              <p className="text-[11.5px] text-ink-4">{c.category}</p>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-3">{c.description}</p>
              <p className="mt-3 border-t border-line-soft pt-2.5">
                <SourceTag system={c.sourceSystem} />
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProductCard({
  product,
  color,
  selected,
  onSelect,
}: {
  product: AnalyticsProduct;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "card flex flex-col p-4 text-left transition-shadow hover:shadow-raised",
        selected && "!border-accent-line ring-1 ring-accent-line",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[13.5px] leading-snug font-semibold text-ink">{product.name}</p>
        <Badge tone="good">Live</Badge>
      </div>
      <p className="text-[11.5px] text-ink-4">{product.category}</p>

      <p className="eyebrow mt-3.5">{product.headlineLabel}</p>
      <p className="metric mt-1 text-[19px] leading-6 font-semibold tracking-[-0.02em] text-ink">
        {product.headlineFormat === "percent" && product.headlineValue > 0 ? "+" : ""}
        {formatMetric(product.headlineValue, product.headlineFormat)}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        {product.headlineDeltaPct != null ? (
          <TrendPill
            trend={product.headlineDeltaPct > 0 ? "up" : "down"}
            value={product.headlineDeltaPct}
            direction={product.headlineDirection ?? "higher-better"}
          />
        ) : (
          <span />
        )}
        <Sparkline values={product.series} width={72} height={20} color={color} area={false} />
      </div>

      <p className="mt-3 border-t border-line-soft pt-2.5 text-[11.5px] text-ink-4">
        {product.insights} insights · {product.reports} reports · {product.users} users
      </p>
    </button>
  );
}
