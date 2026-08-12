import type { ServiceId } from "../domain/types";

/**
 * Contracted rate cards and demand curves.
 *
 * This file is the single source of truth for *how much work happens* and
 * *what it costs*. Every rupee shown anywhere in the portal is
 *
 *     volume(month) × rate      +      FTE(month) × rate per FTE
 *
 * and every volume shown anywhere is the same `volume(month)`. Nothing is
 * hardcoded downstream, so the numbers cannot drift apart.
 *
 * `baseVolume` / `baseFte` are stated for the flagship entity (DIAL, scale
 * 1.00) in the current reporting month (Nov of FY 2026). Other entities and
 * months are derived by multiplying through `scale`, `seasonality` and
 * `fteRamp`.
 */

export interface TxnLineSpec {
  id: string;
  label: string;
  unit: string;
  unitPlural: string;
  baseVolume: number;
  rate: number;
  sourceSystem: string;
  /** Platform-style fees: same volume for every entity, every month. */
  fixed?: boolean;
}

export interface FteLineSpec {
  id: string;
  role: string;
  baseFte: number;
  ratePerFte: number;
}

/** Stock metrics (point-in-time counts) rather than monthly flows. */
export interface StockSpec {
  id: string;
  base: number;
}

export interface ServiceBlueprint {
  serviceId: ServiceId;
  txn: TxnLineSpec[];
  fte: FteLineSpec[];
  /** 12 fiscal months, Apr→Mar. Index 7 (Nov) is normalised to 1.000. */
  seasonality: number[];
  fteRamp: number[];
  /** FY actual-vs-budget variance target, in %. Positive = over budget. */
  budgetVariancePct: number;
  stocks: StockSpec[];
  /** Service quality baseline at DIAL, before `opsDelta`. */
  quality: Record<string, number>;
}

/* Ratios that convert volume into value/quality figures. */
export const AVG_INVOICE_VALUE = 179_700;

