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
 * 1.00) in the current reporting month (Aug of FY 2027). Other entities and
 * months are derived by multiplying through `scale`, `seasonality` and
 * `fteRamp`.
 *
 * Automation is not a separate tower. Each service carries two digital
 * workforce lines — `<service>-botlic` (runtime licences) and
 * `<service>-bottxn` (transactions executed by bots) — so the control tower
 * reconciles to the tower that actually consumes the automation.
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
  /** 12 fiscal months, Apr→Mar. Index 4 (Aug) is normalised to 1.000. */
  seasonality: number[];
  fteRamp: number[];
  /** FY actual-vs-budget variance target, in %. Positive = over budget. */
  budgetVariancePct: number;
  stocks: StockSpec[];
  /** Service quality baseline at DIAL, before `opsDelta`. */
  quality: Record<string, number>;
}

/* Ratios that convert volume into value/quality figures. */
export const AVG_INVOICE_VALUE = 17_969;
export const AVG_PO_VALUE = 2_45_000;

/** Digital workforce line ids, derived from the service id. */
export const botLicenceLineId = (serviceId: ServiceId) => `${serviceId}-botlic`;
export const botTxnLineId = (serviceId: ServiceId) => `${serviceId}-bottxn`;

const BOT_LICENCE_RATE = 26_000;
const BOT_TXN_RATE = 4.5;

