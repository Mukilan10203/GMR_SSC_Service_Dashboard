import type { Direction, MetricFormat } from "../domain/types";

/**
 * Enterprise financial baseline for the flagship entity (DIAL), stated
 * year-to-date for FY 2026. Every other entity is this multiplied by its
 * `scale`, so an entity a third of the size shows a third of the balance
 * sheet — and the SSC fee stays a consistent percentage of revenue.
 *
 * These figures are what the Analytics products report on. They are the
 * *customer's* business numbers, not SSC billing.
 */
export interface FinancialBaseline {
  revenueYtd: number;
  aeroRevenueYtd: number;
  nonAeroRevenueYtd: number;
  revenueGrowthPct: number;
  opexYtd: number;
  opexBudgetYtd: number;
  spendUnderManagement: number;
  procurementSavings: number;
  receivablesTotal: number;
  receivablesAgeing: { bucket: string; share: number }[];
  payablesTotal: number;
  payablesAgeing: { bucket: string; share: number }[];
  inventory: number;
  openItemsOver60: number;
  dso: number;
  dpo: number;
}

/** The baseline resolved for one entity, plus the values derived from it. */
export interface FinancialContext extends FinancialBaseline {
  opexVariancePct: number;
  workingCapital: number;
}

const CR = 1_00_00_000;

export const FINANCIAL_BASELINE: FinancialBaseline = {
  revenueYtd: 1180 * CR,
  aeroRevenueYtd: 672 * CR,
  nonAeroRevenueYtd: 508 * CR,
  revenueGrowthPct: 8.2,
  opexYtd: 742 * CR,
  // 742 / 717.6 - 1 = +3.4% over budget
  opexBudgetYtd: 717.6 * CR,
  spendUnderManagement: 412 * CR,
  procurementSavings: 9.3 * CR,
  receivablesTotal: 64.2 * CR,
  receivablesAgeing: [
    { bucket: "0–30 days", share: 0.4424 },
    { bucket: "31–60 days", share: 0.2508 },
    { bucket: "61–90 days", share: 0.1526 },
    { bucket: "Over 90 days", share: 0.1542 },
  ],
  payablesTotal: 48.6 * CR,
  payablesAgeing: [
    { bucket: "0–30 days", share: 0.539 },
    { bucket: "31–60 days", share: 0.2757 },
    { bucket: "61–90 days", share: 0.1152 },
    { bucket: "Over 90 days", share: 0.0701 },
  ],
  inventory: 8.4 * CR,
  openItemsOver60: 21.4 * CR,
  dso: 48,
  dpo: 46.8,
};

/**
 * The analytics footprint at the flagship entity (DIAL, scale 1.00).
 *
 * Analytics is not separately contracted — it is delivered on top of the five
 * service towers from the transaction data they already process, so there is
 * no rate-card line behind it. The footprint therefore scales directly with
 * the size of the entity rather than with a billed volume.
 */
export const ANALYTICS_FOOTPRINT = {
  products: 8,
  reports: 24,
  insights: 86,
  activeUsers: 214,
} as const;

/* ------------------------------------------------------------------ */

export interface AnalyticsProductSpec {
  key: string;
  name: string;
  category: string;
  description: string;
  sourceSystem: string;
  refresh: string;
  /** Key into the derived financial context. */
  headlineKey: keyof FinancialBaseline | "opexVariancePct" | "workingCapital";
  headlineLabel: string;
  headlineFormat: MetricFormat;
  headlineDeltaPct?: number;
  headlineDirection: Direction;
  insights: number;
  reports: number;
  /** Share of the entity's licensed analytics users active on this product. */
  userShare: number;
  highlights: string[];
  /** Sparkline shape — normalised, scaled by the engine. */
  series: number[];
  /** Composition of the headline; shares must sum to 1. */
  breakdown?: { label: string; share: number }[];
  /** Value the SSC has identified through this product, YTD. */
  valueIdentified: number;
  rank: number;
}