export const BLUEPRINTS: Record<ServiceId, ServiceBlueprint> = {
  /* ---------------------------------------------------------------- */
  fna: {
    serviceId: "fna",
    txn: [
      {
        id: "fna-ap",
        label: "Supplier invoices processed",
        unit: "invoice",
        unitPlural: "invoices",
        baseVolume: 10_240,
        rate: 100,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "fna-expense",
        label: "Employee expense claims settled",
        unit: "claim",
        unitPlural: "claims",
        baseVolume: 3_120,
        rate: 45,
        sourceSystem: "SAP Concur",
      },
      {
        id: "fna-ar",
        label: "Customer invoices raised",
        unit: "invoice",
        unitPlural: "invoices",
        baseVolume: 2_260,
        rate: 85,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "fna-gl",
        label: "GL journals & reconciliations",
        unit: "entry",
        unitPlural: "entries",
        baseVolume: 1_480,
        rate: 120,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "fna-md",
        label: "Vendor master records maintained",
        unit: "record",
        unitPlural: "records",
        baseVolume: 640,
        rate: 60,
        sourceSystem: "SAP MDG",
      },
    ],
    fte: [
      { id: "fna-fte-ap", role: "Accounts Payable Operations", baseFte: 8, ratePerFte: 105_000 },
      { id: "fna-fte-gl", role: "General Ledger & Reporting", baseFte: 6, ratePerFte: 145_000 },
      { id: "fna-fte-ar", role: "Accounts Receivable & Collections", baseFte: 4, ratePerFte: 120_000 },
      { id: "fna-fte-fpa", role: "FP&A / Management Reporting", baseFte: 3, ratePerFte: 185_000 },
      { id: "fna-fte-md", role: "Master Data Management", baseFte: 2, ratePerFte: 95_000 },
    ],
    // Steady growth with a visible October dip and a March year-end spike.
    seasonality: [0.842, 0.858, 0.877, 0.869, 0.901, 0.933, 0.918, 1.0, 1.014, 1.037, 1.055, 1.134],
    // A three-FTE uplift lands on 1 November. Together with the invoice
    // volume recovery it gives the November bill a genuine, explainable jump.
    fteRamp: [0.83, 0.83, 0.87, 0.87, 0.87, 0.87, 0.87, 1.0, 1.0, 1.0, 1.04, 1.04],
    budgetVariancePct: 3.4,
    stocks: [
      { id: "openExceptions", base: 215 },
      { id: "pendingApproval", base: 486 },
      { id: "disputedInvoices", base: 62 },
    ],
    quality: {
      rejectionRate: 3.4,
      exceptionRate: 2.1,
      firstTimeRight: 96.2,
      avgProcessingDays: 4.2,
      touchlessRate: 71.4,
      daysPayableOutstanding: 46.8,
    },
  },

  /* ---------------------------------------------------------------- */
  hr: {
    serviceId: "hr",
    txn: [
      {
        id: "hr-payroll",
        label: "Payroll records processed",
        unit: "payslip",
        unitPlural: "payslips",
        baseVolume: 12_400,
        rate: 28,
        sourceSystem: "Payroll engine",
      },
      {
        id: "hr-hiring",
        label: "Recruitment mandates closed",
        unit: "mandate",
        unitPlural: "mandates",
        baseVolume: 9.7,
        rate: 22_000,
        sourceSystem: "SuccessFactors",
      },
      {
        id: "hr-lifecycle",
        label: "Onboarding & exit formalities",
        unit: "case",
        unitPlural: "cases",
        baseVolume: 118,
        rate: 1_200,
        sourceSystem: "Darwinbox",
      },
      {
        id: "hr-helpdesk",
        label: "Employee helpdesk tickets resolved",
        unit: "ticket",
        unitPlural: "tickets",
        baseVolume: 1_940,
        rate: 45,
        sourceSystem: "Darwinbox",
      },
    ],
    fte: [
      { id: "hr-fte-ops", role: "HR Operations & Payroll", baseFte: 5, ratePerFte: 105_000 },
      { id: "hr-fte-ta", role: "Talent Acquisition", baseFte: 4, ratePerFte: 115_000 },
      { id: "hr-fte-hrbp", role: "HR Business Partner", baseFte: 1, ratePerFte: 160_000 },
    ],
    // Hiring peaks Jun–Aug, softens over the December/January holidays.
    seasonality: [0.912, 0.968, 1.045, 1.088, 1.062, 1.021, 0.974, 1.0, 0.936, 0.905, 0.958, 1.014],
    fteRamp: [0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 0.9, 1.0, 1.0],
    budgetVariancePct: -2.6,
    stocks: [
      { id: "openPositions", base: 126 },
      { id: "positionsInProgress", base: 48 },
      { id: "offersPending", base: 19 },
      { id: "headcountServed", base: 12_400 },
    ],
    quality: {
      timeToHireDays: 42,
      talentAcquisitionSla: 60,
      candidateExperience: 4.3,
      payrollAccuracy: 99.4,
      helpdeskFirstResponseHrs: 3.8,
      attritionRate: 11.6,
    },
  },

  /* ---------------------------------------------------------------- */
  tax: {
    serviceId: "tax",
    txn: [
      {
        id: "tax-filing",
        label: "Statutory returns & filings",
        unit: "return",
        unitPlural: "returns",
        baseVolume: 68,
        rate: 4_200,
        sourceSystem: "GSTN portal",
      },
      {
        id: "tax-tds",
        label: "TDS / withholding certificates",
        unit: "certificate",
        unitPlural: "certificates",
        baseVolume: 402,
        rate: 260,
        sourceSystem: "TRACES",
      },
      {
        id: "tax-notice",
        label: "Notices & assessments handled",
        unit: "case",
        unitPlural: "cases",
        baseVolume: 22,
        rate: 11_000,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "tax-advisory",
        label: "Advisory & taxability queries",
        unit: "query",
        unitPlural: "queries",
        baseVolume: 110,
        rate: 800,
        sourceSystem: "Service desk",
      },
    ],
    fte: [{ id: "tax-fte-spec", role: "Direct & Indirect Tax Specialist", baseFte: 3, ratePerFte: 155_000 }],
    // Filing calendar drives the shape: Jul, Sep, Oct, Jan and Mar all spike.
    seasonality: [0.884, 0.851, 0.966, 1.128, 0.892, 1.164, 1.058, 1.0, 0.918, 1.142, 0.905, 1.238],
    fteRamp: [0.95, 0.95, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.05, 1.1],
    budgetVariancePct: 1.1,
    stocks: [
      { id: "openLitigation", base: 14 },
      { id: "pendingNotices", base: 9 },
      { id: "disputedTaxValue", base: 34_600_000 },
    ],
    quality: {
      filingOnTimeRate: 99.4,
      avgTurnaroundDays: 3.6,
      exceptionRate: 1.4,
      noticeResponseDays: 5.2,
      inputCreditMatchRate: 97.8,
    },
  },

  /* ---------------------------------------------------------------- */
  automation: {
    serviceId: "automation",
    txn: [
      {
        id: "auto-licence",
        label: "Bot & agent runtime licences",
        unit: "bot",
        unitPlural: "bots",
        baseVolume: 24,
        rate: 26_000,
        sourceSystem: "RPA Control Tower",
      },
      {
        id: "auto-txn",
        label: "Transactions executed by digital workforce",
        unit: "transaction",
        unitPlural: "transactions",
        baseVolume: 68_400,
        rate: 4.5,
        sourceSystem: "RPA Control Tower",
      },
      {
        id: "auto-build",
        label: "New automations delivered",
        unit: "automation",
        unitPlural: "automations",
        baseVolume: 2,
        rate: 145_000,
        sourceSystem: "Automation CoE",
      },
    ],
    fte: [{ id: "auto-fte-coe", role: "Automation CoE Engineer", baseFte: 2, ratePerFte: 175_000 }],
    // Monotonic ramp — the digital workforce is still being built out.
    seasonality: [0.612, 0.658, 0.712, 0.771, 0.824, 0.876, 0.938, 1.0, 1.048, 1.096, 1.152, 1.214],
    fteRamp: [0.5, 0.5, 0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5, 1.5],
    budgetVariancePct: 11.2,
    stocks: [{ id: "exceptionsQueued", base: 87 }],
    quality: {
      successRate: 98.4,
      botAvailability: 99.2,
      exceptionRate: 1.6,
      minutesSavedPerTxn: 6.5,
      blendedHourlyCost: 420,
      automationCoverage: 62.4,
    },
  },

  /* ---------------------------------------------------------------- */
  analytics: {
    serviceId: "analytics",
    txn: [
      {
        id: "an-platform",
        label: "Analytics platform subscription",
        unit: "tenant",
        unitPlural: "tenants",
        baseVolume: 1,
        rate: 320_000,
        sourceSystem: "Analytics Platform",
        fixed: true,
      },
      {
        id: "an-products",
        label: "Active analytics products",
        unit: "product",
        unitPlural: "products",
        baseVolume: 8,
        rate: 95_000,
        sourceSystem: "Analytics Platform",
      },
      {
        id: "an-reports",
        label: "Scheduled reports & data feeds",
        unit: "report",
        unitPlural: "reports",
        baseVolume: 24,
        rate: 9_000,
        sourceSystem: "Analytics Platform",
      },
    ],
    fte: [{ id: "an-fte-analyst", role: "Data & Insight Analyst", baseFte: 2, ratePerFte: 165_000 }],
    // Step growth as each analytics product goes live.
    seasonality: [0.688, 0.688, 0.792, 0.792, 0.874, 0.912, 0.958, 1.0, 1.042, 1.084, 1.126, 1.168],
    fteRamp: [0.5, 0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5, 1.5],
    budgetVariancePct: 5.8,
    stocks: [
      { id: "insightsGenerated", base: 86 },
      { id: "activeUsers", base: 214 },
    ],
    quality: {
      onTimeDelivery: 98.1,
      dataFreshness: 96.8,
      insightTatDays: 4.4,
      dashboardAvailability: 99.5,
      adoptionRate: 68.2,
    },
  },
};

