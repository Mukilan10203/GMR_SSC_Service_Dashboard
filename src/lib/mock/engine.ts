import type {
  ActivityMetric,
  AnalyticsProduct,
  AnalyticsSnapshot,
  AttentionItem,
  AutomationSnapshot,
  Bot,
  BillingDriver,
  CustomerExperience,
  Entity,
  EntityBilling,
  EntitySnapshot,
  ExecMetric,
  Feedback,
  FteChargeLine,
  Issue,
  Kpi,
  MonthBilling,
  NpsQuarter,
  Period,
  ServiceBilling,
  ServiceId,
  ServiceSla,
  ServiceSnapshot,
  SlaComponent,
  Status,
  Trend,
  TxnChargeLine,
} from "../domain/types";
import { gradeAgainstTarget, pctChange, trendFrom } from "../format";
import { DEMO_AS_OF, getPeriod, getPeriodDefinition, QUARTERS } from "./calendar";
import { ENTITIES, LOCATIONS, SERVICE_MAP, SERVICES } from "./organisation";
import {
  BLUEPRINTS,
  CSAT_BASELINE,
  SLA_COMPONENTS,
  SLA_OVERRIDES,
  type FteLineSpec,
  type TxnLineSpec,
} from "./rate-cards";
import { KPI_SPECS, type KpiSpec } from "./kpis";
import {
  FEEDBACK_TEMPLATES,
  ISSUE_TEMPLATES,
  RESOLVED_ISSUE_TEMPLATES,
  type IssueTemplate,
} from "./issues";
import { AUTOMATION_PIPELINE, BOT_FLEET } from "./automation-fleet";
import {
  ANALYTICS_PRODUCTS,
  FINANCIAL_BASELINE,
  type FinancialContext,
} from "./analytics-products";

/* ------------------------------------------------------------------ */
/* Small deterministic helpers                                         */
/* ------------------------------------------------------------------ */

/** FNV-1a — stable across runs and platforms, unlike Math.random(). */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic value in [-1, 1] for a given key. */
function jitter(key: string): number {
  return (hash(key) % 2000) / 1000 - 1;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure UTC date arithmetic — no locale or timezone drift between SSR and CSR. */
function subtractDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) - days * 86_400_000;
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

function movingAverage(xs: number[], window = 3): number[] {
  const half = Math.floor(window / 2);
  return xs.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(xs.length - 1, i + half);
    return sum(xs.slice(lo, hi + 1)) / (hi - lo + 1);
  });
}

/** Distribute a total across weights, forcing the parts to sum to the total. */
function distribute(total: number, weights: number[]): number[] {
  const w = sum(weights);
  if (w === 0) return weights.map(() => 0);
  const raw = weights.map((x) => (total * x) / w);
  const out = raw.map((x) => Math.floor(x));
  let remainder = total - sum(out);
  // Hand the remainder to the largest fractional parts first.
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && remainder > 0; k++) {
    out[order[k].i] += 1;
    remainder -= 1;
  }
  return out;
}

function asOfIso(period: Period): string {
  if (period.isCurrent) return DEMO_AS_OF;
  const def = getPeriodDefinition(period.id);
  return `${def.startYear + 1}-03-31`;
}

/* ------------------------------------------------------------------ */
/* Volumes                                                             */
/* ------------------------------------------------------------------ */

interface ServiceVolumes {
  /** Monthly volume per transaction line, 12 entries. */
  txn: Record<string, number[]>;
  /** Monthly FTE count per FTE line, 12 entries. */
  fte: Record<string, number[]>;
  currentIndex: number;
  prevIndex: number;
  actualCount: number;
}

function buildVolumes(entity: Entity, serviceId: ServiceId, period: Period): ServiceVolumes {
  const bp = BLUEPRINTS[serviceId];
  const def = getPeriodDefinition(period.id);
  const factor = def.volumeFactor;
  const currentIndex = def.actualMonthCount - 1;

  const txn: Record<string, number[]> = {};
  for (const line of bp.txn) {
    txn[line.id] = bp.seasonality.map((s) => {
      if (line.fixed) return line.baseVolume;
      const v = line.baseVolume * entity.scale * s * factor;
      return Math.max(1, Math.round(v));
    });
  }

  const fte: Record<string, number[]> = {};
  for (const line of bp.fte) {
    fte[line.id] = bp.fteRamp.map((r) =>
      Math.max(1, Math.round(line.baseFte * entity.scale * r * factor)),
    );
  }

  return {
    txn,
    fte,
    currentIndex,
    prevIndex: Math.max(0, currentIndex - 1),
    actualCount: def.actualMonthCount,
  };
}

