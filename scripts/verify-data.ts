/**
 * Data reconciliation check.
 *
 * The brief for this prototype was explicit: the numbers must relate to each
 * other, not be plausible-looking noise. This script asserts the identities
 * the model claims to hold. Run it with `npm run verify:data`.
 */

import { buildEntitySnapshot } from "../src/lib/mock/engine";
import { ENTITIES, SERVICES } from "../src/lib/mock/organisation";
import { BLUEPRINTS, botLicenceLineId, botTxnLineId } from "../src/lib/mock/rate-cards";
import { DEFAULT_PERIOD_ID, getPeriod } from "../src/lib/mock/calendar";
import { formatMoney, formatNumber } from "../src/lib/format";

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail: string) {
  checks++;
  if (condition) {
    console.log(`  [32m✓[0m ${label} [90m${detail}[0m`);
  } else {
    failures++;
    console.log(`  [31m✗ ${label}[0m ${detail}`);
  }
}

const near = (a: number, b: number, tolerance = 0.5) => Math.abs(a - b) <= tolerance;

console.log("\n[1mSSC Customer Portal — data reconciliation[0m");

/* ================================================================== */
/* 1. Billing must equal volume × rate, line by line                   */
/* ================================================================== */

console.log("\n[1m1. Billing reconciles to the rate card[0m");

for (const entity of ENTITIES) {
  const snap = buildEntitySnapshot(entity.id, DEFAULT_PERIOD_ID);
  for (const svc of snap.services) {
    const b = svc.billing;
    const txnFromLines = b.txnLines.reduce((a, l) => a + l.volume * l.rate, 0);
    const fteFromLines = b.fteLines.reduce((a, l) => a + l.fte * l.ratePerFte, 0);
    if (!near(txnFromLines, b.txnTotal, 1) || !near(fteFromLines, b.fteTotal, 1)) {
      check(
        `${entity.shortName} / ${svc.service.code} line totals`,
        false,
        `txn ${txnFromLines} vs ${b.txnTotal}, fte ${fteFromLines} vs ${b.fteTotal}`,
      );
    }
    if (!near(b.txnTotal + b.fteTotal, b.currentTotal, 1)) {
      check(`${entity.shortName} / ${svc.service.code} month total`, false, "txn + fte ≠ total");
    }
    const monthlySum = b.monthly.reduce((a, m) => a + m.total, 0);
    if (!near(monthlySum, b.fyForecast, 1)) {
      check(`${entity.shortName} / ${svc.service.code} FY total`, false, "Σ months ≠ FY forecast");
    }
  }
}
check(
  "Every service, every entity: Σ(volume × rate) + Σ(FTE × rate) = billed total",
  failures === 0,
  `${ENTITIES.length} entities checked`,
);

/* ================================================================== */
/* 2. The worked example from the brief                                */
/* ================================================================== */

console.log("\n[1m2. The brief's worked example (DIAL, F&A, Aug FY27)[0m");

const dial = buildEntitySnapshot("dial", DEFAULT_PERIOD_ID);
const fna = dial.services.find((s) => s.service.id === "fna")!;
const apLine = fna.billing.txnLines.find((l) => l.id === "fna-ap")!;

check(
  "Supplier invoices processed = 10,240",
  apLine.volume === 10_240,
  formatNumber(apLine.volume),
);
check("Charge per invoice = ₹100", apLine.rate === 100, `₹${apLine.rate}`);
check(
  "Invoice line billing = ₹10.24 L",
  near(apLine.amount, 10_24_000, 1),
  formatMoney(apLine.amount),
);
check(
  "Invoice value processed ≈ ₹18.4 Cr",
  near(apLine.volume * 17_969, 18.4e7, 0.06e7),
  formatMoney(apLine.volume * 17_969),
);

/* ================================================================== */
/* 3. Entity roll-ups equal the sum of their services                  */
/* ================================================================== */

console.log("\n[1m3. Roll-ups equal the sum of their parts[0m");