/**
 * Weighted SLA decomposition. The headline SLA a customer sees is never a
 * single number in reality — it is a weighted roll-up of the sub-services
 * inside the tower. Showing the decomposition is what lets a CFO see *which*
 * part of the service is dragging.
 *
 * Weights sum to 1.00 per service; `actual` is the DIAL baseline.
 */
export const SLA_COMPONENTS: Record<
  ServiceId,
  { id: string; label: string; weight: number; actual: number; target: number }[]
> = {
  fna: [
    { id: "fna-sla-ap", label: "AP invoice processing within TAT", weight: 0.45, actual: 96.2, target: 95 },
    { id: "fna-sla-ar", label: "Customer invoicing on schedule", weight: 0.2, actual: 97.9, target: 95 },
    { id: "fna-sla-gl", label: "Month-end close & reporting", weight: 0.2, actual: 98.4, target: 97 },
    { id: "fna-sla-exp", label: "Expense claim settlement", weight: 0.1, actual: 95.1, target: 95 },
    { id: "fna-sla-md", label: "Master data request TAT", weight: 0.05, actual: 94.0, target: 95 },
  ],
  hr: [
    { id: "hr-sla-payroll", label: "Payroll processed on time", weight: 0.55, actual: 99.1, target: 99 },
    { id: "hr-sla-helpdesk", label: "Helpdesk ticket resolution", weight: 0.25, actual: 96.4, target: 95 },
    { id: "hr-sla-lifecycle", label: "Onboarding & exit completion", weight: 0.1, actual: 95.0, target: 95 },
    { id: "hr-sla-ta", label: "Talent acquisition within TAT", weight: 0.1, actual: 60.0, target: 90 },
  ],
  tax: [
    { id: "tax-sla-filing", label: "Statutory filings before due date", weight: 0.4, actual: 99.4, target: 100 },
    { id: "tax-sla-tds", label: "TDS certificates issued on time", weight: 0.25, actual: 98.6, target: 98 },
    { id: "tax-sla-notice", label: "Notice response within TAT", weight: 0.2, actual: 95.2, target: 95 },
    { id: "tax-sla-advisory", label: "Advisory query turnaround", weight: 0.15, actual: 97.1, target: 95 },
  ],
  automation: [
    { id: "auto-sla-avail", label: "Bot availability", weight: 0.35, actual: 99.2, target: 99 },
    { id: "auto-sla-success", label: "Job success rate", weight: 0.4, actual: 98.4, target: 97 },
    { id: "auto-sla-exception", label: "Exception resolution within TAT", weight: 0.15, actual: 96.8, target: 95 },
    { id: "auto-sla-change", label: "Change delivery on schedule", weight: 0.1, actual: 97.5, target: 95 },
  ],
  analytics: [
    { id: "an-sla-delivery", label: "Report delivery on schedule", weight: 0.4, actual: 98.1, target: 97 },
    { id: "an-sla-fresh", label: "Data freshness within window", weight: 0.3, actual: 96.8, target: 96 },
    { id: "an-sla-tat", label: "Insight request turnaround", weight: 0.2, actual: 95.4, target: 95 },
    { id: "an-sla-uptime", label: "Dashboard availability", weight: 0.1, actual: 99.5, target: 99 },
  ],
};

/**
 * Entity-specific SLA overrides, used where the demo needs a deliberate
 * story. GHIAL's HR tower is the worked example of a service in trouble:
 * the roll-up lands at ~82% against a 90% target.
 */
export const SLA_OVERRIDES: Record<string, Partial<Record<ServiceId, Record<string, number>>>> = {
  ghial: {
    hr: {
      "hr-sla-payroll": 92.0,
      "hr-sla-helpdesk": 80.0,
      "hr-sla-lifecycle": 76.0,
      "hr-sla-ta": 38.0,
    },
  },
  "goa-mopa": {
    fna: { "fna-sla-ap": 92.8, "fna-sla-md": 89.5 },
  },
  aerocity: {
    tax: { "tax-sla-notice": 88.4 },
  },
};

/** Per-entity CSAT by service, weighted into the headline score. */
export const CSAT_BASELINE: Record<ServiceId, number> = {
  fna: 4.75,
  hr: 4.1,
  tax: 4.8,
  automation: 4.6,
  analytics: 4.5,
};
