/**
 * Domain model for the SSC Customer Portal.
 *
 * These types describe the *contract* the UI consumes. Today they are
 * satisfied by the deterministic mock engine in `src/lib/mock`; tomorrow the
 * same shapes can be satisfied by SAP / S4HANA / Ariba / HRMS / RPA control
 * tower adapters. No React component reads mock data directly — everything
 * goes through `src/lib/api.ts`.
 */

export type ServiceId = "fna" | "hr" | "tax" | "automation" | "analytics";

export type Status = "good" | "warn" | "bad";
export type Trend = "up" | "down" | "flat";
export type Direction = "higher-better" | "lower-better";

export type Priority = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "in-progress" | "awaiting-customer" | "resolved";

/* ------------------------------------------------------------------ */
/* Organisation                                                        */
/* ------------------------------------------------------------------ */

export interface Location {
  id: string;
  name: string;
  region: string;
}

export interface Entity {
  id: string;
  name: string;
  shortName: string;
  legalName: string;
  locationId: string;
  sector: string;
  /** Relative consumption weight vs the flagship entity (DIAL = 1.00). */
  scale: number;
  /** Services the SSC actually delivers to this entity. */
  services: ServiceId[];
  /** Service delivery quality offset in SLA percentage points. */
  opsDelta: number;
  contractStart: string;
  relationshipManager: string;
}

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  initials: string;
  /** Entities this user is authorised to see. First one is the default. */
  entityIds: string[];
  /** Services withheld from this user even if the entity consumes them. */
  restrictedServices?: ServiceId[];
  demoPassword: string;
  demoNote: string;
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export interface FiscalMonth {
  /** 0 = April (Indian fiscal year start). */
  index: number;
  key: string;
  label: string;
  short: string;
  calendarYear: number;
  quarter: 1 | 2 | 3 | 4;
  /** False for months that have not closed yet — shown as forecast. */
  isActual: boolean;
}

export interface Period {
  id: string;
  label: string;
  short: string;
  /** e.g. "Apr 2025 – Mar 2026" */
  range: string;
  months: FiscalMonth[];
  actualMonthCount: number;
  isCurrent: boolean;
  /** Human readable data cut-off, e.g. "30 Nov 2025". */
  asOf: string;
}

/* ------------------------------------------------------------------ */
/* Service catalogue                                                   */
/* ------------------------------------------------------------------ */