export const BLUEPRINTS: Record<ServiceId, ServiceBlueprint> = {
  /* ================================================================ */
  /* F&A — AP · AR · Travel · Record to Report · Treasury             */
  /* ================================================================ */
  fna: {
    serviceId: "fna",
    txn: [
      {
        id: "fna-ap",
        label: "Supplier invoices processed (AP)",
        unit: "invoice",
        unitPlural: "invoices",
        baseVolume: 10_240,
        rate: 100,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "fna-ar",
        label: "Customer invoices raised (AR)",
        unit: "invoice",
        unitPlural: "invoices",
        baseVolume: 2_260,
        rate: 85,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "fna-travel",
        label: "Travel & expense claims settled",
        unit: "claim",
        unitPlural: "claims",
        baseVolume: 3_120,
        rate: 45,
        sourceSystem: "SAP Concur",
      },
      {
        id: "fna-r2r",
        label: "Journals & reconciliations (R2R)",
        unit: "entry",
        unitPlural: "entries",
        baseVolume: 1_480,
        rate: 120,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "fna-treasury",
        label: "Payments & bank reconciliations (Treasury)",
        unit: "payment",
        unitPlural: "payments",
        baseVolume: 2_940,
        rate: 35,
        sourceSystem: "Bank host-to-host",
      },
      {
        id: "fna-botlic",
        label: "Digital workforce runtime licences",
        unit: "bot",
        unitPlural: "bots",
        baseVolume: 11,
        rate: BOT_LICENCE_RATE,
        sourceSystem: "RPA Control Tower",
      },
      {
        id: "fna-bottxn",
        label: "Transactions executed by the digital workforce",
        unit: "transaction",
        unitPlural: "transactions",
        baseVolume: 41_000,
        rate: BOT_TXN_RATE,
        sourceSystem: "RPA Control Tower",
      },
    ],
    fte: [
      { id: "fna-fte-ap", role: "Accounts Payable Operations", baseFte: 8, ratePerFte: 105_000 },
      { id: "fna-fte-ar", role: "Accounts Receivable & Collections", baseFte: 4, ratePerFte: 120_000 },
      { id: "fna-fte-travel", role: "Travel & Expense Desk", baseFte: 2, ratePerFte: 92_000 },
      { id: "fna-fte-r2r", role: "Record to Report", baseFte: 6, ratePerFte: 145_000 },
      { id: "fna-fte-treasury", role: "Treasury Operations", baseFte: 2, ratePerFte: 150_000 },
    ],
    // Steady growth with a visible October dip and a March year-end spike.
    seasonality: [0.935, 0.952, 0.973, 0.964, 1, 1.036, 1.019, 1.11, 1.125, 1.151, 1.171, 1.259],
    // A three-FTE uplift lands on 1 August — the current reporting month.
    // Together with the invoice volume recovery it gives the August bill a
    // genuine, explainable jump for the billing-drivers narrative.
    fteRamp: [0.83, 0.83, 0.87, 0.87, 1.0, 1.0, 1.0, 1.0, 1.0, 1.04, 1.04, 1.04],
    budgetVariancePct: 3.4,
    stocks: [
      { id: "openExceptions", base: 215 },
      { id: "pendingApproval", base: 486 },
      { id: "disputedInvoices", base: 62 },
      { id: "unreconciledBankItems", base: 48 },
      { id: "openArItems", base: 340 },
    ],
    quality: {
      rejectionRate: 3.4,
      exceptionRate: 2.1,
      firstTimeRight: 96.2,
      avgProcessingDays: 4.2,
      touchlessRate: 71.4,
      daysPayableOutstanding: 46.8,
      closeCycleDays: 3.4,
      collectionEffectiveness: 91.2,
      travelSettlementDays: 3.1,
      bankReconAccuracy: 99.2,
    },
  },

  /* ================================================================ */
  /* HR Ops — TA · Payroll · L&D · Core HR (SAP SuccessFactors)       */
  /* ================================================================ */
  hrops: {
    serviceId: "hrops",
    txn: [
      {
        id: "hrops-payroll",
        label: "Payroll records processed",
        unit: "payslip",
        unitPlural: "payslips",
        baseVolume: 12_400,
        rate: 28,
        sourceSystem: "Payroll engine",
      },
      {
        id: "hrops-ta",
        label: "Recruitment mandates closed (TA)",
        unit: "mandate",
        unitPlural: "mandates",
        baseVolume: 9.7,
        rate: 22_000,
        sourceSystem: "SAP SuccessFactors",
      },
      {
        id: "hrops-lnd",
        label: "Learning & development enrolments",
        unit: "enrolment",
        unitPlural: "enrolments",
        baseVolume: 640,
        rate: 350,
        sourceSystem: "SAP SuccessFactors",
      },
      {
        id: "hrops-botlic",
        label: "Digital workforce runtime licences",
        unit: "bot",
        unitPlural: "bots",
        baseVolume: 5,
        rate: BOT_LICENCE_RATE,
        sourceSystem: "RPA Control Tower",
      },
      {
        id: "hrops-bottxn",
        label: "Transactions executed by the digital workforce",
        unit: "transaction",
        unitPlural: "transactions",
        baseVolume: 12_000,
        rate: BOT_TXN_RATE,
        sourceSystem: "RPA Control Tower",
      },
    ],
    fte: [
      { id: "hrops-fte-payroll", role: "HR Operations & Payroll", baseFte: 5, ratePerFte: 105_000 },
      { id: "hrops-fte-ta", role: "Talent Acquisition", baseFte: 4, ratePerFte: 115_000 },
      { id: "hrops-fte-lnd", role: "Learning & Development", baseFte: 2, ratePerFte: 110_000 },
      { id: "hrops-fte-sf", role: "SAP SuccessFactors Support", baseFte: 1, ratePerFte: 135_000 },
    ],
    // Hiring peaks Jun–Aug, softens over the December/January holidays.
    seasonality: [0.859, 0.911, 0.984, 1.024, 1, 0.961, 0.917, 0.942, 0.881, 0.852, 0.902, 0.955],
    fteRamp: [0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 0.9, 1.0, 1.0],
    budgetVariancePct: -2.6,
    stocks: [
      { id: "openPositions", base: 126 },
      { id: "positionsInProgress", base: 48 },
      { id: "offersPending", base: 19 },
      { id: "headcountServed", base: 12_400 },
      { id: "trainingBacklog", base: 74 },
    ],
    quality: {
      timeToHireDays: 42,
      talentAcquisitionSla: 60,
      candidateExperience: 4.3,
      payrollAccuracy: 99.4,
      helpdeskFirstResponseHrs: 3.8,
      attritionRate: 11.6,
      trainingCompletionRate: 82.4,
      learningHoursPerEmployee: 9.6,
      exceptionRate: 1.5,
    },
  },

  /* ================================================================ */
  /* Procurement & Contracts                                          */
  /* ================================================================ */
  procurement: {
    serviceId: "procurement",
    txn: [
      {
        id: "proc-pr",
        label: "Requisitions converted to purchase orders",
        unit: "requisition",
        unitPlural: "requisitions",
        baseVolume: 3_480,
        rate: 90,
        sourceSystem: "SAP Ariba",
      },
      {
        id: "proc-rfx",
        label: "Sourcing events run (RFx)",
        unit: "event",
        unitPlural: "events",
        baseVolume: 42,
        rate: 9_500,
        sourceSystem: "SAP Ariba",
      },
      {
        id: "proc-contract",
        label: "Contracts drafted, renewed & filed",
        unit: "contract",
        unitPlural: "contracts",
        baseVolume: 96,
        rate: 6_500,
        sourceSystem: "SAP Ariba",
      },
      {
        id: "proc-vendor",
        label: "Vendor records onboarded & maintained",
        unit: "record",
        unitPlural: "records",
        baseVolume: 640,
        rate: 60,
        sourceSystem: "SAP MDG",
      },
      {
        id: "procurement-botlic",
        label: "Digital workforce runtime licences",
        unit: "bot",
        unitPlural: "bots",
        baseVolume: 3,
        rate: BOT_LICENCE_RATE,
        sourceSystem: "RPA Control Tower",
      },
      {
        id: "procurement-bottxn",
        label: "Transactions executed by the digital workforce",
        unit: "transaction",
        unitPlural: "transactions",
        baseVolume: 8_400,
        rate: BOT_TXN_RATE,
        sourceSystem: "RPA Control Tower",
      },
    ],
    fte: [
      { id: "proc-fte-sourcing", role: "Sourcing & Category Support", baseFte: 4, ratePerFte: 135_000 },
      { id: "proc-fte-clm", role: "Contract Management", baseFte: 3, ratePerFte: 145_000 },
      { id: "proc-fte-vendor", role: "Vendor Master & Helpdesk", baseFte: 2, ratePerFte: 95_000 },
    ],
    // Budget release lifts Q1, and a pre-year-end contracting push lifts March.
    seasonality: [0.955, 1.04, 1.096, 1.067, 1, 1.077, 0.984, 1.018, 1.051, 0.976, 1.035, 1.206],
    fteRamp: [0.9, 0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.05],
    budgetVariancePct: 2.2,
    stocks: [
      { id: "openRequisitions", base: 214 },
      { id: "contractsExpiring90", base: 38 },
      { id: "vendorsPendingOnboarding", base: 46 },
      { id: "openPurchaseOrders", base: 512 },
    ],
    quality: {
      prToPoDays: 3.4,
      savingsRate: 4.6,
      contractOnTimeRate: 95.8,
      vendorOnboardingDays: 2.8,
      spendUnderManagementPct: 78.4,
      maverickSpendRate: 6.2,
      exceptionRate: 2.4,
      firstTimeRight: 95.6,
    },
  },

  /* ================================================================ */
  /* IDT — Indirect Tax                                               */
  /* ================================================================ */
  idt: {
    serviceId: "idt",
    txn: [
      {
        id: "idt-return",
        label: "GST returns filed (GSTR-1, 3B, 9)",
        unit: "return",
        unitPlural: "returns",
        baseVolume: 34,
        rate: 4_200,
        sourceSystem: "GSTN portal",
      },
      {
        id: "idt-einvoice",
        label: "E-invoices & e-way bills generated",
        unit: "document",
        unitPlural: "documents",
        baseVolume: 9_600,
        rate: 8,
        sourceSystem: "IRP / NIC e-invoice",
      },
      {
        id: "idt-itc",
        label: "Input credit lines reconciled to GSTR-2B",
        unit: "line",
        unitPlural: "lines",
        baseVolume: 7_400,
        rate: 6,
        sourceSystem: "GSTN portal",
      },
      {
        id: "idt-notice",
        label: "GST notices & assessments handled",
        unit: "case",
        unitPlural: "cases",
        baseVolume: 12,
        rate: 11_000,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "idt-advisory",
        label: "Indirect tax advisory queries",
        unit: "query",
        unitPlural: "queries",
        baseVolume: 64,
        rate: 800,
        sourceSystem: "Service desk",
      },
      {
        id: "idt-botlic",
        label: "Digital workforce runtime licences",
        unit: "bot",
        unitPlural: "bots",
        baseVolume: 3,
        rate: BOT_LICENCE_RATE,
        sourceSystem: "RPA Control Tower",
      },
      {
        id: "idt-bottxn",
        label: "Transactions executed by the digital workforce",
        unit: "transaction",
        unitPlural: "transactions",
        baseVolume: 5_600,
        rate: BOT_TXN_RATE,
        sourceSystem: "RPA Control Tower",
      },
    ],
    fte: [{ id: "idt-fte-spec", role: "Indirect Tax Specialist", baseFte: 3, ratePerFte: 155_000 }],
    // GST filing calendar: Sep annual return, Jan and Mar reconciliation pushes.
    seasonality: [0.954, 0.983, 1.021, 1.085, 1, 1.266, 1.119, 1.04, 0.975, 1.168, 1.006, 1.208],
    fteRamp: [0.95, 0.95, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.05, 1.1],
    budgetVariancePct: 1.1,
    stocks: [
      { id: "openGstNotices", base: 9 },
      { id: "unmatchedItcValue", base: 41_00_000 },
      { id: "openIdtLitigation", base: 8 },
    ],
    quality: {
      filingOnTimeRate: 99.4,
      inputCreditMatchRate: 97.8,
      eInvoiceSuccessRate: 99.7,
      noticeResponseDays: 5.2,
      avgTurnaroundDays: 3.6,
      exceptionRate: 1.4,
    },
  },

  /* ================================================================ */
  /* DT — Direct Tax                                                  */
  /* ================================================================ */
  dt: {
    serviceId: "dt",
    txn: [
      {
        id: "dt-cert",
        label: "TDS / withholding certificates issued",
        unit: "certificate",
        unitPlural: "certificates",
        baseVolume: 402,
        rate: 260,
        sourceSystem: "TRACES",
      },
      {
        id: "dt-return",
        label: "Direct tax returns & statements filed",
        unit: "filing",
        unitPlural: "filings",
        baseVolume: 18,
        rate: 6_500,
        sourceSystem: "Income Tax portal",
      },
      {
        id: "dt-assessment",
        label: "Assessments & notices handled",
        unit: "case",
        unitPlural: "cases",
        baseVolume: 10,
        rate: 14_000,
        sourceSystem: "Income Tax portal",
      },
      {
        id: "dt-tp",
        label: "Transfer pricing documentation sets",
        unit: "set",
        unitPlural: "sets",
        baseVolume: 3,
        rate: 45_000,
        sourceSystem: "SAP S/4HANA",
      },
      {
        id: "dt-advisory",
        label: "Direct tax advisory queries",
        unit: "query",
        unitPlural: "queries",
        baseVolume: 46,
        rate: 900,
        sourceSystem: "Service desk",
      },
      {
        id: "dt-botlic",
        label: "Digital workforce runtime licences",
        unit: "bot",
        unitPlural: "bots",
        baseVolume: 2,
        rate: BOT_LICENCE_RATE,
        sourceSystem: "RPA Control Tower",
      },
      {
        id: "dt-bottxn",
        label: "Transactions executed by the digital workforce",
        unit: "transaction",
        unitPlural: "transactions",
        baseVolume: 3_400,
        rate: BOT_TXN_RATE,
        sourceSystem: "RPA Control Tower",
      },
    ],
    fte: [{ id: "dt-fte-spec", role: "Direct Tax Specialist", baseFte: 2, ratePerFte: 165_000 }],
    // Quarterly TDS statements plus advance tax instalments in Jun, Sep, Dec, Mar.
    seasonality: [0.923, 0.983, 1.188, 0.965, 1, 1.228, 0.983, 1.044, 1.215, 1.025, 0.99, 1.317],
    fteRamp: [0.95, 0.95, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.05, 1.1],
    budgetVariancePct: 0.8,
    stocks: [
      { id: "openAssessments", base: 11 },
      { id: "disputedTaxValue", base: 3_46_00_000 },
      { id: "lowerDeductionCerts", base: 24 },
    ],
    quality: {
      tdsOnTimeRate: 99.2,
      certOnTimeRate: 98.6,
      assessmentResponseDays: 7.4,
      avgTurnaroundDays: 3.9,
      exceptionRate: 1.2,
      taxProvisionAccuracy: 98.4,
    },
  },
};

