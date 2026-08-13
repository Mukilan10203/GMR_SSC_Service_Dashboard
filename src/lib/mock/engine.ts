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
  AVG_INVOICE_VALUE,
  AVG_PO_VALUE,
  BLUEPRINTS,
  botLicenceLineId,
  botTxnLineId,
  CSAT_BASELINE,
  SLA_BASELINE,
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
import { AUTOMATION_PIPELINE, AUTOMATION_PLATFORM, BOT_FLEET } from "./automation-fleet";
import {
  ANALYTICS_FOOTPRINT,
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
): MetricContext {
  const q = BLUEPRINTS[serviceId].quality;
  const d = entity.opsDelta; // negative = weaker delivery
  const cur = vols.currentIndex;
  const comp = (id: string) => sla.components.find((c) => c.id === id)?.actual;

  const ctx: MetricContext = { sla: sla.overall };

  switch (serviceId) {
    /* ---- F&A: AP · AR · Travel · Record to Report · Treasury ------- */
    case "fna": {
      ctx.avgProcessingDays = round2(q.avgProcessingDays - d * 0.18);
      ctx.rejectionRate = round2(clamp(q.rejectionRate - d * 0.32, 0.5, 20));
      ctx.exceptionRate = round2(clamp(q.exceptionRate - d * 0.22, 0.3, 15));
      ctx.firstTimeRight = round2(clamp(q.firstTimeRight + d * 0.55, 60, 100));
      ctx.touchlessRate = round2(clamp(q.touchlessRate + d * 1.2, 20, 100));
      ctx.daysPayableOutstanding = round2(q.daysPayableOutstanding - d * 0.6);
      ctx.closeCycleDays = round2(Math.max(1, q.closeCycleDays - d * 0.12));
      ctx.collectionEffectiveness =
        round2(clamp(q.collectionEffectiveness + d * 0.7, 50, 100));
      ctx.travelSettlementDays = round2(Math.max(0.5, q.travelSettlementDays - d * 0.15));
      ctx.bankReconAccuracy = comp("fna-sla-treasury")
        ? round2(clamp(q.bankReconAccuracy + (comp("fna-sla-treasury")! - 97.6) * 0.28, 80, 100))
        : round2(clamp(q.bankReconAccuracy + d * 0.1, 80, 100));
      ctx.lateInvoiceShare = clamp((ctx.avgProcessingDays / 5) * 0.11, 0.02, 0.45);
      ctx.reworkShare = (100 - ctx.firstTimeRight) / 100;
      ctx.rejectionShare = ctx.rejectionRate / 100;
      ctx.exceptionShare = ctx.exceptionRate / 100;
      ctx.arOverdueShare = (100 - ctx.collectionEffectiveness) / 100;
      ctx.lateClaimShare = clamp((ctx.travelSettlementDays / 4) * 0.14, 0.02, 0.5);
      ctx.bankBreakShare = (100 - ctx.bankReconAccuracy) / 100;
      break;
    }

    /* ---- HR Ops: TA · Payroll · L&D · Core HR ---------------------- */
    case "hrops": {
      ctx.timeToHireDays = round2(q.timeToHireDays - d * 1.6);
      ctx.talentAcquisitionSla =
        comp("hrops-sla-ta") ?? round2(clamp(q.talentAcquisitionSla + d * 3.5, 20, 100));
      ctx.payrollAccuracy = round2(clamp(q.payrollAccuracy + d * 0.28, 90, 100));
      ctx.candidateExperience = round2(clamp(q.candidateExperience + d * 0.12, 1, 5));
      ctx.attritionRate = round2(clamp(q.attritionRate - d * 0.5, 2, 40));
      ctx.helpdeskFirstResponseHrs = round2(Math.max(0.5, q.helpdeskFirstResponseHrs - d * 0.3));
      ctx.trainingCompletionRate =
        comp("hrops-sla-lnd") !== undefined
          ? round2(clamp(q.trainingCompletionRate + (comp("hrops-sla-lnd")! - 94.6) * 0.42, 20, 100))
          : round2(clamp(q.trainingCompletionRate + d * 1.4, 20, 100));
      ctx.learningHoursPerEmployee = round2(clamp(q.learningHoursPerEmployee + d * 0.4, 1, 40));
      ctx.exceptionRate = round2(clamp(q.exceptionRate - d * 0.16, 0.2, 12));
      ctx.taBreachShare = (100 - ctx.talentAcquisitionSla) / 100;
      ctx.lateHireShare = clamp((ctx.timeToHireDays / 45) * 0.24, 0.05, 0.7);
      ctx.payrollErrorShare = (100 - ctx.payrollAccuracy) / 100;
      ctx.trainingIncompleteShare = (100 - ctx.trainingCompletionRate) / 100;
      ctx.slowResponseShare = clamp((ctx.helpdeskFirstResponseHrs / 4) * 0.13, 0.02, 0.6);
      break;
    }

    /* ---- Procurement & Contracts ----------------------------------- */
    case "procurement": {
      ctx.prToPoDays = round2(Math.max(0.5, q.prToPoDays - d * 0.14));
      ctx.savingsRate = round2(clamp(q.savingsRate + d * 0.22, 0.5, 15));
      ctx.contractOnTimeRate =
        comp("proc-sla-contract") ?? round2(clamp(q.contractOnTimeRate + d * 0.4, 60, 100));
      ctx.vendorOnboardingDays = round2(Math.max(0.5, q.vendorOnboardingDays - d * 0.12));
      ctx.spendUnderManagementPct = round2(clamp(q.spendUnderManagementPct + d * 1.5, 30, 100));
      ctx.maverickSpendRate = round2(clamp(q.maverickSpendRate - d * 0.3, 0.5, 25));
      ctx.exceptionRate = round2(clamp(q.exceptionRate - d * 0.2, 0.3, 15));
      ctx.firstTimeRight = round2(clamp(q.firstTimeRight + d * 0.5, 60, 100));
      ctx.latePoShare = clamp((ctx.prToPoDays / 4) * 0.16, 0.02, 0.6);
      ctx.lateContractShare = (100 - ctx.contractOnTimeRate) / 100;
      ctx.lateVendorShare = clamp((ctx.vendorOnboardingDays / 3) * 0.14, 0.02, 0.5);
      break;
    }

    /* ---- Indirect Tax ---------------------------------------------- */
    case "idt": {
      ctx.filingOnTimeRate =
        comp("idt-sla-filing") ?? round2(clamp(q.filingOnTimeRate + d * 0.3, 80, 100));
      ctx.eInvoiceSuccessRate =
        comp("idt-sla-einvoice") ?? round2(clamp(q.eInvoiceSuccessRate + d * 0.12, 80, 100));
      ctx.inputCreditMatchRate =
        comp("idt-sla-itc") ?? round2(clamp(q.inputCreditMatchRate + d * 0.6, 80, 100));
      ctx.noticeResponseDays = round2(Math.max(0.5, q.noticeResponseDays - d * 0.5));
      ctx.avgTurnaroundDays = round2(Math.max(0.5, q.avgTurnaroundDays - d * 0.22));
      ctx.exceptionRate = round2(clamp(q.exceptionRate - d * 0.18, 0.2, 12));
      ctx.lateFilingShare = (100 - ctx.filingOnTimeRate) / 100;
      ctx.eInvoiceFailShare = (100 - ctx.eInvoiceSuccessRate) / 100;
      ctx.itcUnmatchedShare = (100 - ctx.inputCreditMatchRate) / 100;
      ctx.lateNoticeShare = clamp((ctx.noticeResponseDays / 5) * 0.18, 0.02, 0.6);
      ctx.lateQueryShare = clamp((ctx.avgTurnaroundDays / 4) * 0.15, 0.02, 0.6);
      break;
    }

    /* ---- Direct Tax ------------------------------------------------- */
    case "dt": {
      ctx.tdsOnTimeRate = comp("dt-sla-tds") ?? round2(clamp(q.tdsOnTimeRate + d * 0.3, 80, 100));
      ctx.certOnTimeRate = comp("dt-sla-cert") ?? round2(clamp(q.certOnTimeRate + d * 0.4, 80, 100));
      ctx.assessmentResponseDays = round2(Math.max(0.5, q.assessmentResponseDays - d * 0.5));
      ctx.avgTurnaroundDays = round2(Math.max(0.5, q.avgTurnaroundDays - d * 0.22));
      ctx.exceptionRate = round2(clamp(q.exceptionRate - d * 0.16, 0.2, 12));
      ctx.taxProvisionAccuracy = round2(clamp(q.taxProvisionAccuracy + d * 0.25, 80, 100));
      ctx.lateFilingShare = (100 - ctx.tdsOnTimeRate) / 100;
      ctx.lateCertShare = (100 - ctx.certOnTimeRate) / 100;
      ctx.lateAssessmentShare = clamp((ctx.assessmentResponseDays / 7) * 0.2, 0.02, 0.6);
      ctx.lateQueryShare = clamp((ctx.avgTurnaroundDays / 4) * 0.15, 0.02, 0.6);
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

/**
 * Fallback for `KpiSpec`s whose `metricKey` has no entry in the derived
 * quality context — the bulk raw-KPI list imported from the customer's
 * existing KPI tracker, which has no per-item volume driver to hang a real
 * ctx formula off. Deterministically seeded per entity + spec, so it is
 * stable across renders and still varies meaningfully with `entity.opsDelta`
 * the same way every hand-tuned ctx metric does — a structurally weaker
 * entity drifts more of its raw KPIs into warn/bad, not just the flagship
 * ones.
 */
function syntheticActual(spec: KpiSpec, entity: Entity): number {
  const d = entity.opsDelta;
  const j = jitter(`raw-actual-${entity.id}-${spec.id}`);
  const sign = spec.direction === "higher-better" ? 1 : -1;

  if (spec.unit === "percent") {
    const base = spec.target + sign * 2.2;
    const lo = clamp(spec.target - 22, 0, 95);
    const hi = clamp(spec.target + 22, 5, 100);
    return clamp(base + sign * d * 1.1 + j * 2.6, lo, hi);
  }
  if (spec.unit === "days" || spec.unit === "hours") {
    const margin = Math.max(0.2, spec.target * 0.12);
    const base = Math.max(0.1, spec.target - margin);
    return Math.max(0.1, base - d * (spec.target * 0.05) + j * Math.max(0.3, spec.target * 0.16));
  }
  const margin = Math.max(0.5, spec.target * 0.25);
  const base = Math.max(0, spec.target - margin);
  return Math.max(0, base - d * (spec.target * 0.06) + j * Math.max(0.5, spec.target * 0.3));
}

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
    const resolved = ctx[spec.metricKey];
    const actual = round2(resolved ?? syntheticActual(spec, entity));
    const status = gradeAgainstTarget(actual, spec.target, spec.direction, spec.amberBandPct / 100);

    const series = period.months.map((mo, m) => {
      const drift = (m - cur) * (spec.direction === "higher-better" ? 0.35 : -0.02) * (actual * 0.012);
      const noise = jitter(`kpi-${entity.id}-${spec.id}-${m}`) * actual * spec.volatility;
      let v = actual + drift + noise;
      if (spec.unit === "percent") v = clamp(v, 0, 100);
      if (spec.unit === "score") v = clamp(v, 1, 5);
      if (spec.unit === "days" || spec.unit === "ratio" || spec.unit === "hours") v = Math.max(0.1, v);
      if (spec.unit === "number") v = Math.max(0, v);
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
      subServiceId: spec.subServiceId,
      group: spec.group,
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
  const csatByService = services.map((s) => {
    const gap = (slas[s]?.overall ?? SLA_BASELINE[s]) - SLA_BASELINE[s];
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

/**
 * The control tower.
 *
 * Automation is delivered inside the towers, so the fleet is assembled per
 * service: each service licenses `<service>-botlic` runtimes and bills for
 * `<service>-bottxn` transactions, and its own bots share that volume out
 * between them. Summing back up gives a tower that reconciles, per service,
 * to the lines on the invoice.
 */
function buildAutomation(
  entity: Entity,
  period: Period,
  services: ServiceId[],
  volumes: Record<string, ServiceVolumes>,
  billings: Record<string, ServiceBilling>,
): AutomationSnapshot {
  const bots: Bot[] = [];
  /** Automated transactions per fiscal month, summed across all towers. */
  const monthlyTxn = period.months.map(() => 0);
  let automationCostMonth = 0;

  for (const s of services) {
    const vols = volumes[s];
    const cur = vols.currentIndex;
    const licences = vols.txn[botLicenceLineId(s)][cur];
    const txnVolume = vols.txn[botTxnLineId(s)][cur];

    for (let m = 0; m < monthlyTxn.length; m++) {
      monthlyTxn[m] += vols.txn[botTxnLineId(s)][m];
    }

    const lines = billings[s].txnLines;
    automationCostMonth +=
      (lines.find((l) => l.id === botLicenceLineId(s))?.amount ?? 0) +
      (lines.find((l) => l.id === botTxnLineId(s))?.amount ?? 0);

    // The licensed runtimes are the highest-value bots in that tower.
    const pool = BOT_FLEET.filter((b) => b.serviceId === s).sort((a, b) => b.share - a.share);
    const roster = pool.slice(0, clamp(licences, 1, pool.length));
    const txnSplit = distribute(
      txnVolume,
      roster.map((b) => b.share),
    );

    roster.forEach((spec, i) => {
      const transactions = txnSplit[i];
      const jobs = Math.max(1, Math.round(transactions / spec.itemsPerJob));
      const failedJobs = Math.round((jobs * (100 - spec.successRate)) / 100);
      bots.push({
        id: `${entity.id}-${spec.key}`,
        name: spec.name,
        kind: spec.kind,
        process: spec.process,
        serviceId: spec.serviceId,
        subServiceId: spec.subServiceId,
        status: spec.status,
        jobs,
        failedJobs,
        successRate: round2(((jobs - failedJobs) / jobs) * 100),
        transactions,
        hoursSaved: Math.round((transactions * spec.minutesSavedPerTxn) / 60),
        avgRuntimeMin: spec.avgRuntimeMin,
        lastRun: `${spec.lastRunHoursAgo}h ago`,
        owner: spec.owner,
      });
    });
  }

  bots.sort((a, b) => b.transactions - a.transactions);

  const totalJobs = sum(bots.map((b) => b.jobs));
  const failedJobs = sum(bots.map((b) => b.failedJobs));
  const successfulJobs = totalJobs - failedJobs;
  const successRate = round2((successfulJobs / Math.max(1, totalJobs)) * 100);

  const totalTxn = sum(bots.map((b) => b.transactions));
  const hoursSavedMonth = sum(bots.map((b) => b.hoursSaved));
  // Hours track automated volume, so the monthly shape is the volume shape.
  const hoursPerTxn = hoursSavedMonth / Math.max(1, totalTxn);
  const monthlyHoursSaved = period.months.map((mo, m) => ({
    short: mo.short,
    value: Math.round(monthlyTxn[m] * hoursPerTxn),
    isActual: mo.isActual,
  }));
  const hoursSavedYtd = sum(monthlyHoursSaved.filter((m) => m.isActual).map((m) => m.value));

  const blendedHourlyCost = AUTOMATION_PLATFORM.blendedHourlyCost;
  const costSavingMonth = hoursSavedMonth * blendedHourlyCost;
  const costSavingYtd = hoursSavedYtd * blendedHourlyCost;
  const roi = round2(costSavingMonth / Math.max(1, automationCostMonth));

  const pipeline = AUTOMATION_PIPELINE.map((p) => ({
    ...p,
    estHoursMonth: Math.max(8, Math.round(p.estHoursMonth * entity.scale)),
  }));

  return {
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
    exceptions: Math.max(1, Math.round(totalTxn * AUTOMATION_PLATFORM.exceptionRatePerTxn)),
    hoursSavedMonth,
    hoursSavedYtd,
    costSavingMonth,
    costSavingYtd,
    automationCostMonth,
    netValueMonth: costSavingMonth - automationCostMonth,
    roi,
    blendedHourlyCost,
    monthlyHoursSaved,
    automationCoverage:
      clamp(AUTOMATION_PLATFORM.automationCoverage + entity.opsDelta * 2.5, 15, 95) / 100,
    pipeline,
  };
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

/**
 * Analytics is a capability, not a contracted tower: the SSC builds these
 * products on the transaction data the five towers already process, so the
 * footprint scales with the size of the entity rather than with a billed
 * volume. Nothing here appears on the invoice.
 */
function buildAnalytics(entity: Entity, period: Period, fin: FinancialContext): AnalyticsSnapshot {
  /** Products name their headline by key; only numeric fields are valid. */
  const finNumber = (key: string): number => {
    const v = (fin as unknown as Record<string, unknown>)[key];
    return typeof v === "number" ? v : 0;
  };
  const f = getPeriodDefinition(period.id).volumeFactor * entity.scale;

  const productCount = clamp(
    Math.round(ANALYTICS_FOOTPRINT.products * (0.45 + 0.55 * entity.scale)),
    3,
    ANALYTICS_PRODUCTS.length,
  );
  const specs = [...ANALYTICS_PRODUCTS].sort((a, b) => a.rank - b.rank).slice(0, productCount);

  const totalReports = Math.max(4, Math.round(ANALYTICS_FOOTPRINT.reports * f));
  const totalInsights = Math.max(8, Math.round(ANALYTICS_FOOTPRINT.insights * f));
  const activeUsers = Math.max(6, Math.round(ANALYTICS_FOOTPRINT.activeUsers * f));

  const reportSplit = distribute(totalReports, specs.map((s) => s.reports));
  const insightSplit = distribute(totalInsights, specs.map((s) => s.insights));

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
    valueIdentified: sum(specs.map((s) => s.valueIdentified)) * f,
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
      return seriesFor(["fna-ap"], "Supplier invoices processed", "invoices");
    case "hrops":
      return seriesFor(["hrops-payroll"], "Payroll records processed", "payslips");
    case "procurement":
      return seriesFor(["proc-pr"], "Requisitions converted to purchase orders", "requisitions");
    case "idt":
      return seriesFor(["idt-einvoice"], "E-invoices & e-way bills generated", "documents");
    default:
      return seriesFor(["dt-cert"], "TDS certificates issued", "certificates");
  }
}

const PENDING_SHARE: Record<ServiceId, number> = {
  fna: 0.047,
  hrops: 0.031,
  procurement: 0.042,
  idt: 0.026,
  dt: 0.048,
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
): { headline: ActivityMetric[]; overview: ActivityMetric[] } {
  const cur = vols.currentIndex;
  const actualSeries = activity.series.filter((s) => s.isActual).map((s) => s.value);
  const ytdVolume = sum(actualSeries);
  const ytdCaption = `${vols.actualCount} months to ${period.asOf}`;
  const monthCaption = billing.currentMonthLabel;

  const v = (id: string) => vols.txn[id]?.[cur] ?? 0;
  const ytdOf = (id: string) => sum((vols.txn[id] ?? []).filter((_, m) => period.months[m].isActual));
  const slaMetric = (): ActivityMetric => ({
    id: "sla",
    label: "SLA achievement",
    value: sla.overall,
    format: "percent",
    direction: "higher-better",
  });
  const billingMetric = (): ActivityMetric => ({
    id: "billing",
    label: "Billing",
    value: billing.currentTotal,
    format: "currency",
    caption: monthCaption,
  });

  switch (serviceId) {
    /* ---- F&A: AP · AR · Travel · Record to Report · Treasury ------- */
    case "fna": {
      const invoices = v("fna-ap");
      return {
        headline: [
          { id: "invoices", label: "Invoices processed (AP)", value: invoices, format: "number", caption: monthCaption, series: actualSeries },
          slaMetric(),
          billingMetric(),
        ],
        overview: [
          { id: "invoices", label: "Supplier invoices processed (AP)", value: invoices, format: "number", caption: monthCaption, series: actualSeries },
          { id: "invoice-value", label: "Invoice value processed", value: invoices * AVG_INVOICE_VALUE, format: "currency", caption: monthCaption },
          { id: "tat", label: "Average processing time", value: ctx.avgProcessingDays, format: "days", direction: "lower-better" },
          { id: "rejection", label: "Rejection rate", value: ctx.rejectionRate, format: "percent", direction: "lower-better" },
          slaMetric(),
          { id: "ar", label: "Customer invoices raised (AR)", value: v("fna-ar"), format: "number", caption: monthCaption },
          { id: "collection", label: "Collection effectiveness (AR)", value: ctx.collectionEffectiveness, format: "percent", direction: "higher-better" },
          { id: "travel", label: "Travel & expense claims settled", value: v("fna-travel"), format: "number", caption: monthCaption },
          { id: "r2r", label: "Journals & reconciliations (R2R)", value: v("fna-r2r"), format: "number", caption: monthCaption },
          { id: "close", label: "Month-end close cycle", value: ctx.closeCycleDays, format: "days", direction: "lower-better" },
          { id: "treasury", label: "Payments & bank reconciliations", value: v("fna-treasury"), format: "number", caption: monthCaption },
          { id: "ytd", label: "Invoices processed (YTD)", value: ytdVolume, format: "number", caption: ytdCaption },
        ],
      };
    }

    /* ---- HR Ops: TA · Payroll · L&D · Core HR ---------------------- */
    case "hrops": {
      const openPositions = stockValue("hrops", "openPositions", entity, period);
      const inProgress = stockValue("hrops", "positionsInProgress", entity, period);
      const closedYtd = ytdOf("hrops-ta");
      return {
        headline: [
          { id: "payroll", label: "Payroll records processed", value: v("hrops-payroll"), format: "number", caption: monthCaption, series: actualSeries },
          slaMetric(),
          billingMetric(),
        ],
        overview: [
          { id: "payroll", label: "Payroll records processed", value: v("hrops-payroll"), format: "number", caption: monthCaption, series: actualSeries },
          { id: "payroll-acc", label: "Payroll accuracy", value: ctx.payrollAccuracy, format: "percent", direction: "higher-better" },
          { id: "open-positions", label: "Open positions (TA)", value: openPositions, format: "number" },
          { id: "in-progress", label: "Positions in progress", value: inProgress, format: "number" },
          { id: "closed", label: "Mandates closed (YTD)", value: closedYtd, format: "number", caption: ytdCaption },
          { id: "tth", label: "Time to hire", value: ctx.timeToHireDays, format: "days", direction: "lower-better" },
          slaMetric(),
          { id: "lnd", label: "Learning enrolments", value: v("hrops-lnd"), format: "number", caption: monthCaption },
          { id: "lnd-completion", label: "Learning completion rate", value: ctx.trainingCompletionRate, format: "percent", direction: "higher-better" },
          { id: "core", label: "Lifecycle & helpdesk cases", value: v("hrops-core"), format: "number", caption: monthCaption },
          { id: "candidate", label: "Candidate feedback", value: ctx.candidateExperience, format: "score", direction: "higher-better" },
          { id: "offers", label: "Offers pending acceptance", value: stockValue("hrops", "offersPending", entity, period), format: "number" },
        ],
      };
    }

    /* ---- Procurement & Contracts ----------------------------------- */
    case "procurement": {
      const requisitions = v("proc-pr");
      return {
        headline: [
          { id: "pos", label: "Purchase orders raised", value: requisitions, format: "number", caption: monthCaption, series: actualSeries },
          slaMetric(),
          billingMetric(),
        ],
        overview: [
          { id: "pos", label: "Requisitions converted to POs", value: requisitions, format: "number", caption: monthCaption, series: actualSeries },
          { id: "po-value", label: "Purchase order value released", value: requisitions * AVG_PO_VALUE, format: "currency", caption: monthCaption },
          { id: "cycle", label: "Requisition to purchase order", value: ctx.prToPoDays, format: "days", direction: "lower-better" },
          { id: "rfx", label: "Sourcing events run", value: v("proc-rfx"), format: "number", caption: monthCaption },
          { id: "savings", label: "Realised savings rate", value: ctx.savingsRate, format: "percent", direction: "higher-better" },
          slaMetric(),
          { id: "contracts", label: "Contracts drafted & renewed", value: v("proc-contract"), format: "number", caption: monthCaption },
          { id: "expiring", label: "Contracts expiring in 90 days", value: stockValue("procurement", "contractsExpiring90", entity, period), format: "number", direction: "lower-better" },
          { id: "vendors", label: "Vendor records maintained", value: v("proc-vendor"), format: "number", caption: monthCaption },
          { id: "vendor-tat", label: "Vendor onboarding turnaround", value: ctx.vendorOnboardingDays, format: "days", direction: "lower-better" },
          { id: "sum", label: "Spend under management", value: ctx.spendUnderManagementPct, format: "percent", direction: "higher-better" },
          { id: "maverick", label: "Maverick spend", value: ctx.maverickSpendRate, format: "percent", direction: "lower-better" },
        ],
      };
    }

    /* ---- Indirect Tax ---------------------------------------------- */
    case "idt": {
      return {
        headline: [
          { id: "einvoice", label: "E-invoices generated", value: v("idt-einvoice"), format: "number", caption: monthCaption, series: actualSeries },
          slaMetric(),
          billingMetric(),
        ],
        overview: [
          { id: "returns", label: "GST returns filed", value: v("idt-return"), format: "number", caption: monthCaption },
          { id: "ontime", label: "Returns filed on time", value: ctx.filingOnTimeRate, format: "percent", direction: "higher-better" },
          { id: "einvoice", label: "E-invoices & e-way bills", value: v("idt-einvoice"), format: "number", caption: monthCaption, series: actualSeries },
          { id: "einvoice-rate", label: "E-invoice generation success", value: ctx.eInvoiceSuccessRate, format: "percent", direction: "higher-better" },
          slaMetric(),
          { id: "itc", label: "Input credit lines reconciled", value: v("idt-itc"), format: "number", caption: monthCaption },
          { id: "itc-rate", label: "Input credit match rate", value: ctx.inputCreditMatchRate, format: "percent", direction: "higher-better" },
          { id: "unmatched", label: "Unmatched input credit", value: stockValue("idt", "unmatchedItcValue", entity, period), format: "currency", direction: "lower-better" },
          { id: "notices", label: "Notices & assessments handled", value: v("idt-notice"), format: "number", caption: monthCaption },
          { id: "notice-tat", label: "Notice response time", value: ctx.noticeResponseDays, format: "days", direction: "lower-better" },
          { id: "advisory", label: "Advisory queries closed", value: v("idt-advisory"), format: "number", caption: monthCaption },
          { id: "litigation", label: "Open GST litigation matters", value: stockValue("idt", "openIdtLitigation", entity, period), format: "number", direction: "lower-better" },
        ],
      };
    }

    /* ---- Direct Tax ------------------------------------------------- */
    default: {
      return {
        headline: [
          { id: "certs", label: "TDS certificates issued", value: v("dt-cert"), format: "number", caption: monthCaption, series: actualSeries },
          slaMetric(),
          billingMetric(),
        ],
        overview: [
          { id: "certs", label: "TDS certificates issued", value: v("dt-cert"), format: "number", caption: monthCaption, series: actualSeries },
          { id: "cert-ontime", label: "Certificates issued on time", value: ctx.certOnTimeRate, format: "percent", direction: "higher-better" },
          { id: "returns", label: "Returns & statements filed", value: v("dt-return"), format: "number", caption: monthCaption },
          { id: "tds-ontime", label: "Deposits & statements on time", value: ctx.tdsOnTimeRate, format: "percent", direction: "higher-better" },
          slaMetric(),
          { id: "assessments", label: "Assessments & notices handled", value: v("dt-assessment"), format: "number", caption: monthCaption },
          { id: "assessment-tat", label: "Assessment response time", value: ctx.assessmentResponseDays, format: "days", direction: "lower-better" },
          { id: "open-assessments", label: "Open assessments", value: stockValue("dt", "openAssessments", entity, period), format: "number", direction: "lower-better" },
          { id: "tp", label: "Transfer pricing sets", value: v("dt-tp"), format: "number", caption: monthCaption },
          { id: "advisory", label: "Advisory queries closed", value: v("dt-advisory"), format: "number", caption: monthCaption },
          { id: "tat", label: "Advisory query turnaround", value: ctx.avgTurnaroundDays, format: "days", direction: "lower-better" },
          { id: "disputed", label: "Disputed tax under appeal", value: stockValue("dt", "disputedTaxValue", entity, period), format: "currency", direction: "lower-better" },
          { id: "certs-ytd", label: "Certificates issued (YTD)", value: ytdVolume, format: "number", caption: ytdCaption },
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
        detail: `${trouble.map((b) => `${b.name} (${SERVICE_MAP[b.serviceId].code})`).join(", ")} ${trouble.length > 1 ? "are" : "is"} running below the 97% job success threshold. Affected work has reverted to manual processing.`,
        serviceId: trouble[0].serviceId,
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

  /* 2 — the cross-cutting capabilities, which read the towers' volumes. */
  const fin = financialContext(entity, period);
  const automation: AutomationSnapshot | null =
    services.length > 0 ? buildAutomation(entity, period, services, volumes, billings) : null;
  const analytics: AnalyticsSnapshot | null =
    services.length > 0 ? buildAnalytics(entity, period, fin) : null;

  /* 3 — SLA per tower, decomposed into its named sub-services. */
  const slas: Record<string, ServiceSla> = {};
  for (const s of services) {
    slas[s] = buildSla(entity, s, period, {});
  }

  /* 4 — issues and feedback, allocated by service billing mix. */
  const issues = buildIssues(entity, period, services, mix);
  const feedback = buildFeedback(entity, period, services, mix);

  /* 5 — service snapshots. */
  const serviceSnapshots: ServiceSnapshot[] = services.map((s) => {
    const vols = volumes[s];
    const sla = slas[s];
    const ctx = buildMetricContext(entity, s, period, vols, sla);
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