/** Point-in-time stock metric for an entity (open positions, exceptions…). */
function stockValue(serviceId: ServiceId, id: string, entity: Entity, period: Period): number {
  const spec = BLUEPRINTS[serviceId].stocks.find((s) => s.id === id);
  if (!spec) return 0;
  const factor = getPeriodDefinition(period.id).volumeFactor;
  return Math.max(1, Math.round(spec.base * entity.scale * factor));
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

function buildServiceBilling(
  entity: Entity,
  serviceId: ServiceId,
  period: Period,
  vols: ServiceVolumes,
): ServiceBilling {
  const bp = BLUEPRINTS[serviceId];
  const cur = vols.currentIndex;
  const prev = vols.prevIndex;

  const lineAmount = (line: TxnLineSpec, m: number) => vols.txn[line.id][m] * line.rate;
  const fteAmount = (line: FteLineSpec, m: number) => vols.fte[line.id][m] * line.ratePerFte;

  const monthlyTxn = period.months.map((_, m) => sum(bp.txn.map((l) => lineAmount(l, m))));
  const monthlyFte = period.months.map((_, m) => sum(bp.fte.map((l) => fteAmount(l, m))));
  const monthlyTotal = monthlyTxn.map((t, i) => t + monthlyFte[i]);

  const fyForecast = sum(monthlyTotal);
  const fyBudget = fyForecast / (1 + bp.budgetVariancePct / 100);
  const planShare = (() => {
    const smoothed = movingAverage(monthlyTotal, 3);
    const s = sum(smoothed);
    return smoothed.map((v) => v / s);
  })();

  const monthly: MonthBilling[] = period.months.map((mo, m) => ({
    monthKey: mo.key,
    short: mo.short,
    isActual: mo.isActual,
    txn: monthlyTxn[m],
    fte: monthlyFte[m],
    total: monthlyTotal[m],
    budget: fyBudget * planShare[m],
  }));

  const actual = monthly.filter((m) => m.isActual);
  const ytd = sum(actual.map((m) => m.total));
  const ytdBudget = sum(actual.map((m) => m.budget));

  const txnLines: TxnChargeLine[] = bp.txn.map((l) => ({
    id: l.id,
    label: l.label,
    unit: vols.txn[l.id][cur] === 1 ? l.unit : l.unitPlural,
    unitSingular: l.unit,
    volume: vols.txn[l.id][cur],
    rate: l.rate,
    amount: lineAmount(l, cur),
    sourceSystem: l.sourceSystem,
  }));

  const fteLines: FteChargeLine[] = bp.fte.map((l) => ({
    id: l.id,
    role: l.role,
    fte: vols.fte[l.id][cur],
    ratePerFte: l.ratePerFte,
    amount: fteAmount(l, cur),
  }));

  /* Attribute the month-on-month move line by line. */
  const drivers: BillingDriver[] = [
    ...bp.txn.map((l) => ({
      label: l.label,
      kind: "volume" as const,
      deltaAmount: lineAmount(l, cur) - lineAmount(l, prev),
      deltaPct: pctChange(vols.txn[l.id][cur], vols.txn[l.id][prev]),
      fromVolume: vols.txn[l.id][prev],
      toVolume: vols.txn[l.id][cur],
    })),
    ...bp.fte.map((l) => ({
      label: `${l.role} (FTE)`,
      kind: "fte" as const,
      deltaAmount: fteAmount(l, cur) - fteAmount(l, prev),
      deltaPct: pctChange(vols.fte[l.id][cur], vols.fte[l.id][prev]),
      fromVolume: vols.fte[l.id][prev],
      toVolume: vols.fte[l.id][cur],
    })),
  ]
    .filter((d) => Math.abs(d.deltaAmount) > 0)
    .sort((a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount));

  const currentTotal = monthlyTotal[cur];
  const prevMonthTotal = monthlyTotal[prev];
  const momPct = pctChange(currentTotal, prevMonthTotal);

  const top = drivers[0];
  const direction = momPct >= 0 ? "increased" : "decreased";
  const narrative = top
    ? `Billing ${direction} ${Math.abs(momPct).toFixed(1)}% month on month. The largest single driver is ${
        top.label.toLowerCase()
      }, where volume moved ${top.deltaPct >= 0 ? "up" : "down"} ${Math.abs(top.deltaPct).toFixed(
        1,
      )}% from ${(top.fromVolume ?? 0).toLocaleString("en-IN")} to ${(top.toVolume ?? 0).toLocaleString(
        "en-IN",
      )}.`
    : `Billing is flat month on month at the contracted rate card.`;

  return {
    serviceId,
    currentMonthKey: period.months[cur].key,
    currentMonthLabel: period.months[cur].label,
    txnLines,
    fteLines,
    txnTotal: monthlyTxn[cur],
    fteTotal: monthlyFte[cur],
    currentTotal,
    prevMonthTotal,
    momPct,
    monthly,
    ytd,
    ytdBudget,
    ytdVariancePct: pctChange(ytd, ytdBudget),
    fyForecast,
    fyBudget,
    fyVariancePct: pctChange(fyForecast, fyBudget),
    drivers: drivers.slice(0, 5),
    mix: 0, // filled once every service is priced
    narrative,
  };
}

function buildEntityBilling(
  entity: Entity,
  period: Period,
  billings: ServiceBilling[],
  priorFyTotal: number,
): EntityBilling {
  const months = period.months;
  const monthly: MonthBilling[] = months.map((mo, m) => {
    const txn = sum(billings.map((b) => b.monthly[m].txn));
    const fte = sum(billings.map((b) => b.monthly[m].fte));
    return {
      monthKey: mo.key,
      short: mo.short,
      isActual: mo.isActual,
      txn,
      fte,
      total: txn + fte,
      budget: sum(billings.map((b) => b.monthly[m].budget)),
    };
  });

  const def = getPeriodDefinition(period.id);
  const cur = def.actualMonthCount - 1;
  const prev = Math.max(0, cur - 1);

  const actual = monthly.filter((m) => m.isActual);
  const ytd = sum(actual.map((m) => m.total));
  const ytdBudget = sum(actual.map((m) => m.budget));
  const fyForecast = sum(monthly.map((m) => m.total));
  const fyBudget = sum(monthly.map((m) => m.budget));

  const momPct = pctChange(monthly[cur].total, monthly[prev].total);

  // Outstanding sits at ~5.3% of billing raised to date.
  const outstandingRate = 0.053 + jitter(`out-${entity.id}`) * 0.012;
  const outstanding = ytd * outstandingRate;
  const outstandingAgeing = [
    { bucket: "Current", amount: outstanding * 0.62 },
    { bucket: "31–60 days", amount: outstanding * 0.23 },
    { bucket: "61–90 days", amount: outstanding * 0.09 },
    { bucket: "Over 90 days", amount: outstanding * 0.06 },
  ];

  const byService = billings.map((b) => ({
    serviceId: b.serviceId,
    ytd: b.ytd,
    fyForecast: b.fyForecast,
    mix: b.fyForecast / fyForecast,
    momPct: b.momPct,
  }));

  const biggestMover = [...billings].sort(
    (a, b) => Math.abs(b.currentTotal - b.prevMonthTotal) - Math.abs(a.currentTotal - a.prevMonthTotal),
  )[0];
  const largest = [...byService].sort((a, b) => b.fyForecast - a.fyForecast)[0];

  const narrative = biggestMover
    ? `Total billing ${momPct >= 0 ? "rose" : "fell"} ${Math.abs(momPct).toFixed(
        1,
      )}% month on month. ${SERVICE_MAP[biggestMover.serviceId].name} accounts for the largest share of the movement, and ${
        SERVICE_MAP[largest.serviceId].name
      } remains the largest service at ${(largest.mix * 100).toFixed(0)}% of full-year spend.`
    : `Billing is stable across all services.`;

  const quarters = QUARTERS.map((q) => ({
    key: q.key,
    label: `${q.label} ${period.short}`,
    total: sum(q.months.map((m) => monthly[m].total)),
    isActual: q.months.every((m) => monthly[m].isActual),
  }));

  return {
    monthly,
    currentMonthKey: months[cur].key,
    currentMonthLabel: months[cur].label,
    currentTotal: monthly[cur].total,
    prevMonthTotal: monthly[prev].total,
    momPct,
    ytd,
    ytdBudget,
    ytdVariancePct: pctChange(ytd, ytdBudget),
    fyForecast,
    fyBudget,
    fyVariancePct: pctChange(fyForecast, fyBudget),
    priorFyTotal,
    yoyPct: pctChange(fyForecast, priorFyTotal),
    outstanding,
    outstandingAgeing,
    byService,
    modelSplit: {
      txn: sum(monthly.map((m) => m.txn)),
      fte: sum(monthly.map((m) => m.fte)),
    },
    narrative,
    quarters,
  };
}

/* ------------------------------------------------------------------ */
/* SLA                                                                 */
/* ------------------------------------------------------------------ */

function buildSla(
  entity: Entity,
  serviceId: ServiceId,
  period: Period,
  overrides: Record<string, number>,
): ServiceSla {
  const target = SERVICE_MAP[serviceId].slaTarget;
  const components: SlaComponent[] = SLA_COMPONENTS[serviceId].map((c) => {
    const pinned = SLA_OVERRIDES[entity.id]?.[serviceId]?.[c.id];
    const computed = overrides[c.id];
    const actual =
      computed ?? pinned ?? clamp(round2(c.actual + entity.opsDelta), 30, 100);
    return {
      id: c.id,
      label: c.label,
      weight: c.weight,
      actual,
      target: c.target,
      status: gradeAgainstTarget(actual, c.target, "higher-better", 0.03),
    };
  });

  const overall = round2(sum(components.map((c) => c.actual * c.weight)));

  const def = getPeriodDefinition(period.id);
  const monthly = period.months.map((mo, m) => {
    // Gentle recovery trend plus stable per-month noise.
    const trendPart = (m - (def.actualMonthCount - 1)) * 0.12;
    const noise = jitter(`sla-${entity.id}-${serviceId}-${m}`) * 1.1;
    return {
      monthKey: mo.key,
      short: mo.short,
      value: clamp(round2(overall + trendPart + noise), 30, 100),
      isActual: mo.isActual,
    };
  });
  // Anchor the reporting month to the exact roll-up.
  monthly[def.actualMonthCount - 1].value = overall;

  const prev = monthly[Math.max(0, def.actualMonthCount - 2)].value;
  return {
    serviceId,
    overall,
    target,
    status: gradeAgainstTarget(overall, target, "higher-better", 0.03),
    trend: trendFrom(overall, prev, 0.3),
    deltaPts: round2(overall - prev),
    components,
    monthly,
  };
}

/* ------------------------------------------------------------------ */
/* Derived quality metrics                                             */
/* ------------------------------------------------------------------ */

type MetricContext = Record<string, number>;

function buildMetricContext(
  entity: Entity,
  serviceId: ServiceId,
  period: Period,
  vols: ServiceVolumes,
  sla: ServiceSla,
  extra: MetricContext,
): MetricContext {
  const q = BLUEPRINTS[serviceId].quality;
  const d = entity.opsDelta; // negative = weaker delivery
  const cur = vols.currentIndex;
  const comp = (id: string) => sla.components.find((c) => c.id === id)?.actual;

  const ctx: MetricContext = { sla: sla.overall, ...extra };

  switch (serviceId) {
    case "fna": {
      ctx.avgProcessingDays = round2(q.avgProcessingDays - d * 0.18);
      ctx.rejectionRate = round2(clamp(q.rejectionRate - d * 0.32, 0.5, 20));
      ctx.exceptionRate = round2(clamp(q.exceptionRate - d * 0.22, 0.3, 15));
      ctx.firstTimeRight = round2(clamp(q.firstTimeRight + d * 0.55, 60, 100));
      ctx.touchlessRate = round2(clamp(q.touchlessRate + d * 1.2, 20, 100));
      ctx.daysPayableOutstanding = round2(q.daysPayableOutstanding - d * 0.6);
      ctx.lateInvoiceShare = clamp((ctx.avgProcessingDays / 5) * 0.11, 0.02, 0.45);
      ctx.reworkShare = (100 - ctx.firstTimeRight) / 100;
      ctx.rejectionShare = ctx.rejectionRate / 100;
      ctx.exceptionShare = ctx.exceptionRate / 100;
      break;
    }
    case "hr": {
      ctx.timeToHireDays = round2(q.timeToHireDays - d * 1.6);
      ctx.talentAcquisitionSla = comp("hr-sla-ta") ?? round2(clamp(q.talentAcquisitionSla + d * 3.5, 20, 100));
      ctx.payrollAccuracy = round2(clamp(q.payrollAccuracy + d * 0.28, 90, 100));
      ctx.candidateExperience = round2(clamp(q.candidateExperience + d * 0.12, 1, 5));
      ctx.attritionRate = round2(clamp(q.attritionRate - d * 0.5, 2, 40));
      ctx.helpdeskFirstResponseHrs = round2(q.helpdeskFirstResponseHrs - d * 0.3);
      ctx.taBreachShare = (100 - ctx.talentAcquisitionSla) / 100;
      ctx.lateHireShare = clamp((ctx.timeToHireDays / 45) * 0.24, 0.05, 0.7);
      ctx.payrollErrorShare = (100 - ctx.payrollAccuracy) / 100;
      break;
    }
    case "tax": {
      ctx.filingOnTimeRate = comp("tax-sla-filing") ?? round2(clamp(q.filingOnTimeRate + d * 0.3, 80, 100));
      ctx.avgTurnaroundDays = round2(q.avgTurnaroundDays - d * 0.22);
      ctx.noticeResponseDays = round2(q.noticeResponseDays - d * 0.5);
      ctx.inputCreditMatchRate = round2(clamp(q.inputCreditMatchRate + d * 0.6, 80, 100));
      ctx.exceptionRate = round2(clamp(q.exceptionRate - d * 0.18, 0.2, 12));
      ctx.lateFilingShare = (100 - ctx.filingOnTimeRate) / 100;
      ctx.lateNoticeShare = clamp((ctx.noticeResponseDays / 5) * 0.18, 0.02, 0.6);
      ctx.lateQueryShare = clamp((ctx.avgTurnaroundDays / 4) * 0.15, 0.02, 0.6);
      break;
    }
    case "automation": {
      // successRate / botJobs / roi arrive from the fleet computation.
      ctx.botAvailability = comp("auto-sla-avail") ?? round2(clamp(q.botAvailability + d * 0.15, 80, 100));
      ctx.automationCoverage = round2(clamp(q.automationCoverage + d * 2.5, 15, 95));
      ctx.jobFailureShare = (100 - (ctx.successRate ?? q.successRate)) / 100;
      break;
    }
    case "analytics": {
      ctx.onTimeDelivery = comp("an-sla-delivery") ?? round2(clamp(q.onTimeDelivery + d * 0.5, 70, 100));
      ctx.dataFreshness = comp("an-sla-fresh") ?? round2(clamp(q.dataFreshness + d * 0.7, 70, 100));
      ctx.insightTatDays = round2(q.insightTatDays - d * 0.25);
      ctx.adoptionRate = round2(clamp(q.adoptionRate + d * 2, 20, 100));
      ctx.lateReportShare = (100 - ctx.onTimeDelivery) / 100;
      break;
    }
  }

  // Expose current-month driver volumes and stocks so KPI gap narratives can
  // size themselves against real activity rather than a made-up denominator.
  for (const [id, series] of Object.entries(vols.txn)) ctx[id] = series[cur];
  for (const stock of BLUEPRINTS[serviceId].stocks) {
    ctx[stock.id] = stockValue(serviceId, stock.id, entity, period);
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/* KPIs                                                                */
/* ------------------------------------------------------------------ */

function buildKpis(
  entity: Entity,
  serviceId: ServiceId,
  period: Period,
  ctx: MetricContext,
  issues: Issue[],
  feedback: Feedback[],
): Kpi[] {
  const def = getPeriodDefinition(period.id);
  const cur = def.actualMonthCount - 1;

  return KPI_SPECS.filter((s) => s.serviceId === serviceId).map((spec) => {
    const actual = round2(ctx[spec.metricKey] ?? 0);
    const status = gradeAgainstTarget(actual, spec.target, spec.direction, spec.amberBandPct / 100);

    const series = period.months.map((mo, m) => {
      const drift = (m - cur) * (spec.direction === "higher-better" ? 0.35 : -0.02) * (actual * 0.012);
      const noise = jitter(`kpi-${entity.id}-${spec.id}-${m}`) * actual * spec.volatility;
      let v = actual + drift + noise;
      if (spec.unit === "percent") v = clamp(v, 0, 100);
      if (spec.unit === "score") v = clamp(v, 1, 5);
      if (spec.unit === "days" || spec.unit === "ratio") v = Math.max(0.1, v);
      return { monthKey: mo.key, short: mo.short, value: round2(v), isActual: mo.isActual };
    });
    series[cur].value = actual;

    const prev = series[Math.max(0, cur - 1)].value;
    const trend = trendFrom(actual, prev, 0.8);

    const affected = (() => {
      if (!spec.volumeKey || !spec.affectedShareKey) return undefined;
      const total = ctx[spec.volumeKey];
      const share = ctx[spec.affectedShareKey];
      if (total == null || share == null) return undefined;
      return {
        count: Math.max(0, Math.round(total * share)),
        ofTotal: Math.round(total),
        unit: spec.unitNoun ?? "items",
      };
    })();

    const gap =
      spec.direction === "higher-better"
        ? Math.max(0, spec.target - actual)
        : Math.max(0, actual - spec.target);

    const gapNarrative = spec.gapTemplate
      .replace("{count}", (affected?.count ?? 0).toLocaleString("en-IN"))
      .replace("{total}", (affected?.ofTotal ?? 0).toLocaleString("en-IN"))
      .replace("{target}", String(spec.target))
      .replace("{gap}", gap.toFixed(1))
      .replace("{value}", actual.toFixed(2));

    return {
      id: spec.id,
      serviceId,
      name: spec.name,
      description: spec.description,
      actual,
      target: spec.target,
      direction: spec.direction,
      unit: spec.unit,
      status,
      trend,
      deltaPct: round2(pctChange(actual, prev)),
      series,
      gapNarrative,
      affectedVolume: affected,
      relatedIssueIds: issues.filter((i) => i.linkedKpiId === spec.id).map((i) => i.id),
      relatedFeedbackIds: feedback.filter((f) => f.linkedKpiId === spec.id).map((f) => f.id),
      sourceSystem: spec.sourceSystem,
    } satisfies Kpi;
  });
}

/* ------------------------------------------------------------------ */
/* Issues & feedback                                                   */
/* ------------------------------------------------------------------ */

function selectByQuota<T extends { serviceId: ServiceId; rank: number; onlyEntities?: string[] }>(
  pool: T[],
  entity: Entity,
  services: ServiceId[],
  mix: Record<string, number>,
  targetCount: number,
): T[] {
  const inScope = pool.filter((t) => services.includes(t.serviceId));
  const pinned = inScope.filter((t) => t.onlyEntities?.includes(entity.id));
  const generic = inScope.filter((t) => !t.onlyEntities);

  const remaining = Math.max(0, targetCount - pinned.length);
  const quotas = distribute(
    remaining,
    services.map((s) => Math.max(0.05, mix[s] ?? 0)),
  );

  const picked: T[] = [...pinned];
  services.forEach((s, i) => {
    const forService = generic
      .filter((t) => t.serviceId === s)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, quotas[i]);
    picked.push(...forService);
  });

  // Top up from whatever is left if a service ran out of templates.
  if (picked.length < targetCount) {
    const used = new Set(picked);
    const spare = generic
      .filter((t) => !used.has(t))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, targetCount - picked.length);
    picked.push(...spare);
  }

  return picked;
}

function buildIssues(
  entity: Entity,
  period: Period,
  services: ServiceId[],
  mix: Record<string, number>,
): Issue[] {
  const asOf = asOfIso(period);
  const target = clamp(
    Math.round(12 * (0.45 + 0.55 * entity.scale) * (1 - entity.opsDelta * 0.12)),
    4,
    18,
  );

  const chosen = selectByQuota<IssueTemplate>(ISSUE_TEMPLATES, entity, services, mix, target);

  const open: Issue[] = chosen.map((t, i) => {
    const drift = Math.round(jitter(`age-${entity.id}-${t.key}`) * 2);
    const agingDays = Math.max(1, t.agingDays + drift);
    const openedOn = subtractDays(asOf, agingDays);
    return {
      id: `${entity.id}-${t.key}`,
      ref: `SSC-${period.short}-${String(4100 + i * 7 + (hash(entity.id) % 40)).padStart(4, "0")}`,
      title: t.title,
      description: t.description,
      serviceId: t.serviceId,
      entityId: entity.id,
      priority: t.priority,
      status: t.status,
      category: t.category,
      openedOn,
      agingDays,
      slaTargetDays: t.slaTargetDays,
      owner: t.owner,
      ownerTeam: t.ownerTeam,
      linkedKpiId: t.linkedKpiId,
      impact: t.impact,
      timeline: t.timeline.map((u) => ({
        on: subtractDays(asOf, Math.max(0, agingDays - u.dayOffset)),
        note: u.note,
        by: u.by,
      })),
    };
  });

  const resolved: Issue[] = RESOLVED_ISSUE_TEMPLATES.filter((t) => services.includes(t.serviceId)).map(
    (t, i) => {
      const openedOn = subtractDays(asOf, t.resolvedDaysAgo + t.resolutionDays);
      return {
        id: `${entity.id}-${t.key}`,
        ref: `SSC-${period.short}-${String(3600 + i * 11 + (hash(entity.id) % 30)).padStart(4, "0")}`,
        title: t.title,
        description: t.resolution,
        serviceId: t.serviceId,
        entityId: entity.id,
        priority: t.priority,
        status: "resolved" as const,
        category: t.category,
        openedOn,
        agingDays: t.resolutionDays,
        slaTargetDays: t.resolutionDays,
        owner: t.owner,
        ownerTeam: t.ownerTeam,
        impact: t.resolution,
        timeline: [
          { on: openedOn, note: "Issue raised and assigned.", by: t.owner },
          {
            on: subtractDays(asOf, t.resolvedDaysAgo),
            note: t.resolution,
            by: t.owner,
          },
        ],
      };
    },
  );

  const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return [...open, ...resolved].sort((a, b) => {
    if (a.status === "resolved" && b.status !== "resolved") return 1;
    if (b.status === "resolved" && a.status !== "resolved") return -1;
    const p = priorityRank[a.priority] - priorityRank[b.priority];
    return p !== 0 ? p : b.agingDays - a.agingDays;
  });
}

function buildFeedback(
  entity: Entity,
  period: Period,
  services: ServiceId[],
  mix: Record<string, number>,
): Feedback[] {
  const asOf = asOfIso(period);
  const target = clamp(Math.round(12 * (0.5 + 0.5 * entity.scale)), 4, 15);
  const chosen = selectByQuota(FEEDBACK_TEMPLATES, entity, services, mix, target);

  return chosen
    .map((t) => ({
      id: `${entity.id}-${t.key}`,
      entityId: entity.id,
      serviceId: t.serviceId,
      author: t.author,
      authorRole: t.authorRole,
      on: subtractDays(asOf, t.daysAgo),
      rating: t.rating,
      type: t.type,
      quote: t.quote,
      linkedKpiId: t.linkedKpiId,
      responded: t.responded,
    }))
    .sort((a, b) => (a.on < b.on ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Customer experience                                                 */
/* ------------------------------------------------------------------ */

function buildCx(
  entity: Entity,
  period: Period,
  services: ServiceId[],
  slas: Record<string, ServiceSla>,
  mix: Record<string, number>,
  feedback: Feedback[],
): CustomerExperience {
  const baselineSla: Record<ServiceId, number> = {
    fna: 96.76,
    hr: 94.1,
    tax: 98.02,
    automation: 98.35,
    analytics: 97.31,
  };

  const csatByService = services.map((s) => {
    const gap = (slas[s]?.overall ?? baselineSla[s]) - baselineSla[s];
    const score = clamp(round2(CSAT_BASELINE[s] + entity.opsDelta * 0.1 + gap * 0.035), 1, 5);
    return {
      serviceId: s,
      score,
      responses: Math.max(6, Math.round(148 * entity.scale * (mix[s] ?? 0.2))),
    };
  });

  const csat = round2(
    csatByService.reduce((acc, c) => acc + c.score * (mix[c.serviceId] ?? 0), 0) /
      Math.max(0.0001, sum(services.map((s) => mix[s] ?? 0))),
  );

  const respondents = Math.max(24, Math.round(148 * entity.scale));
  const rawNps = (csat - 3.92) * 62;
  const detractorShare = clamp(0.3 - rawNps / 400, 0.04, 0.45);
  const promoterShare = clamp(detractorShare + rawNps / 100, 0.05, 0.92);
  const promoters = Math.round(respondents * promoterShare);
  const detractors = Math.round(respondents * detractorShare);
  const passives = Math.max(0, respondents - promoters - detractors);
  const nps = Math.round(((promoters - detractors) / respondents) * 100);

  // Deteriorating accounts show NPS falling into the current quarter.
  const declining = entity.opsDelta < -0.8;
  const shape = declining ? [9, 4, 0] : [-7, -3, 0];
  const npsQuarters: NpsQuarter[] = QUARTERS.slice(0, 3).map((q, i) => {
    const score = nps + shape[i];
    const r = Math.max(12, Math.round(respondents * (i === 2 ? 0.72 : 0.94)));
    const dShare = clamp(0.3 - score / 400, 0.04, 0.45);
    const pShare = clamp(dShare + score / 100, 0.05, 0.92);
    const p = Math.round(r * pShare);
    const d = Math.round(r * dShare);
    return {
      key: q.key,
      label: `${q.label} ${period.short}`,
      score: Math.round(((p - d) / r) * 100),
      promoters: p,
      passives: Math.max(0, r - p - d),
      detractors: d,
      respondents: r,
      isPartial: i === 2 && period.isCurrent,
    };
  });

  const openComplaints = Math.max(
    1,
    Math.round(8 * (0.4 + 0.6 * entity.scale) * (1 - entity.opsDelta * 0.15)),
  );
  const escalations = Math.max(
    0,
    Math.round(3 * (0.4 + 0.6 * entity.scale) * (1 - entity.opsDelta * 0.2)),
  );

  return {
    csat,
    csatDelta: round2(entity.opsDelta * 0.06 + (declining ? -0.2 : 0.1)),
    csatByService,
    nps,
    npsDelta: npsQuarters.length >= 2 ? nps - npsQuarters[1].score : 0,
    npsQuarters,
    respondents,
    openComplaints: Math.max(openComplaints, feedback.filter((f) => f.type === "complaint").length),
    escalations,
    responseRate: round2(clamp(62 + entity.opsDelta * 2, 30, 90)),
  };
}

/* ------------------------------------------------------------------ */
/* Automation                                                          */
/* ------------------------------------------------------------------ */

function buildAutomation(
  entity: Entity,
  period: Period,
  services: ServiceId[],
  vols: ServiceVolumes,
  billing: ServiceBilling,
): { snapshot: AutomationSnapshot; ctx: MetricContext } {
  const asOf = asOfIso(period);
  const cur = vols.currentIndex;
  const q = BLUEPRINTS.automation.quality;

  const botCount = vols.txn["auto-licence"][cur];
  const totalTxn = vols.txn["auto-txn"][cur];

  const eligible = BOT_FLEET.filter((b) => services.includes(b.serviceId)).sort(
    (a, b) => b.share - a.share,
  );
  const roster = eligible.slice(0, Math.max(1, Math.min(botCount, eligible.length)));

  const txnSplit = distribute(
    totalTxn,
    roster.map((b) => b.share),
  );

  const bots: Bot[] = roster.map((spec, i) => {
    const transactions = txnSplit[i];
    const jobs = Math.max(1, Math.round(transactions / spec.itemsPerJob));
    const failedJobs = Math.round((jobs * (100 - spec.successRate)) / 100);
    return {
      id: `${entity.id}-${spec.key}`,
      name: spec.name,
      kind: spec.kind,
      process: spec.process,
      serviceId: spec.serviceId,
      status: spec.status,
      jobs,
      failedJobs,
      successRate: round2(((jobs - failedJobs) / jobs) * 100),
      transactions,
      hoursSaved: Math.round((transactions * spec.minutesSavedPerTxn) / 60),
      avgRuntimeMin: spec.avgRuntimeMin,
      lastRun: `${spec.lastRunHoursAgo}h ago`,
      owner: spec.owner,
    };
  });

  const totalJobs = sum(bots.map((b) => b.jobs));
  const failedJobs = sum(bots.map((b) => b.failedJobs));
  const successfulJobs = totalJobs - failedJobs;
  const successRate = round2((successfulJobs / Math.max(1, totalJobs)) * 100);

  const hoursSavedMonth = sum(bots.map((b) => b.hoursSaved));
  const seasonality = BLUEPRINTS.automation.seasonality;
  const ytdRatio = sum(seasonality.slice(0, vols.actualCount)) / seasonality[cur];
  const hoursSavedYtd = Math.round(hoursSavedMonth * ytdRatio);

  const blendedHourlyCost = q.blendedHourlyCost;
  const costSavingMonth = hoursSavedMonth * blendedHourlyCost;
  const costSavingYtd = hoursSavedYtd * blendedHourlyCost;
  const automationCostMonth = billing.currentTotal;
  const roi = round2(costSavingMonth / Math.max(1, automationCostMonth));

  const monthlyHoursSaved = period.months.map((mo, m) => ({
    short: mo.short,
    value: Math.round((hoursSavedMonth * seasonality[m]) / seasonality[cur]),
    isActual: mo.isActual,
  }));

  const scaleFactor = entity.scale;
  const pipeline = AUTOMATION_PIPELINE.map((p) => ({
    ...p,
    estHoursMonth: Math.max(8, Math.round(p.estHoursMonth * scaleFactor)),
  }));

  const snapshot: AutomationSnapshot = {
    bots,
    totalBots: bots.length,
    activeBots: bots.filter((b) => b.status === "running").length,
    warningBots: bots.filter((b) => b.status === "warning").length,
    failedBots: bots.filter((b) => b.status === "failed").length,
    totalJobs,
    successfulJobs,
    failedJobs,
    successRate,
    transactionsAutomated: totalTxn,
    exceptions: stockValue("automation", "exceptionsQueued", entity, period),
    hoursSavedMonth,
    hoursSavedYtd,
    costSavingMonth,
    costSavingYtd,
    automationCostMonth,
    netValueMonth: costSavingMonth - automationCostMonth,
    roi,
    blendedHourlyCost,
    monthlyHoursSaved,
    automationCoverage: clamp(q.automationCoverage + entity.opsDelta * 2.5, 15, 95) / 100,
    pipeline,
  };

  void asOf;
  return { snapshot, ctx: { successRate, botJobs: totalJobs, roi } };
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

function financialContext(entity: Entity, period: Period): FinancialContext {
  const f = getPeriodDefinition(period.id).volumeFactor * entity.scale;
  const varianceAdj = round2(3.4 + jitter(`opex-${entity.id}`) * 2.2);
  const opexYtd = FINANCIAL_BASELINE.opexYtd * f;
  const receivablesTotal = FINANCIAL_BASELINE.receivablesTotal * f;
  const payablesTotal = FINANCIAL_BASELINE.payablesTotal * f;
  const inventory = FINANCIAL_BASELINE.inventory * f;

  return {
    ...FINANCIAL_BASELINE,
    revenueYtd: FINANCIAL_BASELINE.revenueYtd * f,
    aeroRevenueYtd: FINANCIAL_BASELINE.aeroRevenueYtd * f,
    nonAeroRevenueYtd: FINANCIAL_BASELINE.nonAeroRevenueYtd * f,
    revenueGrowthPct: round2(FINANCIAL_BASELINE.revenueGrowthPct + jitter(`rev-${entity.id}`) * 3.1),
    opexYtd,
    opexBudgetYtd: opexYtd / (1 + varianceAdj / 100),
    opexVariancePct: varianceAdj,
    spendUnderManagement: FINANCIAL_BASELINE.spendUnderManagement * f,
    procurementSavings: FINANCIAL_BASELINE.procurementSavings * f,
    receivablesTotal,
    payablesTotal,
    inventory,
    openItemsOver60: FINANCIAL_BASELINE.openItemsOver60 * f,
    workingCapital: receivablesTotal + inventory - payablesTotal,
  };
}

function buildAnalytics(
  entity: Entity,
  period: Period,
  vols: ServiceVolumes,
  fin: FinancialContext,
): AnalyticsSnapshot {
  /** Products name their headline by key; only numeric fields are valid. */
  const finNumber = (key: string): number => {
    const v = (fin as unknown as Record<string, unknown>)[key];
    return typeof v === "number" ? v : 0;
  };
  const cur = vols.currentIndex;
  const productCount = clamp(vols.txn["an-products"][cur], 1, ANALYTICS_PRODUCTS.length);
  const specs = [...ANALYTICS_PRODUCTS].sort((a, b) => a.rank - b.rank).slice(0, productCount);

  const totalReports = vols.txn["an-reports"][cur];
  const totalInsights = stockValue("analytics", "insightsGenerated", entity, period);
  const activeUsers = stockValue("analytics", "activeUsers", entity, period);

  const reportSplit = distribute(totalReports, specs.map((s) => s.reports));
  const insightSplit = distribute(totalInsights, specs.map((s) => s.insights));

  const scaleF = getPeriodDefinition(period.id).volumeFactor * entity.scale;

  const products: AnalyticsProduct[] = specs.map((s, i) => {
    const headlineValue = finNumber(s.headlineKey);
    const isPercent = s.headlineFormat === "percent";
    return {
      id: `${entity.id}-${s.key}`,
      name: s.name,
      category: s.category,
      description: s.description,
      sourceSystem: s.sourceSystem,
      refresh: s.refresh,
      status: "live",
      headlineLabel: s.headlineLabel,
      headlineValue,
      headlineFormat: s.headlineFormat,
      headlineDeltaPct: s.headlineDeltaPct,
      headlineDirection: s.headlineDirection,
      insights: insightSplit[i],
      reports: reportSplit[i],
      users: Math.max(3, Math.round(activeUsers * s.userShare)),
      highlights: s.highlights,
      series: s.series.map((v) => (isPercent ? v : v * headlineValue)),
      breakdown: s.breakdown?.map((b) => ({
        label: b.label,
        value: isPercent ? b.share * 100 : b.share * headlineValue,
        format: (isPercent ? "percent" : "currency") as AnalyticsProduct["headlineFormat"],
      })),
    };
  });

  return {
    products,
    liveProducts: products.length,
    totalReports,
    totalInsights,
    activeUsers,
    valueIdentified: sum(specs.map((s) => s.valueIdentified)) * scaleF,
  };
}

/* ------------------------------------------------------------------ */
/* Snapshot assembly                                                   */
/* ------------------------------------------------------------------ */

function primaryActivity(
  serviceId: ServiceId,
  vols: ServiceVolumes,
  period: Period,
): ServiceSnapshot["activityChart"] {
  const bp = BLUEPRINTS[serviceId];
  const seriesFor = (lineIds: string[], title: string, unit: string) => ({
    title,
    unit,
    series: period.months.map((mo, m) => ({
      short: mo.short,
      value: sum(lineIds.map((id) => vols.txn[id][m])),
      isActual: mo.isActual,
    })),
  });

  switch (serviceId) {
    case "fna":
      return seriesFor(["fna-ap"], "Invoices processed", "invoices");
    case "hr":
      return seriesFor(["hr-payroll"], "Payroll records processed", "payslips");
    case "tax":
      return seriesFor(bp.txn.map((l) => l.id), "Tax cases handled", "cases");
    case "automation":
      return seriesFor(["auto-txn"], "Transactions executed by bots", "transactions");
    default:
      return seriesFor(["an-reports"], "Reports & data feeds delivered", "deliveries");
  }
}

const PENDING_SHARE: Record<ServiceId, number> = {
  fna: 0.047,
  hr: 0.031,
  tax: 0.052,
  automation: 0.018,
  analytics: 0.025,
};

function buildOverviewMetrics(
  serviceId: ServiceId,
  entity: Entity,
  period: Period,
  vols: ServiceVolumes,
  ctx: MetricContext,
  sla: ServiceSla,
  billing: ServiceBilling,
  activity: ServiceSnapshot["activityChart"],
  automation: AutomationSnapshot | null,
  analytics: AnalyticsSnapshot | null,
): { headline: ActivityMetric[]; overview: ActivityMetric[] } {
  const cur = vols.currentIndex;
  const actualSeries = activity.series.filter((s) => s.isActual).map((s) => s.value);
  const ytdVolume = sum(actualSeries);
  const ytdCaption = `${vols.actualCount} months to ${period.asOf}`;
  const monthCaption = billing.currentMonthLabel;

  const v = (id: string) => vols.txn[id]?.[cur] ?? 0;
  const ytdOf = (id: string) => sum((vols.txn[id] ?? []).filter((_, m) => period.months[m].isActual));

  switch (serviceId) {
    case "fna": {
      const invoices = v("fna-ap");
      const invoiceValue = invoices * 17_969;
      return {
        headline: [
          { id: "invoices", label: "Invoices processed", value: invoices, format: "number", caption: monthCaption, series: actualSeries },
          { id: "sla", label: "SLA achievement", value: sla.overall, format: "percent" },
          { id: "billing", label: "Billing", value: billing.currentTotal, format: "currency", caption: monthCaption },
        ],
        overview: [
          { id: "invoices", label: "Invoices processed", value: invoices, format: "number", caption: monthCaption, series: actualSeries },
          { id: "invoice-value", label: "Invoice value processed", value: invoiceValue, format: "currency", caption: monthCaption },
          { id: "tat", label: "Average processing time", value: ctx.avgProcessingDays, format: "days", direction: "lower-better" },
          { id: "rejection", label: "Rejection rate", value: ctx.rejectionRate, format: "percent", direction: "lower-better" },
          { id: "sla", label: "SLA achievement", value: sla.overall, format: "percent", direction: "higher-better" },
          { id: "ftr", label: "First-time-right", value: ctx.firstTimeRight, format: "percent", direction: "higher-better" },
          { id: "touchless", label: "Touchless processing", value: ctx.touchlessRate, format: "percent", direction: "higher-better" },
          { id: "ytd", label: "Invoices processed (YTD)", value: ytdVolume, format: "number", caption: ytdCaption },
          { id: "ar", label: "Customer invoices raised", value: v("fna-ar"), format: "number", caption: monthCaption },
          { id: "dpo", label: "Days payable outstanding", value: ctx.daysPayableOutstanding, format: "days", direction: "lower-better" },
        ],
      };
    }
    case "hr": {
      const openPositions = stockValue("hr", "openPositions", entity, period);
      const inProgress = stockValue("hr", "positionsInProgress", entity, period);
      const closedYtd = ytdOf("hr-hiring");
      return {
        headline: [
          { id: "open-positions", label: "Open positions", value: openPositions, format: "number" },
          { id: "sla", label: "SLA achievement", value: sla.overall, format: "percent" },
          { id: "billing", label: "Billing", value: billing.currentTotal, format: "currency", caption: monthCaption },
        ],
        overview: [
          { id: "open-positions", label: "Open positions", value: openPositions, format: "number" },
          { id: "in-progress", label: "Positions in progress", value: inProgress, format: "number" },
          { id: "closed", label: "Positions closed (YTD)", value: closedYtd, format: "number", caption: ytdCaption },
          { id: "candidate", label: "Candidate feedback", value: ctx.candidateExperience, format: "score", direction: "higher-better" },
          { id: "sla", label: "SLA achievement", value: sla.overall, format: "percent", direction: "higher-better" },
          { id: "tth", label: "Time to hire", value: ctx.timeToHireDays, format: "days", direction: "lower-better" },
          { id: "payroll", label: "Payroll records processed", value: v("hr-payroll"), format: "number", caption: monthCaption, series: (vols.txn["hr-payroll"] ?? []).filter((_, m) => period.months[m].isActual) },
          { id: "payroll-acc", label: "Payroll accuracy", value: ctx.payrollAccuracy, format: "percent", direction: "higher-better" },
          { id: "helpdesk", label: "Helpdesk tickets resolved", value: v("hr-helpdesk"), format: "number", caption: monthCaption },
          { id: "offers", label: "Offers pending acceptance", value: stockValue("hr", "offersPending", entity, period), format: "number" },
        ],
      };
    }
    case "tax": {
      const casesMonth = sum(BLUEPRINTS.tax.txn.map((l) => v(l.id)));
      return {
        headline: [
          { id: "cases", label: "Cases handled (YTD)", value: ytdVolume, format: "number", caption: ytdCaption, series: actualSeries },
          { id: "sla", label: "SLA achievement", value: sla.overall, format: "percent" },
          { id: "billing", label: "Billing", value: billing.currentTotal, format: "currency", caption: monthCaption },
        ],
        overview: [
          { id: "cases-ytd", label: "Cases handled (YTD)", value: ytdVolume, format: "number", caption: ytdCaption, series: actualSeries },
          { id: "cases-month", label: "Cases handled", value: casesMonth, format: "number", caption: monthCaption },
          { id: "filings", label: "Statutory filings", value: v("tax-filing"), format: "number", caption: monthCaption },
          { id: "ontime", label: "Filings on time", value: ctx.filingOnTimeRate, format: "percent", direction: "higher-better" },
          { id: "notices", label: "Notices & assessments", value: v("tax-notice"), format: "number", caption: monthCaption },
          { id: "sla", label: "SLA achievement", value: sla.overall, format: "percent", direction: "higher-better" },
          { id: "tat", label: "Average turnaround", value: ctx.avgTurnaroundDays, format: "days", direction: "lower-better" },
          { id: "itc", label: "Input credit match rate", value: ctx.inputCreditMatchRate, format: "percent", direction: "higher-better" },
          { id: "exception", label: "Exception rate", value: ctx.exceptionRate, format: "percent", direction: "lower-better" },
          { id: "litigation", label: "Open litigation matters", value: stockValue("tax", "openLitigation", entity, period), format: "number" },
        ],
      };
    }
    case "automation": {
      const a = automation;
      return {
        headline: [
          { id: "bots", label: "Bots & AI agents", value: a?.totalBots ?? 0, format: "number" },
          { id: "success", label: "Success rate", value: a?.successRate ?? 0, format: "percent" },
          { id: "savings", label: "Savings", value: a?.costSavingMonth ?? 0, format: "currency", caption: monthCaption },
        ],
        overview: [
          { id: "bots", label: "Bots & AI agents", value: a?.totalBots ?? 0, format: "number" },
          { id: "active", label: "Currently running", value: a?.activeBots ?? 0, format: "number" },
          { id: "jobs", label: "Jobs executed", value: a?.totalJobs ?? 0, format: "number", caption: monthCaption },
          { id: "success", label: "Job success rate", value: a?.successRate ?? 0, format: "percent", direction: "higher-better" },
          { id: "txns", label: "Transactions automated", value: a?.transactionsAutomated ?? 0, format: "number", caption: monthCaption, series: actualSeries },
          { id: "hours", label: "Effort released", value: a?.hoursSavedMonth ?? 0, format: "hours", caption: monthCaption },
          { id: "savings", label: "Cost saving", value: a?.costSavingMonth ?? 0, format: "currency", caption: monthCaption },
          { id: "roi", label: "Return on investment", value: a?.roi ?? 0, format: "ratio", direction: "higher-better" },
          { id: "exceptions", label: "Exceptions queued", value: a?.exceptions ?? 0, format: "number", direction: "lower-better" },
          { id: "coverage", label: "Automation coverage", value: (a?.automationCoverage ?? 0) * 100, format: "percent", direction: "higher-better" },
        ],
      };
    }
    default: {
      const an = analytics;
      return {
        headline: [
          { id: "products", label: "Active analytics", value: an?.liveProducts ?? 0, format: "number" },
          { id: "reports", label: "Reports", value: an?.totalReports ?? 0, format: "number" },
          { id: "insights", label: "Insights generated", value: an?.totalInsights ?? 0, format: "number" },
        ],
        overview: [
          { id: "products", label: "Active analytics products", value: an?.liveProducts ?? 0, format: "number" },
          { id: "reports", label: "Scheduled reports & feeds", value: an?.totalReports ?? 0, format: "number" },
          { id: "insights", label: "Insights generated (YTD)", value: an?.totalInsights ?? 0, format: "number", caption: ytdCaption },
          { id: "users", label: "Active business users", value: an?.activeUsers ?? 0, format: "number" },
          { id: "ontime", label: "Delivery on schedule", value: ctx.onTimeDelivery, format: "percent", direction: "higher-better" },
          { id: "fresh", label: "Data freshness", value: ctx.dataFreshness, format: "percent", direction: "higher-better" },
          { id: "tat", label: "Insight request turnaround", value: ctx.insightTatDays, format: "days", direction: "lower-better" },
          { id: "adoption", label: "Analytics adoption", value: ctx.adoptionRate, format: "percent", direction: "higher-better" },
          { id: "value", label: "Value identified (YTD)", value: an?.valueIdentified ?? 0, format: "currency", caption: ytdCaption },
          { id: "sla", label: "SLA achievement", value: sla.overall, format: "percent", direction: "higher-better" },
        ],
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Executive metrics & attention                                       */
/* ------------------------------------------------------------------ */

function buildExec(
  fin: FinancialContext,
  billing: EntityBilling,
  automation: AutomationSnapshot | null,
  period: Period,
): ExecMetric[] {
  const annualisedRevenue = (fin.revenueYtd / Math.max(1, period.actualMonthCount)) * 12;
  const over90 = fin.receivablesTotal * (FINANCIAL_BASELINE.receivablesAgeing[3].share ?? 0.154);

  const metrics: ExecMetric[] = [
    {
      id: "revenue-growth",
      label: "Revenue growth",
      value: fin.revenueGrowthPct,
      format: "percent",
      direction: "higher-better",
      note: "Year on year, year to date",
      sourceSystem: "SAP S/4HANA",
    },
    {
      id: "expense-variance",
      label: "Expense variance vs budget",
      value: fin.opexVariancePct,
      format: "percent",
      direction: "lower-better",
      note: "Operating expenditure, year to date",
      sourceSystem: "SAP S/4HANA",
    },
    {
      id: "working-capital",
      label: "Working capital",
      value: fin.workingCapital,
      format: "currency",
      direction: "lower-better",
      note: "Receivables plus inventory, less payables",
      sourceSystem: "SAP S/4HANA",
    },
    {
      id: "receivables-90",
      label: "Receivables over 90 days",
      value: over90,
      format: "currency",
      direction: "lower-better",
      note: `${((over90 / fin.receivablesTotal) * 100).toFixed(1)}% of total receivables`,
      sourceSystem: "SAP S/4HANA",
    },
    {
      id: "procurement-savings",
      label: "Procurement savings",
      value: fin.procurementSavings,
      format: "currency",
      deltaPct: 12.4,
      direction: "higher-better",
      note: `${((fin.procurementSavings / fin.spendUnderManagement) * 100).toFixed(
        2,
      )}% of spend under management`,
      sourceSystem: "SAP Ariba",
    },
    {
      id: "ssc-cost-ratio",
      label: "SSC cost as % of revenue",
      value: (billing.fyForecast / annualisedRevenue) * 100,
      format: "percent",
      direction: "lower-better",
      note: "Full-year SSC fee over annualised revenue",
      sourceSystem: "SSC billing",
    },
  ];

  if (automation) {
    metrics.splice(5, 0, {
      id: "automation-savings",
      label: "Automation savings",
      value: automation.costSavingYtd,
      format: "currency",
      deltaPct: 34.2,
      direction: "higher-better",
      note: `${automation.hoursSavedYtd.toLocaleString("en-IN")} hours of effort released YTD`,
      sourceSystem: "RPA Control Tower",
    });
  }

  return metrics;
}

function buildAttention(
  entity: Entity,
  services: ServiceSnapshot[],
  billing: EntityBilling,
  cx: CustomerExperience,
  issues: Issue[],
  automation: AutomationSnapshot | null,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const loc = LOCATIONS.find((l) => l.id === entity.locationId)?.name ?? "";

  for (const s of services) {
    const href = `/services/${s.service.id}`;
    if (s.sla.status === "bad") {
      const worst = [...s.sla.components].sort(
        (a, b) => a.actual - a.target - (b.actual - b.target),
      )[0];
      items.push({
        id: `att-sla-${s.service.id}`,
        severity: "critical",
        kind: "sla-breach",
        title: `${s.service.name} SLA below contracted level`,
        detail: `Weighted SLA is ${s.sla.overall.toFixed(1)}% against a ${s.sla.target}% commitment. The largest single drag is ${worst.label.toLowerCase()} at ${worst.actual.toFixed(1)}%.`,
        serviceId: s.service.id,
        entityId: entity.id,
        metricLabel: "SLA achievement",
        actual: `${s.sla.overall.toFixed(1)}%`,
        target: `${s.sla.target}%`,
        href: `${href}?tab=kpi`,
        action: "Review SLA breakdown",
      });
    } else if (s.sla.status === "warn") {
      items.push({
        id: `att-sla-risk-${s.service.id}`,
        severity: "warning",
        kind: "sla-risk",
        title: `${s.service.name} SLA approaching breach`,
        detail: `SLA is ${s.sla.overall.toFixed(1)}% against a ${s.sla.target}% commitment, inside the tolerance band but trending ${s.sla.trend === "down" ? "downward" : "flat"}.`,
        serviceId: s.service.id,
        entityId: entity.id,
        metricLabel: "SLA achievement",
        actual: `${s.sla.overall.toFixed(1)}%`,
        target: `${s.sla.target}%`,
        href: `${href}?tab=kpi`,
        action: "Review SLA breakdown",
      });
    }

    for (const k of s.kpis.filter((k) => k.status === "bad" && k.id !== `${s.service.id}-kpi-sla`)) {
      items.push({
        id: `att-kpi-${k.id}`,
        severity: "critical",
        kind: "kpi-breach",
        // Keep the KPI name verbatim — lower-casing mangles acronyms like SLA.
        title: `${s.service.code} — ${k.name} is outside target`,
        detail: k.gapNarrative,
        serviceId: s.service.id,
        entityId: entity.id,
        metricLabel: k.name,
        actual: formatKpiValue(k),
        target: `${k.direction === "higher-better" ? "≥" : "≤"} ${k.target}`,
        href: `${href}?tab=kpi`,
        action: "Open KPI detail",
      });
    }

    if (Math.abs(s.billing.momPct) >= 12) {
      items.push({
        id: `att-bill-${s.service.id}`,
        severity: Math.abs(s.billing.momPct) >= 20 ? "critical" : "warning",
        kind: "billing-variance",
        title: `${s.service.name} billing moved ${s.billing.momPct >= 0 ? "up" : "down"} ${Math.abs(s.billing.momPct).toFixed(1)}% month on month`,
        detail: s.billing.narrative,
        serviceId: s.service.id,
        entityId: entity.id,
        metricLabel: "Month-on-month billing",
        actual: `${s.billing.momPct >= 0 ? "+" : "−"}${Math.abs(s.billing.momPct).toFixed(1)}%`,
        href: `${href}?tab=billing`,
        action: "See billing drivers",
      });
    }
  }

  if (Math.abs(billing.ytdVariancePct) >= 5) {
    items.push({
      id: "att-budget",
      severity: Math.abs(billing.ytdVariancePct) >= 9 ? "critical" : "warning",
      kind: "billing-variance",
      title: `SSC billing is ${billing.ytdVariancePct >= 0 ? "above" : "below"} budget by ${Math.abs(billing.ytdVariancePct).toFixed(1)}% year to date`,
      detail: billing.narrative,
      entityId: entity.id,
      metricLabel: "YTD billing vs budget",
      actual: `${billing.ytdVariancePct >= 0 ? "+" : "−"}${Math.abs(billing.ytdVariancePct).toFixed(1)}%`,
      href: "/billing",
      action: "Open billing analysis",
    });
  }

  for (const i of issues.filter(
    (i) => i.status !== "resolved" && i.agingDays > i.slaTargetDays,
  )) {
    items.push({
      id: `att-issue-${i.id}`,
      severity: i.priority === "critical" ? "critical" : "warning",
      kind: "ageing-issue",
      title: `${SERVICE_MAP[i.serviceId].code} issue past resolution target — ${i.title}`,
      detail: `${i.impact} Open for ${i.agingDays} days against a ${i.slaTargetDays}-day resolution target. Owned by ${i.owner}, ${i.ownerTeam}.`,
      serviceId: i.serviceId,
      entityId: entity.id,
      metricLabel: "Ageing",
      actual: `${i.agingDays} days`,
      target: `${i.slaTargetDays} days`,
      href: `/issues?issue=${i.id}`,
      action: "Open issue",
    });
  }

  if (cx.npsQuarters.length >= 2) {
    const latest = cx.npsQuarters[cx.npsQuarters.length - 1];
    const previous = cx.npsQuarters[cx.npsQuarters.length - 2];
    if (latest.score < previous.score) {
      items.push({
        id: "att-nps",
        severity: previous.score - latest.score >= 6 ? "critical" : "warning",
        kind: "cx-decline",
        title: `Net promoter score fell ${previous.score - latest.score} points this quarter`,
        detail: `NPS moved from ${previous.score >= 0 ? "+" : ""}${previous.score} in ${previous.label} to ${latest.score >= 0 ? "+" : ""}${latest.score} in ${latest.label}, across ${latest.respondents} responses.`,
        entityId: entity.id,
        metricLabel: "NPS",
        actual: `${latest.score >= 0 ? "+" : ""}${latest.score}`,
        target: `${previous.score >= 0 ? "+" : ""}${previous.score}`,
        href: "/performance",
        action: "Review customer experience",
      });
    }
  }

  if (automation) {
    const trouble = automation.bots.filter((b) => b.status === "warning" || b.status === "failed");
    if (trouble.length > 0) {
      items.push({
        id: "att-bots",
        severity: automation.bots.some((b) => b.status === "failed") ? "critical" : "warning",
        kind: "automation-failure",
        title: `${trouble.length} automation${trouble.length > 1 ? "s are" : " is"} reporting errors`,
        detail: `${trouble.map((b) => b.name).join(", ")} ${trouble.length > 1 ? "are" : "is"} running below the 97% job success threshold. Affected work has reverted to manual processing.`,
        serviceId: "automation",
        entityId: entity.id,
        metricLabel: "Bots requiring attention",
        actual: String(trouble.length),
        href: "/automation",
        action: "Open control tower",
      });
    }

    if (automation.pipeline.length > 0) {
      const hours = sum(automation.pipeline.map((p) => p.estHoursMonth));
      items.push({
        id: "att-opportunity",
        severity: "info",
        kind: "opportunity",
        title: `${automation.pipeline.length} automations in the pipeline could release a further ${hours.toLocaleString("en-IN")} hours a month`,
        detail: `Estimated additional saving of ${Math.round((hours * automation.blendedHourlyCost) / 1_00_000)} lakh per month once all four are live. Two are scheduled for December.`,
        serviceId: "automation",
        entityId: entity.id,
        href: "/automation",
        action: "Review pipeline",
      });
    }
  }

  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function formatKpiValue(k: Kpi): string {
  switch (k.unit) {
    case "percent":
      return `${k.actual.toFixed(1)}%`;
    case "days":
      return `${k.actual.toFixed(1)} days`;
    case "score":
      return `${k.actual.toFixed(1)} / 5`;
    case "ratio":
      return `${k.actual.toFixed(2)}×`;
    default:
      return k.actual.toLocaleString("en-IN");
  }
}

/* ------------------------------------------------------------------ */
/* Public builder                                                      */
/* ------------------------------------------------------------------ */

/** FY total for the prior year — used for the year-on-year comparison. */
function priorYearTotal(entity: Entity, periodId: string, services: ServiceId[]): number {
  const prior = getPeriodDefinition(periodId === "fy2026" ? "fy2025" : "fy2024");
  const priorPeriod = getPeriod(prior.id);
  return sum(
    services.map((s) => {
      const v = buildVolumes(entity, s, priorPeriod);
      return buildServiceBilling(entity, s, priorPeriod, v).fyForecast;
    }),
  );
}

export function buildEntitySnapshot(
  entityId: string,
  periodId: string,
  allowedServices?: ServiceId[],
): EntitySnapshot {
  const entity = ENTITIES.find((e) => e.id === entityId) ?? ENTITIES[0];
  const location = LOCATIONS.find((l) => l.id === entity.locationId) ?? LOCATIONS[0];
  const period = getPeriod(periodId);

  const services = entity.services.filter((s) => !allowedServices || allowedServices.includes(s));

  /* 1 — volumes and billing, which everything else hangs off. */
  const volumes: Record<string, ServiceVolumes> = {};
  const billings: Record<string, ServiceBilling> = {};
  for (const s of services) {
    volumes[s] = buildVolumes(entity, s, period);
    billings[s] = buildServiceBilling(entity, s, period, volumes[s]);
  }

  const fyTotal = sum(services.map((s) => billings[s].fyForecast));
  const mix: Record<string, number> = {};
  for (const s of services) {
    billings[s].mix = billings[s].fyForecast / fyTotal;
    mix[s] = billings[s].mix;
  }

  /* 2 — automation is computed early: its success rate feeds the SLA. */
  const fin = financialContext(entity, period);
  let automation: AutomationSnapshot | null = null;
  let automationCtx: MetricContext = {};
  if (services.includes("automation")) {
    const built = buildAutomation(entity, period, services, volumes.automation, billings.automation);
    automation = built.snapshot;
    automationCtx = built.ctx;
  }

  /* 3 — SLA, with the fleet's measured success rate wired into its component. */
  const slas: Record<string, ServiceSla> = {};
  for (const s of services) {
    const overrides: Record<string, number> = {};
    if (s === "automation" && automation) overrides["auto-sla-success"] = automation.successRate;
    slas[s] = buildSla(entity, s, period, overrides);
  }

  const analytics = services.includes("analytics")
    ? buildAnalytics(entity, period, volumes.analytics, fin)
    : null;

  /* 4 — issues and feedback, allocated by service billing mix. */
  const issues = buildIssues(entity, period, services, mix);
  const feedback = buildFeedback(entity, period, services, mix);

  /* 5 — service snapshots. */
  const serviceSnapshots: ServiceSnapshot[] = services.map((s) => {
    const vols = volumes[s];
    const sla = slas[s];
    const ctx = buildMetricContext(
      entity,
      s,
      period,
      vols,
      sla,
      s === "automation" ? automationCtx : {},
    );
    const billing = billings[s];
    const activity = primaryActivity(s, vols, period);
    const { headline, overview } = buildOverviewMetrics(
      s,
      entity,
      period,
      vols,
      ctx,
      sla,
      billing,
      activity,
      automation,
      analytics,
    );

    const serviceIssues = issues.filter((i) => i.serviceId === s);
    const serviceFeedback = feedback.filter((f) => f.serviceId === s);
    const kpis = buildKpis(entity, s, period, ctx, serviceIssues, serviceFeedback);

    const total = activity.series[vols.currentIndex].value;
    const exceptions = Math.round(total * ((ctx.exceptionRate ?? 1.8) / 100));
    const pending = Math.round(total * PENDING_SHARE[s]);

    const ceiling = (billing.fyBudget / 12) * 1.2;
    const utilisation = clamp(billing.currentTotal / ceiling, 0.1, 1.3);

    return {
      service: SERVICE_MAP[s],
      headline,
      overview,
      activityChart: activity,
      completion: { completed: Math.max(0, total - pending - exceptions), pending, exceptions },
      billing,
      sla,
      kpis,
      issueIds: serviceIssues.map((i) => i.id),
      feedbackIds: serviceFeedback.map((f) => f.id),
      utilisation,
      utilisationNote:
        utilisation > 1
          ? `Running ${((utilisation - 1) * 100).toFixed(0)}% above the contracted monthly envelope`
          : `${((1 - utilisation) * 100).toFixed(0)}% headroom against the contracted monthly envelope`,
    } satisfies ServiceSnapshot;
  });

  /* 6 — roll-ups. */
  const entityBilling = buildEntityBilling(
    entity,
    period,
    services.map((s) => billings[s]),
    priorYearTotal(entity, period.id, services),
  );

  const overallSla = round2(sum(serviceSnapshots.map((s) => s.sla.overall * s.billing.mix)));
  const overallTarget = round2(sum(serviceSnapshots.map((s) => s.sla.target * s.billing.mix)));
  const prevSla = round2(
    sum(
      serviceSnapshots.map(
        (s) => s.sla.monthly[Math.max(0, period.actualMonthCount - 2)].value * s.billing.mix,
      ),
    ),
  );

  const cx = buildCx(entity, period, services, slas, mix, feedback);
  const exec = buildExec(fin, entityBilling, automation, period);
  const attention = buildAttention(entity, serviceSnapshots, entityBilling, cx, issues, automation);

  const openIssues = issues.filter((i) => i.status !== "resolved");
  const resolvedIssues = issues.filter((i) => i.status === "resolved");

  return {
    entity,
    location,
    period,
    services: serviceSnapshots,
    billing: entityBilling,
    sla: {
      overall: overallSla,
      target: overallTarget,
      status: gradeAgainstTarget(overallSla, overallTarget, "higher-better", 0.03),
      deltaPts: round2(overallSla - prevSla),
      trend: trendFrom(overallSla, prevSla, 0.3) as Trend,
    },
    cx,
    issues,
    feedback,
    attention,
    automation,
    analytics,
    exec,
    counts: {
      openIssues: openIssues.length,
      criticalIssues: openIssues.filter((i) => i.priority === "critical").length,
      resolvedThisPeriod: resolvedIssues.length,
      avgResolutionDays: resolvedIssues.length
        ? round2(sum(resolvedIssues.map((i) => i.agingDays)) / resolvedIssues.length)
        : 0,
    },
  };
}

export const ALL_SERVICES: ServiceId[] = SERVICES.map((s) => s.id);
export type { Status };