/**
 * Weighted SLA decomposition. The headline SLA a customer sees is never a
 * single number in reality — it is a weighted roll-up of the sub-services
 * inside the tower. Showing the decomposition is what lets a CFO see *which*
 * part of the service is dragging.
 *
 * There is exactly one component per sub-service named in `SERVICES`.
 * Weights sum to 1.00 per service; `actual` is the DIAL baseline.
 */
export const SLA_COMPONENTS: Record<
  ServiceId,
  { id: string; label: string; weight: number; actual: number; target: number }[]
> = {
  fna: [
    { id: "fna-sla-ap", label: "AP invoice processing within TAT", weight: 0.3, actual: 96.2, target: 95 },
    { id: "fna-sla-ar", label: "AR invoicing & collections on schedule", weight: 0.2, actual: 97.9, target: 95 },
    { id: "fna-sla-travel", label: "Travel & expense claim settlement", weight: 0.12, actual: 95.1, target: 95 },
    { id: "fna-sla-r2r", label: "Record to report — close & reconciliations", weight: 0.26, actual: 98.4, target: 97 },
    { id: "fna-sla-treasury", label: "Treasury payment runs & bank reconciliation", weight: 0.12, actual: 97.6, target: 96 },
  ],
  hrops: [
    { id: "hrops-sla-payroll", label: "Payroll processed on time", weight: 0.6, actual: 99.1, target: 99 },
    { id: "hrops-sla-ta", label: "Talent acquisition within stage TAT", weight: 0.15, actual: 60.0, target: 90 },
    { id: "hrops-sla-lnd", label: "Learning programmes delivered to calendar", weight: 0.25, actual: 94.6, target: 95 },
  ],
  procurement: [
    { id: "proc-sla-po", label: "Requisition to purchase order within TAT", weight: 0.3, actual: 96.4, target: 95 },
    { id: "proc-sla-sourcing", label: "Sourcing events run to agreed cycle", weight: 0.2, actual: 94.2, target: 95 },
    { id: "proc-sla-contract", label: "Contracts renewed before expiry", weight: 0.25, actual: 95.8, target: 95 },
    { id: "proc-sla-vendor", label: "Vendor onboarding & master data TAT", weight: 0.25, actual: 94.0, target: 95 },
  ],
  idt: [
    { id: "idt-sla-filing", label: "GST returns filed before due date", weight: 0.4, actual: 99.4, target: 100 },
    { id: "idt-sla-einvoice", label: "E-invoice & e-way bill generation success", weight: 0.2, actual: 99.7, target: 99 },
    { id: "idt-sla-itc", label: "Input credit reconciled to GSTR-2B", weight: 0.25, actual: 97.8, target: 98 },
    { id: "idt-sla-notice", label: "GST notice response within TAT", weight: 0.15, actual: 95.2, target: 95 },
  ],
  dt: [
    { id: "dt-sla-tds", label: "TDS deposits & statements on time", weight: 0.4, actual: 99.2, target: 100 },
    { id: "dt-sla-cert", label: "TDS certificates issued on time", weight: 0.2, actual: 98.6, target: 98 },
    { id: "dt-sla-return", label: "Corporate tax filings before due date", weight: 0.25, actual: 98.1, target: 98 },
    { id: "dt-sla-assessment", label: "Transfer pricing & assessment support TAT", weight: 0.15, actual: 95.4, target: 95 },
  ],
};