const svcFy = dial.services.reduce((a, s) => a + s.billing.fyForecast, 0);
const svcYtd = dial.services.reduce((a, s) => a + s.billing.ytd, 0);
check("FY billing = Σ service FY billing", near(svcFy, dial.billing.fyForecast, 1), formatMoney(svcFy));
check("YTD billing = Σ service YTD billing", near(svcYtd, dial.billing.ytd, 1), formatMoney(svcYtd));
check(
  "Service mix sums to 100%",
  near(dial.services.reduce((a, s) => a + s.billing.mix, 0), 1, 0.0001),
  `${(dial.services.reduce((a, s) => a + s.billing.mix, 0) * 100).toFixed(2)}%`,
);
check(
  "Charging model split = FY total",
  near(dial.billing.modelSplit.txn + dial.billing.modelSplit.fte, dial.billing.fyForecast, 1),
  `${formatMoney(dial.billing.modelSplit.txn)} transaction + ${formatMoney(dial.billing.modelSplit.fte)} FTE`,
);

/* ================================================================== */
/* 4. SLA is a genuine weighted roll-up                                */
/* ================================================================== */

console.log("\n[1m4. SLA decomposes correctly[0m");

for (const svc of dial.services) {
  const weighted = svc.sla.components.reduce((a, c) => a + c.actual * c.weight, 0);
  const weightSum = svc.sla.components.reduce((a, c) => a + c.weight, 0);
  check(
    `${svc.service.code} SLA = Σ(component × weight)`,
    near(weighted, svc.sla.overall, 0.02) && near(weightSum, 1, 0.001),
    `${svc.sla.overall.toFixed(2)}% from ${svc.sla.components.length} sub-services`,
  );
}

check(
  "Every sub-service has exactly one SLA component, and vice versa",
  SERVICES.every((s) => {
    const componentIds = new Set(dial.services.find((x) => x.service.id === s.id)
      ? dial.services.find((x) => x.service.id === s.id)!.sla.components.map((c) => c.id)
      : []);
    return (
      componentIds.size === s.subServices.length &&
      s.subServices.every((sub) => componentIds.has(sub.slaComponentId))
    );
  }),
  SERVICES.map((s) => `${s.code} ${s.subServices.length}`).join(" · "),
);

const entityWeighted = dial.services.reduce((a, s) => a + s.sla.overall * s.billing.mix, 0);
check(
  "Overall SLA = billing-weighted service SLA",
  near(entityWeighted, dial.sla.overall, 0.02),
  `${dial.sla.overall.toFixed(2)}%`,
);

/* ================================================================== */
/* 5. KPIs agree with the volumes and SLA components                   */
/* ================================================================== */

console.log("\n[1m5. KPIs agree with service activity[0m");

const fnaSlaKpi = fna.kpis.find((k) => k.id === "fna-kpi-sla")!;
check(
  "F&A 'SLA achievement' KPI = F&A SLA roll-up",
  near(fnaSlaKpi.actual, fna.sla.overall, 0.02),
  `${fnaSlaKpi.actual}%`,
);

const rejectKpi = fna.kpis.find((k) => k.id === "fna-kpi-reject")!;
check(
  "Rejection KPI volume = rejection rate × invoices",
  near(rejectKpi.affectedVolume!.count, apLine.volume * (rejectKpi.actual / 100), 2),
  `${formatNumber(rejectKpi.affectedVolume!.count)} of ${formatNumber(apLine.volume)} at ${rejectKpi.actual}%`,
);

const hr = dial.services.find((s) => s.service.id === "hrops")!;
const taKpi = hr.kpis.find((k) => k.id === "hrops-kpi-ta-sla")!;
const taComponent = hr.sla.components.find((c) => c.id === "hrops-sla-ta")!;
check(
  "HR Ops 'talent acquisition SLA' KPI = its SLA component",
  near(taKpi.actual, taComponent.actual, 0.02),
  `${taKpi.actual}% (target ${taKpi.target}%)`,
);

const idt = dial.services.find((s) => s.service.id === "idt")!;
const itcKpi = idt.kpis.find((k) => k.id === "idt-kpi-itc")!;
const itcComponent = idt.sla.components.find((c) => c.id === "idt-sla-itc")!;
check(
  "IDT 'input credit match rate' KPI = its SLA component",
  near(itcKpi.actual, itcComponent.actual, 0.02),
  `${itcKpi.actual}% (target ${itcKpi.target}%)`,
);

check(
  "Every KPI naming a sub-service points at a real one in its tower",
  dial.services.every((s) =>
    s.kpis
      .filter((k) => k.subServiceId)
      .every((k) => s.service.subServices.some((sub) => sub.id === k.subServiceId)),
  ),
  `${dial.services.reduce((acc, s) => acc + s.kpis.length, 0)} KPIs across ${dial.services.length} towers`,
);

/* ================================================================== */
/* 6. The control tower ties to the towers that pay for it             */
/* ================================================================== */