export const ANALYTICS_PRODUCTS: AnalyticsProductSpec[] = [
  {
    key: "spend",
    name: "Spend Analytics",
    category: "Procurement",
    description:
      "Category, vendor and contract-level view of addressable spend, isolating maverick spend, price variance and consolidation opportunities.",
    sourceSystem: "SAP Ariba",
    refresh: "Daily, 06:00",
    headlineKey: "spendUnderManagement",
    headlineLabel: "Spend under management (YTD)",
    headlineFormat: "currency",
    headlineDeltaPct: 6.4,
    headlineDirection: "lower-better",
    insights: 12,
    reports: 4,
    userShare: 0.28,
    highlights: [
      "₹1.1 Cr of maverick spend identified across three categories",
      "Top 20 vendors account for 61% of addressable spend",
      "Contract price variance detected on 8 active agreements",
    ],
    series: [0.79, 0.82, 0.85, 0.84, 0.89, 0.93, 0.92, 1.0],
    breakdown: [
      { label: "Facilities & maintenance", share: 0.276 },
      { label: "Ground handling & services", share: 0.221 },
      { label: "Utilities & energy", share: 0.184 },
      { label: "IT & telecom", share: 0.132 },
      { label: "Professional services", share: 0.098 },
      { label: "Other categories", share: 0.089 },
    ],
    valueIdentified: 1.1 * CR,
    rank: 1,
  },
  {
    key: "aero-revenue",
    name: "Aero Revenue Analytics",
    category: "Revenue",
    description:
      "Aeronautical revenue by traffic driver — landing and parking, passenger service fees, cargo and fuel throughput — reconciled to billed traffic.",
    sourceSystem: "SAP S/4HANA",
    refresh: "Daily, 04:00",
    headlineKey: "aeroRevenueYtd",
    headlineLabel: "Aero revenue (YTD)",
    headlineFormat: "currency",
    headlineDeltaPct: 9.1,
    headlineDirection: "higher-better",
    insights: 10,
    reports: 3,
    userShare: 0.19,
    highlights: [
      "ATM growth of 7.4% is the primary driver of the revenue increase",
      "Cargo tonnage up 11.2% year on year",
      "₹64 L of under-billed parking charges recovered YTD",
    ],
    series: [0.81, 0.84, 0.87, 0.9, 0.91, 0.94, 0.96, 1.0],
    breakdown: [
      { label: "Passenger service fee", share: 0.412 },
      { label: "Landing & parking", share: 0.286 },
      { label: "Cargo handling", share: 0.174 },
      { label: "Fuel throughput", share: 0.128 },
    ],
    valueIdentified: 0.64 * CR,
    rank: 2,
  },
  {
    key: "non-aero-revenue",
    name: "Non-Aero Revenue Analytics",
    category: "Revenue",
    description:
      "Commercial revenue across retail, food and beverage, advertising, car park and real estate, with concession performance against minimum guarantees.",
    sourceSystem: "S/4HANA + local IT systems",
    refresh: "Daily, 05:00",
    headlineKey: "nonAeroRevenueYtd",
    headlineLabel: "Non-aero revenue (YTD)",
    headlineFormat: "currency",
    headlineDeltaPct: 6.9,
    headlineDirection: "higher-better",
    insights: 11,
    reports: 4,
    userShare: 0.24,
    highlights: [
      "Spend per passenger up 4.1% to ₹412",
      "Three concessions trading below minimum guarantee",
      "Advertising yield up 12.6% following the digital refit",
    ],
    series: [0.83, 0.85, 0.88, 0.86, 0.91, 0.94, 0.95, 1.0],
    breakdown: [
      { label: "Retail & duty free", share: 0.348 },
      { label: "Food & beverage", share: 0.221 },
      { label: "Advertising", share: 0.164 },
      { label: "Car park & access", share: 0.147 },
      { label: "Real estate & other", share: 0.12 },
    ],
    valueIdentified: 0.82 * CR,
    rank: 3,
  },
  {
    key: "debtors",
    name: "Debtors Ageing",
    category: "Working capital",
    description:
      "Receivables by ageing bucket and counterparty, with collection risk scoring and dunning status on every open item.",
    sourceSystem: "SAP S/4HANA",
    refresh: "Daily, 07:00",
    headlineKey: "receivablesTotal",
    headlineLabel: "Total receivables",
    headlineFormat: "currency",
    headlineDeltaPct: 3.8,
    headlineDirection: "lower-better",
    insights: 11,
    reports: 3,
    userShare: 0.21,
    highlights: [
      "Three counterparties hold 61% of the over-90-day balance",
      "DSO at 48 days against a 45-day target",
      "₹2.4 Cr recovered through the revised dunning cycle",
    ],
    series: [0.91, 0.94, 0.97, 0.99, 1.02, 1.0, 0.98, 1.0],
    breakdown: [
      { label: "0–30 days", share: 0.4424 },
      { label: "31–60 days", share: 0.2508 },
      { label: "61–90 days", share: 0.1526 },
      { label: "Over 90 days", share: 0.1542 },
    ],
    valueIdentified: 2.4 * CR,
    rank: 4,
  },
  {
    key: "creditors",
    name: "Creditors Ageing",
    category: "Working capital",
    description:
      "Payables by ageing bucket and vendor, highlighting early-payment discount capture and invoices at risk of late-payment interest.",
    sourceSystem: "SAP S/4HANA",
    refresh: "Daily, 07:00",
    headlineKey: "payablesTotal",
    headlineLabel: "Total payables",
    headlineFormat: "currency",
    headlineDeltaPct: 2.1,
    headlineDirection: "higher-better",
    insights: 8,
    reports: 3,
    userShare: 0.16,
    highlights: [
      "₹38 L of early-payment discount available but not captured",
      "DPO at 46.8 days, within the 45–50 day policy band",
      "No invoices currently at risk of statutory late-payment interest",
    ],
    series: [0.88, 0.9, 0.93, 0.95, 0.94, 0.97, 0.98, 1.0],
    breakdown: [
      { label: "0–30 days", share: 0.539 },
      { label: "31–60 days", share: 0.2757 },
      { label: "61–90 days", share: 0.1152 },
      { label: "Over 90 days", share: 0.0701 },
    ],
    valueIdentified: 0.38 * CR,
    rank: 5,
  },
  {
    key: "open-items",
    name: "Open Item Analysis",
    category: "Financial control",
    description:
      "Unresolved balance sheet items over 60 days — GR/IR, unapplied receipts, suspense and employee advances — with ownership and ageing.",
    sourceSystem: "SAP S/4HANA",
    refresh: "Weekly, Monday",
    headlineKey: "openItemsOver60",
    headlineLabel: "Open items over 60 days",
    headlineFormat: "currency",
    headlineDeltaPct: -12.4,
    headlineDirection: "lower-better",
    insights: 9,
    reports: 2,
    userShare: 0.14,
    highlights: [
      "GR/IR balance reduced by ₹3.1 Cr through the clean-up programme",
      "142 unapplied receipts pending customer identification",
      "Employee advances over 90 days down to 34 cases from 91",
    ],
    series: [1.28, 1.22, 1.19, 1.14, 1.09, 1.06, 1.02, 1.0],
    breakdown: [
      { label: "GR/IR clearing", share: 0.412 },
      { label: "Unapplied receipts", share: 0.243 },
      { label: "Suspense & clearing", share: 0.198 },
      { label: "Employee advances", share: 0.147 },
    ],
    valueIdentified: 3.1 * CR,
    rank: 6,
  },
  {
    key: "expense-variance",
    name: "Expense Variance",
    category: "Cost control",
    description:
      "Month-on-month and quarter-on-quarter operating expense variance against budget, decomposed to cost head and responsibility centre.",
    sourceSystem: "SAP S/4HANA",
    refresh: "Monthly, working day 3",
    headlineKey: "opexVariancePct",
    headlineLabel: "Opex variance vs budget (YTD)",
    headlineFormat: "percent",
    headlineDirection: "lower-better",
    insights: 10,
    reports: 3,
    userShare: 0.31,
    highlights: [
      "Utilities is the largest adverse variance at ₹8.4 Cr over budget",
      "Energy tariff revision accounts for 71% of the utilities overrun",
      "Manpower cost is ₹3.2 Cr favourable against budget",
    ],
    series: [1.4, 2.1, 2.6, 2.9, 3.1, 3.3, 3.2, 3.4],
    breakdown: [
      { label: "Utilities & energy", share: 0.386 },
      { label: "Repairs & maintenance", share: 0.241 },
      { label: "Security & safety", share: 0.168 },
      { label: "Administration", share: 0.121 },
      { label: "Other cost heads", share: 0.084 },
    ],
    valueIdentified: 3.2 * CR,
    rank: 7,
  },
  {
    key: "revenue",
    name: "Revenue Analytics",
    category: "Revenue",
    description:
      "Total revenue performance and driver decomposition across aero and non-aero streams, with forecast against plan and prior year.",
    sourceSystem: "SAP S/4HANA",
    refresh: "Daily, 06:00",
    headlineKey: "revenueYtd",
    headlineLabel: "Total revenue (YTD)",
    headlineFormat: "currency",
    headlineDeltaPct: 8.2,
    headlineDirection: "higher-better",
    insights: 15,
    reports: 2,
    userShare: 0.42,
    highlights: [
      "Revenue is 2.6% ahead of plan on a year-to-date basis",
      "Non-aero share has grown from 41.4% to 43.1% year on year",
      "Traffic growth contributes 6.1 points of the 8.2% increase",
    ],
    series: [0.82, 0.85, 0.88, 0.89, 0.92, 0.95, 0.96, 1.0],
    breakdown: [
      { label: "Aero revenue", share: 0.5695 },
      { label: "Non-aero revenue", share: 0.4305 },
    ],
    valueIdentified: 0,
    rank: 8,
  },
];

