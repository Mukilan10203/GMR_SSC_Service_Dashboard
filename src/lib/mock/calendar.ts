import type { FiscalMonth, Period } from "../domain/types";

/**
 * Indian fiscal calendar: FY 2026 runs Apr 2025 → Mar 2026.
 *
 * The prototype has a fixed "as of" date so every screen tells the same
 * story on every run. FY 2026 is in flight — eight months closed, four
 * months forecast — which is what lets the portal show YTD actuals
 * against a full-year forecast the way a real CFO view does.
 */
export const DEMO_AS_OF = "2025-11-30";
export const DEMO_AS_OF_LABEL = "30 Nov 2025";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Fiscal position 0..11 → calendar month number 1..12 (Apr = position 0). */
const FISCAL_TO_CALENDAR = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

export interface PeriodDefinition {
  id: string;
  label: string;
  short: string;
  /** Calendar year in which April falls. */
  startYear: number;
  actualMonthCount: number;
  /** Scales all activity vs the current year — drives YoY comparisons. */
  volumeFactor: number;
  isCurrent: boolean;
}

export const PERIOD_DEFINITIONS: PeriodDefinition[] = [
  {
    id: "fy2026",
    label: "FY 2026",
    short: "FY26",
    startYear: 2025,
    actualMonthCount: 8,
    volumeFactor: 1.0,
    isCurrent: true,
  },
  {
    id: "fy2025",
    label: "FY 2025",
    short: "FY25",
    startYear: 2024,
    actualMonthCount: 12,
    volumeFactor: 0.831,
    isCurrent: false,
  },
  {
    id: "fy2024",
    label: "FY 2024",
    short: "FY24",
    startYear: 2023,
    actualMonthCount: 12,
    volumeFactor: 0.676,
    isCurrent: false,
  },
];

export const DEFAULT_PERIOD_ID = "fy2026";

function buildMonths(def: PeriodDefinition): FiscalMonth[] {
  return FISCAL_TO_CALENDAR.map((cm, i) => {
    const calendarYear = cm >= 4 ? def.startYear : def.startYear + 1;
    const short = MONTH_NAMES[cm - 1];
    return {
      index: i,
      key: `${def.id}-${String(cm).padStart(2, "0")}`,
      label: `${short} ${calendarYear}`,
      short,
      calendarYear,
      quarter: (Math.floor(i / 3) + 1) as 1 | 2 | 3 | 4,
      isActual: i < def.actualMonthCount,
    };
  });
}

const periodCache = new Map<string, Period>();

export function getPeriod(periodId: string): Period {
  const cached = periodCache.get(periodId);
  if (cached) return cached;

  const def = PERIOD_DEFINITIONS.find((p) => p.id === periodId) ?? PERIOD_DEFINITIONS[0];
  const months = buildMonths(def);
  const period: Period = {
    id: def.id,
    label: def.label,
    short: def.short,
    range: `${months[0].label} – ${months[11].label}`,
    months,
    actualMonthCount: def.actualMonthCount,
    isCurrent: def.isCurrent,
    asOf: def.isCurrent
      ? DEMO_AS_OF_LABEL
      : `31 Mar ${def.startYear + 1}`,
  };
  periodCache.set(periodId, period);
  return period;
}

export function getPeriodDefinition(periodId: string): PeriodDefinition {
  return PERIOD_DEFINITIONS.find((p) => p.id === periodId) ?? PERIOD_DEFINITIONS[0];
}

export function getPriorPeriodId(periodId: string): string | null {
  const i = PERIOD_DEFINITIONS.findIndex((p) => p.id === periodId);
  if (i === -1 || i === PERIOD_DEFINITIONS.length - 1) return null;
  return PERIOD_DEFINITIONS[i + 1].id;
}

export const listPeriods = (): PeriodDefinition[] => PERIOD_DEFINITIONS;

/** Fiscal quarter labels, Q1 = Apr–Jun. */
export const QUARTERS = [
  { key: "q1", label: "Q1", span: "Apr–Jun", months: [0, 1, 2] },
  { key: "q2", label: "Q2", span: "Jul–Sep", months: [3, 4, 5] },
  { key: "q3", label: "Q3", span: "Oct–Dec", months: [6, 7, 8] },
  { key: "q4", label: "Q4", span: "Jan–Mar", months: [9, 10, 11] },
] as const;