console.log("\n[1m6. Automation control tower ties to its invoice[0m");

const a = dial.automation!;

const licenceVolume = (s: (typeof dial.services)[number]) =>
  s.billing.txnLines.find((l) => l.id === botLicenceLineId(s.service.id))?.volume ?? 0;
const botTxnVolume = (s: (typeof dial.services)[number]) =>
  s.billing.txnLines.find((l) => l.id === botTxnLineId(s.service.id))?.volume ?? 0;
const botFee = (s: (typeof dial.services)[number]) =>
  (s.billing.txnLines.find((l) => l.id === botLicenceLineId(s.service.id))?.amount ?? 0) +
  (s.billing.txnLines.find((l) => l.id === botTxnLineId(s.service.id))?.amount ?? 0);

const licensedBots = dial.services.reduce((acc, s) => acc + licenceVolume(s), 0);
const billedBotTxns = dial.services.reduce((acc, s) => acc + botTxnVolume(s), 0);
const billedAutomationFee = dial.services.reduce((acc, s) => acc + botFee(s), 0);

check(
  "Bots in the control tower = runtime licences billed",
  a.totalBots === licensedBots,
  `${a.totalBots} bots`,
);
check(
  "Σ bot transactions = bot transactions billed",
  a.bots.reduce((s, b) => s + b.transactions, 0) === billedBotTxns,
  formatNumber(billedBotTxns),
);
check(
  "Per-tower bot counts match per-tower licences",
  dial.services.every(
    (s) => a.bots.filter((b) => b.serviceId === s.service.id).length === licenceVolume(s),
  ),
  dial.services
    .map((s) => `${s.service.code} ${a.bots.filter((b) => b.serviceId === s.service.id).length}`)
    .join(" · "),
);
check(
  "Every bot belongs to a real sub-service of its tower",
  a.bots.every((b) =>
    dial.services
      .find((s) => s.service.id === b.serviceId)!
      .service.subServices.some((sub) => sub.id === b.subServiceId),
  ),
  `${a.bots.length} bots mapped to sub-services`,
);
check(
  "Automation fee = Σ digital workforce lines across the towers",
  near(a.automationCostMonth, billedAutomationFee, 1),
  formatMoney(a.automationCostMonth),
);
check(
  "ROI = cost saving ÷ automation fee",
  near(a.roi, a.costSavingMonth / a.automationCostMonth, 0.01),
  `${a.roi}×`,
);
check(
  "Cost saving = hours released × blended rate",
  near(a.costSavingMonth, a.hoursSavedMonth * a.blendedHourlyCost, 1),
  `${formatNumber(a.hoursSavedMonth)} hrs × ₹${a.blendedHourlyCost}`,
);
check(
  "Fleet success rate = (jobs − failures) ÷ jobs",
  near(a.successRate, ((a.totalJobs - a.failedJobs) / a.totalJobs) * 100, 0.02),
  `${a.successRate}%`,
);
check(
  "Monthly hours released reconcile to the reporting month",
  near(
    a.monthlyHoursSaved.find((m) => m.short === fna.billing.currentMonthLabel.split(" ")[0])?.value ?? -1,
    a.hoursSavedMonth,
    Math.max(2, a.hoursSavedMonth * 0.005),
  ),
  `${formatNumber(a.hoursSavedMonth)} hrs`,
);

/* ================================================================== */
/* 7. Analytics totals reconcile internally                            */
/* ================================================================== */

console.log("\n[1m7. Analytics totals reconcile internally[0m");

const anSnap = dial.analytics!;

check(
  "Σ per-product reports = total reports",
  anSnap.products.reduce((s, p) => s + p.reports, 0) === anSnap.totalReports,
  `${anSnap.totalReports}`,
);
check(
  "Σ per-product insights = total insights",
  anSnap.products.reduce((s, p) => s + p.insights, 0) === anSnap.totalInsights,
  `${anSnap.totalInsights} insights`,
);
const aero = anSnap.products.find((p) => p.name.startsWith("Aero"))!;
const nonAero = anSnap.products.find((p) => p.name.startsWith("Non-Aero"))!;
const totalRev = anSnap.products.find((p) => p.name === "Revenue Analytics")!;
check(
  "Aero + non-aero revenue = total revenue",
  near(aero.headlineValue + nonAero.headlineValue, totalRev.headlineValue, 1),
  `${formatMoney(aero.headlineValue)} + ${formatMoney(nonAero.headlineValue)} = ${formatMoney(totalRev.headlineValue)}`,
);