/**
 * Entity-specific SLA overrides, used where the demo needs a deliberate
 * story. GHIAL's HR Ops tower is the worked example of a service in trouble:
 * the roll-up lands at ~78% against a 90% target, dragged by talent
 * acquisition at 38%.
 */
export const SLA_OVERRIDES: Record<string, Partial<Record<ServiceId, Record<string, number>>>> = {
  ghial: {
    hrops: {
      "hrops-sla-payroll": 92.0,
      "hrops-sla-ta": 38.0,
      "hrops-sla-lnd": 74.0,
    },
  },
  "goa-mopa": {
    fna: { "fna-sla-ap": 92.8, "fna-sla-treasury": 91.5 },
  },
  aerocity: {
    idt: { "idt-sla-notice": 88.4 },
  },
  ddfs: {
    procurement: { "proc-sla-vendor": 91.2 },
  },
};

/** Per-entity CSAT by service, weighted into the headline score. */
export const CSAT_BASELINE: Record<ServiceId, number> = {
  fna: 4.75,
  hrops: 4.1,
  procurement: 4.4,
  idt: 4.8,
  dt: 4.7,
};

/** DIAL baseline SLA per tower — the reference point CSAT is scored against. */
export const SLA_BASELINE: Record<ServiceId, number> = {
  fna: 97.15,
  hrops: 91.89,
  procurement: 95.21,
  idt: 98.43,
  dt: 98.24,
};