export interface ServiceDefinition {
  id: ServiceId;
  code: string;
  name: string;
  tagline: string;
  description: string;
  /** CSS var name suffix, e.g. "fna" -> var(--color-svc-fna) */
  colorKey: string;
  /** Conceptual upstream systems — displayed, never called. */
  sourceSystems: string[];
  slaTarget: number;
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

export interface TxnChargeLine {
  id: string;
  label: string;
  /** Driver unit agreeing with `volume`, e.g. "invoices", "payslip". */
  unit: string;
  /** Always singular — for "₹100 per invoice" style rate captions. */
  unitSingular: string;
  volume: number;
  rate: number;
  amount: number;
  sourceSystem: string;
}

export interface FteChargeLine {
  id: string;
  role: string;
  fte: number;
  ratePerFte: number;
  amount: number;
}

export interface MonthBilling {
  monthKey: string;
  short: string;
  isActual: boolean;
  txn: number;
  fte: number;
  total: number;
  budget: number;
}

/** Line-level attribution explaining a month-on-month billing move. */
export interface BillingDriver {
  label: string;
  kind: "volume" | "rate" | "fte";
  deltaAmount: number;
  deltaPct: number;
  fromVolume?: number;
  toVolume?: number;
}

export interface ServiceBilling {
  serviceId: ServiceId;
  currentMonthKey: string;
  currentMonthLabel: string;
  txnLines: TxnChargeLine[];
  fteLines: FteChargeLine[];
  txnTotal: number;
  fteTotal: number;
  currentTotal: number;
  prevMonthTotal: number;
  momPct: number;
  monthly: MonthBilling[];
  ytd: number;
  ytdBudget: number;
  ytdVariancePct: number;
  fyForecast: number;
  fyBudget: number;
  fyVariancePct: number;
  drivers: BillingDriver[];
  /** Share of the entity's total FY spend, 0–1. */
  mix: number;
  /** Plain-English explanation of the MoM move, generated from `drivers`. */
  narrative: string;
}

export interface EntityBilling {
  monthly: MonthBilling[];
  currentMonthKey: string;
  currentMonthLabel: string;
  currentTotal: number;
  prevMonthTotal: number;
  momPct: number;
  ytd: number;
  ytdBudget: number;
  ytdVariancePct: number;
  fyForecast: number;
  fyBudget: number;
  fyVariancePct: number;
  priorFyTotal: number;
  yoyPct: number;
  outstanding: number;
  outstandingAgeing: { bucket: string; amount: number }[];
  byService: { serviceId: ServiceId; ytd: number; fyForecast: number; mix: number; momPct: number }[];
  /** Split of FY forecast between the two charging models. */
  modelSplit: { txn: number; fte: number };
  narrative: string;
  quarters: { key: string; label: string; total: number; isActual: boolean }[];
}

/* ------------------------------------------------------------------ */
/* Usage / activity                                                    */
/* ------------------------------------------------------------------ */

export type MetricFormat = "number" | "currency" | "percent" | "days" | "score" | "hours" | "ratio";

export interface ActivityMetric {
  id: string;
  label: string;
  value: number;
  format: MetricFormat;
  /** Optional supporting caption, e.g. "8 months to 30 Nov 2025". */
  caption?: string;
  deltaPct?: number;
  direction?: Direction;
  series?: number[];
}

/* ------------------------------------------------------------------ */
/* Performance                                                         */
/* ------------------------------------------------------------------ */

export interface SlaComponent {
  id: string;
  label: string;
  weight: number;
  actual: number;
  target: number;
  status: Status;
}

export interface ServiceSla {
  serviceId: ServiceId;
  overall: number;
  target: number;
  status: Status;
  trend: Trend;
  deltaPts: number;
  components: SlaComponent[];
  monthly: { monthKey: string; short: string; value: number; isActual: boolean }[];
}

export interface Kpi {
  id: string;
  serviceId: ServiceId;
  name: string;
  description: string;
  actual: number;
  target: number;
  direction: Direction;
  unit: MetricFormat;
  status: Status;
  trend: Trend;
  deltaPct: number;
  series: { monthKey: string; short: string; value: number; isActual: boolean }[];
  /** e.g. "40% of mandates breached the 30-day threshold". */
  gapNarrative: string;
  /** Volume of work sitting behind the percentage. */
  affectedVolume?: { count: number; ofTotal: number; unit: string };
  relatedIssueIds: string[];
  relatedFeedbackIds: string[];
  sourceSystem: string;
}

/* ------------------------------------------------------------------ */
/* Issues & feedback                                                   */
/* ------------------------------------------------------------------ */

export interface IssueUpdate {
  on: string;
  note: string;
  by: string;
}

export interface Issue {
  id: string;
  ref: string;
  title: string;
  description: string;
  serviceId: ServiceId;
  entityId: string;
  priority: Priority;
  status: IssueStatus;
  category: string;
  openedOn: string;
  agingDays: number;
  slaTargetDays: number;
  owner: string;
  ownerTeam: string;
  linkedKpiId?: string;
  impact: string;
  timeline: IssueUpdate[];
}

export interface Feedback {
  id: string;
  entityId: string;
  serviceId: ServiceId;
  author: string;
  authorRole: string;
  on: string;
  rating: number;
  type: "compliment" | "complaint" | "suggestion";
  quote: string;
  linkedKpiId?: string;
  responded: boolean;
}

export interface NpsQuarter {
  key: string;
  label: string;
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
  respondents: number;
  isPartial: boolean;
}

export interface CustomerExperience {
  csat: number;
  csatDelta: number;
  csatByService: { serviceId: ServiceId; score: number; responses: number }[];
  nps: number;
  npsDelta: number;
  npsQuarters: NpsQuarter[];
  respondents: number;
  openComplaints: number;
  escalations: number;
  responseRate: number;
}

/* ------------------------------------------------------------------ */
/* Automation                                                          */
/* ------------------------------------------------------------------ */

export type BotStatus = "running" | "idle" | "warning" | "failed";

export interface Bot {
  id: string;
  name: string;
  kind: "RPA Bot" | "AI Agent";
  process: string;
  serviceId: ServiceId;
  status: BotStatus;
  jobs: number;
  failedJobs: number;
  successRate: number;
  transactions: number;
  hoursSaved: number;
  avgRuntimeMin: number;
  lastRun: string;
  owner: string;
}

export interface AutomationSnapshot {
  bots: Bot[];
  totalBots: number;
  activeBots: number;
  warningBots: number;
  failedBots: number;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  successRate: number;
  transactionsAutomated: number;
  exceptions: number;
  hoursSavedMonth: number;
  hoursSavedYtd: number;
  costSavingMonth: number;
  costSavingYtd: number;
  automationCostMonth: number;
  netValueMonth: number;
  roi: number;
  blendedHourlyCost: number;
  monthlyHoursSaved: { short: string; value: number; isActual: boolean }[];
  /** Share of eligible volume currently automated, 0–1. */
  automationCoverage: number;
  pipeline: { name: string; stage: string; estHoursMonth: number; goLive: string }[];
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export interface AnalyticsProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  sourceSystem: string;
  refresh: string;
  status: "live" | "in-build" | "available";
  headlineLabel: string;
  headlineValue: number;
  headlineFormat: MetricFormat;
  headlineDeltaPct?: number;
  headlineDirection?: Direction;
  insights: number;
  reports: number;
  users: number;
  highlights: string[];
  series: number[];
  breakdown?: { label: string; value: number; format?: MetricFormat }[];
}

export interface AnalyticsSnapshot {
  products: AnalyticsProduct[];
  liveProducts: number;
  totalReports: number;
  totalInsights: number;
  activeUsers: number;
  valueIdentified: number;
}

/* ------------------------------------------------------------------ */
/* Executive layer                                                     */
/* ------------------------------------------------------------------ */

export interface ExecMetric {
  id: string;
  label: string;
  value: number;
  format: MetricFormat;
  deltaPct?: number;
  direction: Direction;
  note: string;
  sourceSystem: string;
}

export type AttentionKind =
  | "sla-breach"
  | "sla-risk"
  | "kpi-breach"
  | "billing-variance"
  | "ageing-issue"
  | "cx-decline"
  | "automation-failure"
  | "opportunity";

export interface AttentionItem {
  id: string;
  severity: "critical" | "warning" | "info";
  kind: AttentionKind;
  title: string;
  detail: string;
  serviceId?: ServiceId;
  entityId: string;
  metricLabel?: string;
  actual?: string;
  target?: string;
  /** Where clicking through should land. */
  href: string;
  action: string;
}

/* ------------------------------------------------------------------ */
/* Composite snapshots                                                 */
/* ------------------------------------------------------------------ */

export interface ServiceSnapshot {
  service: ServiceDefinition;
  /** The 2–3 numbers that belong on the service card. */
  headline: ActivityMetric[];
  /** Fuller metric set for the service Overview tab. */
  overview: ActivityMetric[];
  activityChart: {
    title: string;
    unit: string;
    series: { short: string; value: number; isActual: boolean }[];
  };
  completion: { completed: number; pending: number; exceptions: number };
  billing: ServiceBilling;
  sla: ServiceSla;
  kpis: Kpi[];
  issueIds: string[];
  feedbackIds: string[];
  /** Contracted capacity utilisation, 0–1. */
  utilisation: number;
  utilisationNote: string;
}

export interface EntitySnapshot {
  entity: Entity;
  location: Location;
  period: Period;
  services: ServiceSnapshot[];
  billing: EntityBilling;
  sla: { overall: number; target: number; status: Status; deltaPts: number; trend: Trend };
  cx: CustomerExperience;
  issues: Issue[];
  feedback: Feedback[];
  attention: AttentionItem[];
  automation: AutomationSnapshot | null;
  analytics: AnalyticsSnapshot | null;
  exec: ExecMetric[];
  counts: {
    openIssues: number;
    criticalIssues: number;
    resolvedThisPeriod: number;
    avgResolutionDays: number;
  };
}