/* ================================================================== */
/* 8. Customer experience and issues derive from performance           */
/* ================================================================== */

console.log("\n[1m8. Experience and issues derive from performance[0m");

const npsQ = dial.cx.npsQuarters[dial.cx.npsQuarters.length - 1];
check(
  "NPS = %promoters − %detractors",
  near(npsQ.score, ((npsQ.promoters - npsQ.detractors) / npsQ.respondents) * 100, 0.6),
  `${npsQ.label}: ${npsQ.score >= 0 ? "+" : ""}${npsQ.score} from ${npsQ.respondents} responses`,
);
check(
  "Promoters + passives + detractors = respondents",
  npsQ.promoters + npsQ.passives + npsQ.detractors === npsQ.respondents,
  `${npsQ.respondents}`,
);
check(
  "Every open issue belongs to a consumed service",
  dial.issues.every((i) => dial.services.some((s) => s.service.id === i.serviceId)),
  `${dial.counts.openIssues} open, ${dial.counts.criticalIssues} critical`,
);
check(
  "Every KPI-linked issue points at a real KPI",
  dial.issues
    .filter((i) => i.linkedKpiId)
    .every((i) => dial.services.some((s) => s.kpis.some((k) => k.id === i.linkedKpiId))),
  "KPI → issue drill-down is intact",
);

const ghial = buildEntitySnapshot("ghial", DEFAULT_PERIOD_ID);
const ghialHr = ghial.services.find((s) => s.service.id === "hrops")!;
check(
  "GHIAL HR Ops SLA is materially below DIAL's (different entity, different story)",
  ghialHr.sla.overall < hr.sla.overall - 8,
  `GHIAL ${ghialHr.sla.overall.toFixed(1)}% vs DIAL ${hr.sla.overall.toFixed(1)}%`,
);
check(
  "Switching entity changes the billing",
  Math.abs(ghial.billing.fyForecast - dial.billing.fyForecast) > 1_00_00_000,
  `${ghial.entity.shortName} ${formatMoney(ghial.billing.fyForecast)} vs DIAL ${formatMoney(dial.billing.fyForecast)}`,
);

/* ================================================================== */
/* 9. Determinism                                                      */
/* ================================================================== */

console.log("\n[1m9. The model is deterministic[0m");

const a1 = JSON.stringify(buildEntitySnapshot("ghial", DEFAULT_PERIOD_ID));
const a2 = JSON.stringify(buildEntitySnapshot("ghial", DEFAULT_PERIOD_ID));
check("Rebuilding a snapshot produces identical output", a1 === a2, `${a1.length} chars`);

/* ================================================================== */
/* Headline summary                                                    */
/* ================================================================== */

const period = getPeriod(DEFAULT_PERIOD_ID);
console.log("\n[1mHeadline figures — Delhi International Airport, FY 2027[0m");
console.log(`  Period                ${period.range} (${period.actualMonthCount} months actual)`);
console.log(`  Total SSC billing     ${formatMoney(dial.billing.fyForecast)} (full-year forecast)`);
console.log(`  YTD billing           ${formatMoney(dial.billing.ytd)}`);
console.log(`  MoM change            ${dial.billing.momPct >= 0 ? "+" : ""}${dial.billing.momPct.toFixed(1)}%`);
console.log(`  Outstanding           ${formatMoney(dial.billing.outstanding)}`);
console.log(`  Overall SLA           ${dial.sla.overall.toFixed(1)}% (target ${dial.sla.target.toFixed(1)}%)`);
console.log(`  CSAT                  ${dial.cx.csat.toFixed(1)} / 5`);
console.log(`  NPS                   ${dial.cx.nps >= 0 ? "+" : ""}${dial.cx.nps}`);
console.log(`  Open issues           ${dial.counts.openIssues} (${dial.counts.criticalIssues} critical)`);
console.log("  Billing by service");
for (const s of dial.services) {
  console.log(
    `    ${s.service.code.padEnd(11)} ${formatMoney(s.billing.fyForecast).padStart(11)}   ${(
      s.billing.mix * 100
    ).toFixed(1).padStart(5)}%   SLA ${s.sla.overall.toFixed(1)}%`,
  );
}

const bpCount = Object.keys(BLUEPRINTS).length;
console.log(
  `\n[1m${checks - failures}/${checks} checks passed[0m across ${ENTITIES.length} entities and ${bpCount} service rate cards.\n`,
);

if (failures > 0) process.exit(1);