/**
 * Analytics use cases the SSC can stand up but the customer has not yet
 * bought. Shown as a growth conversation rather than an empty state.
 */
export const ANALYTICS_CATALOGUE = [
  {
    name: "Cash Flow Forecasting",
    category: "Treasury",
    description: "13-week rolling cash forecast built from AP, AR and contracted commitments.",
    sourceSystem: "SAP S/4HANA",
    effort: "6 weeks",
  },
  {
    name: "Vendor Risk & Compliance",
    category: "Procurement",
    description: "Vendor concentration, GST filing status and single-source dependency scoring.",
    sourceSystem: "SAP Ariba + GSTN",
    effort: "4 weeks",
  },
  {
    name: "Passenger Spend Propensity",
    category: "Commercial",
    description: "Non-aero spend per passenger modelled by route, terminal and time of day.",
    sourceSystem: "Local IT + S/4HANA",
    effort: "8 weeks",
  },
  {
    name: "Workforce Cost Analytics",
    category: "People",
    description: "Manpower cost, overtime and contractor mix against operational demand.",
    sourceSystem: "SAP SuccessFactors + payroll",
    effort: "5 weeks",
  },
  {
    name: "Tax Exposure Dashboard",
    category: "Taxation",
    description: "Open notices, disputed demand and unmatched input credit across direct and indirect tax.",
    sourceSystem: "GSTN + TRACES + S/4HANA",
    effort: "5 weeks",
  },
  {
    name: "Contract Expiry & Obligation Tracker",
    category: "Procurement",
    description: "Renewal calendar, obligation compliance and auto-renew exposure across the contract estate.",
    sourceSystem: "SAP Ariba",
    effort: "3 weeks",
  },
];
