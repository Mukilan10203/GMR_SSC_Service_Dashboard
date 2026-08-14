import type {
  AttentionItem,
  Entity,
  EntitySnapshot,
  Feedback,
  Issue,
  Location,
  Period,
  PortalUser,
  ServiceDefinition,
  ServiceId,
  ServiceSnapshot,
  Status,
} from "./domain/types";
import { buildEntitySnapshot } from "./mock/engine";
import { getPeriod, listPeriods } from "./mock/calendar";
import {
  authorisedServices,
  DEMO_PASSWORD,
  ENTITIES,
  getEntity,
  getUserByEmail,
  LOCATIONS,
  LOCKED_SERVICE_IDS,
  SERVICE_MAP,
  SERVICES,
  USERS,
} from "./mock/organisation";
import { gradeAgainstTarget } from "./format";

/**
 * ─────────────────────────────────────────────────────────────────────
 *  THE INTEGRATION SEAM
 * ─────────────────────────────────────────────────────────────────────
 *
 * Every screen in this application reads its data through this module and
 * nothing else. No page or component imports from `lib/mock/*` directly.
 *
 * To move from prototype to production you replace the bodies of these
 * functions — the return types are already the contract:
 *
 *   authenticate()   → identity provider / SSO
 *   getSnapshot()    → composition API over SAP S/4HANA, Ariba, HRMS,
 *                      the RPA control tower and the analytics warehouse
 *   getServiceDetail → the same, scoped to one service tower
 *
 * If the real sources are remote, change these to `async` and the calling
 * pages to server components that `await` them. Nothing else needs to move.
 */

/* ------------------------------------------------------------------ */
/* Authentication (simulated)                                          */
/* ------------------------------------------------------------------ */

export interface AuthSuccess {
  ok: true;
  user: PortalUser;
}
export interface AuthFailure {
  ok: false;
  error: string;
}

export function authenticate(email: string, password: string): AuthSuccess | AuthFailure {
  const user = getUserByEmail(email);
  if (!user) {
    return { ok: false, error: "We do not recognise that email address." };
  }
  if (password !== user.demoPassword) {
    return { ok: false, error: "Incorrect password. Use the demo password shown below." };
  }
  return { ok: true, user };
}

export const listDemoUsers = (): PortalUser[] => USERS;
export const demoPassword = DEMO_PASSWORD;

export const findUserById = (id: string): PortalUser | undefined => USERS.find((u) => u.id === id);

/* ------------------------------------------------------------------ */
/* Scope — what this user is allowed to look at                        */
/* ------------------------------------------------------------------ */

export interface UserScope {
  entities: Entity[];
  locations: Location[];
  periods: { id: string; label: string; short: string; isCurrent: boolean }[];
  defaultEntityId: string;
  defaultPeriodId: string;
}

export function getUserScope(user: PortalUser): UserScope {
  const entities = ENTITIES.filter((e) => user.entityIds.includes(e.id));
  const locationIds = new Set(entities.map((e) => e.locationId));
  return {
    entities,
    locations: LOCATIONS.filter((l) => locationIds.has(l.id)),
    periods: listPeriods().map((p) => ({
      id: p.id,
      label: p.label,
      short: p.short,
      isCurrent: p.isCurrent,
    })),
    defaultEntityId: entities[0]?.id ?? ENTITIES[0].id,
    defaultPeriodId: listPeriods()[0].id,
  };
}

/** True for accounts belonging to the SSC itself rather than to a customer. */
export const isProvider = (user: PortalUser): boolean => user.kind === "ssc";

/**
 * The towers an SSC account is responsible for. The SSC head — the only SSC
 * account today — sees every live tower. A narrower SSC role would be
 * limited with `restrictedServices`, the same mechanism that narrows a
 * service-scoped customer account, and this function already honours it.
 */
export function providerTowers(user: PortalUser): ServiceDefinition[] {
  const blocked = new Set([...(user.restrictedServices ?? []), ...LOCKED_SERVICE_IDS]);
  return SERVICES.filter((s) => !blocked.has(s.id));
}

export function canAccessEntity(user: PortalUser, entityId: string): boolean {
  // The SSC delivers to every entity, so it may read every entity.
  if (isProvider(user)) return true;
  return user.entityIds.includes(entityId);
}

export function getAuthorisedServices(user: PortalUser, entityId: string): ServiceId[] {
  const entity = getEntity(entityId);
  if (!entity) return [];
  return authorisedServices(user, entity);
}

/* ------------------------------------------------------------------ */
/* Snapshots                                                           */
/* ------------------------------------------------------------------ */

/**
 * Building a snapshot walks the full rate card for twelve months across
 * every service, so it is memoised. In production this cache is where an
 * HTTP response cache or a React `cache()` boundary would sit.
 */
const snapshotCache = new Map<string, EntitySnapshot>();
const CACHE_LIMIT = 48;

export function getSnapshot(
  user: PortalUser,
  entityId: string,
  periodId: string,
  monthIndex?: number | null,
): EntitySnapshot | null {
  if (!canAccessEntity(user, entityId)) return null;

  const services = getAuthorisedServices(user, entityId);
  const key = `${entityId}|${periodId}|${services.join(",")}|${monthIndex ?? "latest"}`;

  const hit = snapshotCache.get(key);
  if (hit) return hit;

  const snapshot = buildEntitySnapshot(entityId, periodId, services, monthIndex ?? undefined);
  if (snapshotCache.size >= CACHE_LIMIT) {
    const oldest = snapshotCache.keys().next().value;
    if (oldest) snapshotCache.delete(oldest);
  }
  snapshotCache.set(key, snapshot);
  return snapshot;
}

export function getServiceDetail(
  user: PortalUser,
  entityId: string,
  periodId: string,
  serviceId: string,
): { snapshot: EntitySnapshot; service: ServiceSnapshot } | null {
  const snapshot = getSnapshot(user, entityId, periodId);
  if (!snapshot) return null;
  const service = snapshot.services.find((s) => s.service.id === serviceId);
  if (!service) return null;
  return { snapshot, service };
}

export function getIssue(
  user: PortalUser,
  entityId: string,
  periodId: string,
  issueId: string,
): Issue | null {
  const snapshot = getSnapshot(user, entityId, periodId);
  return snapshot?.issues.find((i) => i.id === issueId) ?? null;
}

/**
 * Cross-entity roll-up for users with group scope. Used by the entity
 * comparison view so a Group CFO can see the whole portfolio at once.
 */
export interface EntityRollup {
  entity: Entity;
  location: Location;
  ytdBilling: number;
  fyForecast: number;
  sla: number;
  slaTarget: number;
  csat: number;
  nps: number;
  openIssues: number;
  criticalIssues: number;
  serviceCount: number;
  momPct: number;
}

export function getPortfolio(user: PortalUser, periodId: string): EntityRollup[] {
  return user.entityIds
    .map((id) => {
      const s = getSnapshot(user, id, periodId);
      if (!s) return null;
      return {
        entity: s.entity,
        location: s.location,
        ytdBilling: s.billing.ytd,
        fyForecast: s.billing.fyForecast,
        sla: s.sla.overall,
        slaTarget: s.sla.target,
        csat: s.cx.csat,
        nps: s.cx.nps,
        openIssues: s.counts.openIssues,
        criticalIssues: s.counts.criticalIssues,
        serviceCount: s.services.length,
        momPct: s.billing.momPct,
      } satisfies EntityRollup;
    })
    .filter((x): x is EntityRollup => x !== null)
    .sort((a, b) => b.fyForecast - a.fyForecast);
}

/* ------------------------------------------------------------------ */
/* The estate — the SSC's own view of every customer at once           */
/* ------------------------------------------------------------------ */

/**
 * The customer portal reads one entity across many towers. The delivery
 * console reads the same records the other way round: one tower across many
 * customers, and one queue holding every open issue in the estate.
 *
 * Nothing new is generated here. Each customer's snapshot is built by the
 * same engine and served from the same cache the customer portal uses — this
 * layer only re-pivots and aggregates. Tower scope is honoured, so an F&A
 * tower lead's estate contains F&A and nothing else.
 */

export interface EstateIssue extends Issue {
  entityName: string;
  entityShortName: string;
  locationName: string;
  serviceCode: string;
  /** Still open, and already past its agreed resolution target. */
  breached: boolean;
}

export interface EstateFeedback extends Feedback {
  entityName: string;
  serviceCode: string;
}

/** One customer, as the SSC sees it: delivery health plus the account owner. */
export interface CustomerRollup extends EntityRollup {
  relationshipManager: string;
  breachedIssues: number;
  unansweredFeedback: number;
  status: Status;
}

/** One tower, across every customer it is delivered to. */
export interface TowerRollup {
  service: ServiceDefinition;
  customerCount: number;
  sla: number;
  target: number;
  status: Status;
  ytd: number;
  fyForecast: number;
  openIssues: number;
  criticalIssues: number;
  breachedIssues: number;
  csat: number;
  utilisation: number;
  /** The customer this tower is currently serving worst. */
  weakest: { name: string; sla: number } | null;
}

export interface EstateSummary {
  periodLabel: string;
  asOf: string;
  customers: CustomerRollup[];
  towers: TowerRollup[];
  issues: EstateIssue[];
  feedback: EstateFeedback[];
  attention: (AttentionItem & { entityName: string })[];
  totals: {
    customers: number;
    customersOffTarget: number;
    towers: number;
    ytdBilling: number;
    fyForecast: number;
    outstanding: number;
    sla: number;
    slaTarget: number;
    csat: number;
    openIssues: number;
    criticalIssues: number;
    breachedIssues: number;
    unansweredFeedback: number;
  };
}

const estateCache = new Map<string, EstateSummary>();

/** Weighted by fee, so the big customers move the estate number more. */
const weighted = (rows: { value: number; weight: number }[]): number => {
  const w = rows.reduce((a, r) => a + r.weight, 0);
  if (w <= 0) return 0;
  return rows.reduce((a, r) => a + r.value * r.weight, 0) / w;
};

export function getEstateSummary(
  user: PortalUser,
  periodId: string,
  monthIndex?: number | null,
): EstateSummary | null {
  if (!isProvider(user)) return null;

  const key = `${user.id}|${periodId}|${monthIndex ?? "latest"}`;
  const hit = estateCache.get(key);
  if (hit) return hit;

  const snapshots = ENTITIES.map((e) => getSnapshot(user, e.id, periodId, monthIndex)).filter(
    (s): s is EntitySnapshot => s !== null && s.services.length > 0,
  );

  const customers: CustomerRollup[] = snapshots
    .map((s) => {
      const breachedIssues = s.issues.filter(
        (i) => i.status !== "resolved" && i.agingDays > i.slaTargetDays,
      ).length;
      return {
        entity: s.entity,
        location: s.location,
        ytdBilling: s.billing.ytd,
        fyForecast: s.billing.fyForecast,
        sla: s.sla.overall,
        slaTarget: s.sla.target,
        csat: s.cx.csat,
        nps: s.cx.nps,
        openIssues: s.counts.openIssues,
        criticalIssues: s.counts.criticalIssues,
        serviceCount: s.services.length,
        momPct: s.billing.momPct,
        relationshipManager: s.entity.relationshipManager,
        breachedIssues,
        unansweredFeedback: s.feedback.filter((f) => !f.responded).length,
        status: s.sla.status,
      } satisfies CustomerRollup;
    })
    .sort((a, b) => b.fyForecast - a.fyForecast);

  const issues: EstateIssue[] = snapshots
    .flatMap((s) =>
      s.issues.map((i) => ({
        ...i,
        entityName: s.entity.name,
        entityShortName: s.entity.shortName,
        locationName: s.location.name,
        serviceCode: SERVICE_MAP[i.serviceId].code,
        breached: i.status !== "resolved" && i.agingDays > i.slaTargetDays,
      })),
    )
    // Worst first: breached before on-track, then oldest relative to target.
    .sort((a, b) => {
      if (a.breached !== b.breached) return a.breached ? -1 : 1;
      return b.agingDays - b.slaTargetDays - (a.agingDays - a.slaTargetDays);
    });

  const feedback: EstateFeedback[] = snapshots
    .flatMap((s) =>
      s.feedback.map((f) => ({
        ...f,
        entityName: s.entity.name,
        serviceCode: SERVICE_MAP[f.serviceId].code,
      })),
    )
    .sort((a, b) => Number(a.responded) - Number(b.responded));

  const towers: TowerRollup[] = providerTowers(user)
    .map((def): TowerRollup | null => {
      const rows = snapshots
        .map((s) => ({ snapshot: s, service: s.services.find((x) => x.service.id === def.id) }))
        .filter((r): r is { snapshot: EntitySnapshot; service: ServiceSnapshot } => !!r.service);

      if (rows.length === 0) return null;

      const towerIssues = issues.filter((i) => i.serviceId === def.id && i.status !== "resolved");
      const sla = weighted(
        rows.map((r) => ({ value: r.service.sla.overall, weight: r.service.billing.fyForecast })),
      );
      const target = weighted(
        rows.map((r) => ({ value: r.service.sla.target, weight: r.service.billing.fyForecast })),
      );
      // Worst customer for this tower, measured as distance below its own
      // target — targets differ by tower, so raw SLA would not compare.
      const weakest =
        rows
          .map((r) => ({
            name: r.snapshot.entity.shortName,
            sla: r.service.sla.overall,
            gap: r.service.sla.overall - r.service.sla.target,
          }))
          .sort((a, b) => a.gap - b.gap)
          .map(({ name, sla }) => ({ name, sla }))[0] ?? null;

      return {
        service: def,
        customerCount: rows.length,
        sla,
        target,
        status: gradeAgainstTarget(sla, target, "higher-better", 0.03),
        ytd: rows.reduce((a, r) => a + r.service.billing.ytd, 0),
        fyForecast: rows.reduce((a, r) => a + r.service.billing.fyForecast, 0),
        openIssues: towerIssues.length,
        criticalIssues: towerIssues.filter((i) => i.priority === "critical").length,
        breachedIssues: towerIssues.filter((i) => i.breached).length,
        csat: weighted(
          rows.map((r) => ({
            value:
              r.snapshot.cx.csatByService.find((c) => c.serviceId === def.id)?.score ??
              r.snapshot.cx.csat,
            weight: r.service.billing.fyForecast,
          })),
        ),
        utilisation: weighted(
          rows.map((r) => ({ value: r.service.utilisation, weight: r.service.billing.fyForecast })),
        ),
        weakest,
      };
    })
    .filter((t): t is TowerRollup => t !== null)
    .sort((a, b) => b.fyForecast - a.fyForecast);

  const attention = snapshots
    .flatMap((s) => s.attention.map((a) => ({ ...a, entityName: s.entity.shortName })))
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    });

  const openIssues = issues.filter((i) => i.status !== "resolved");
  const summary: EstateSummary = {
    periodLabel: snapshots[0]?.period.label ?? "",
    asOf: snapshots[0]?.period.asOf ?? "",
    customers,
    towers,
    issues,
    feedback,
    attention,
    totals: {
      customers: customers.length,
      customersOffTarget: customers.filter((c) => c.status !== "good").length,
      towers: towers.length,
      ytdBilling: customers.reduce((a, c) => a + c.ytdBilling, 0),
      fyForecast: customers.reduce((a, c) => a + c.fyForecast, 0),
      outstanding: snapshots.reduce((a, s) => a + s.billing.outstanding, 0),
      sla: weighted(customers.map((c) => ({ value: c.sla, weight: c.fyForecast }))),
      slaTarget: weighted(customers.map((c) => ({ value: c.slaTarget, weight: c.fyForecast }))),
      csat: weighted(customers.map((c) => ({ value: c.csat, weight: c.fyForecast }))),
      openIssues: openIssues.length,
      criticalIssues: openIssues.filter((i) => i.priority === "critical").length,
      breachedIssues: openIssues.filter((i) => i.breached).length,
      unansweredFeedback: feedback.filter((f) => !f.responded).length,
    },
  };

  if (estateCache.size >= 12) {
    const oldest = estateCache.keys().next().value;
    if (oldest) estateCache.delete(oldest);
  }
  estateCache.set(key, summary);
  return summary;
}

/* ------------------------------------------------------------------ */
/* Offerings — the catalogue, and who has taken what                   */
/* ------------------------------------------------------------------ */

/**
 * Where one service sits for one entity:
 *  live        — contracted, and switched on in this build
 *  coming-soon — contracted, but not yet released in this build
 *  available   — not contracted; this is the offer
 */
export type OfferingState = "live" | "coming-soon" | "available";

export interface Offering {
  service: ServiceDefinition;
  state: OfferingState;
  /** How many entities across the group already contract this tower. */
  adoption: { taken: number; total: number };
  /** What the customer gets, stated from the catalogue rather than invented. */
  delivers: string[];
  /** Present only when the tower is live for this entity. */
  live: {
    slaActual: number;
    slaTarget: number;
    status: Status;
    ytdSpend: number;
    kpiCount: number;
    subServiceCount: number;
  } | null;
}

export function listOfferings(user: PortalUser, entityId: string, periodId: string): Offering[] {
  const entity = getEntity(entityId);
  if (!entity) return [];

  const snapshot = getSnapshot(user, entityId, periodId);
  const contracted = new Set(entity.services);
  const locked = new Set(LOCKED_SERVICE_IDS);
  const withheld = new Set(user.restrictedServices ?? []);

  return SERVICES.map((service) => {
    const state: OfferingState = !contracted.has(service.id)
      ? "available"
      : locked.has(service.id) || withheld.has(service.id)
        ? "coming-soon"
        : "live";

    const taken = ENTITIES.filter((e) => e.services.includes(service.id)).length;
    const live = snapshot?.services.find((s) => s.service.id === service.id) ?? null;

    return {
      service,
      state,
      adoption: { taken, total: ENTITIES.length },
      delivers: [
        `${service.subServices.length} sub-services: ${service.subServices
          .map((s) => s.name)
          .join(", ")}`,
        `Service level committed at ${service.slaTarget}%`,
        `Delivered from ${service.sourceSystems.join(", ")}`,
      ],
      live: live
        ? {
            slaActual: live.sla.overall,
            slaTarget: live.sla.target,
            status: live.sla.status,
            ytdSpend: live.billing.ytd,
            kpiCount: live.kpis.length,
            subServiceCount: live.subServices.length,
          }
        : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Adoption — which customer took which offering, and what it returned */
/* ------------------------------------------------------------------ */

export interface CustomerAdoption {
  entity: Entity;
  location: Location;
  towers: { service: ServiceDefinition; state: OfferingState }[];
  liveCount: number;
  contractedCount: number;
  /** What the customer got back for it. All measured, none asserted. */
  benefits: {
    billedYtd: number;
    slaActual: number;
    slaTarget: number;
    slaStatus: Status;
    csat: number;
    nps: number;
    issuesResolved: number;
    avgResolutionDays: number;
    hoursSavedYtd: number;
    costSavingYtd: number;
    transactionsAutomated: number;
    automationRoi: number;
    automationCoverage: number;
    analyticsValue: number;
  };
}

export function getAdoption(
  user: PortalUser,
  periodId: string,
  monthIndex?: number | null,
): CustomerAdoption[] {
  if (!isProvider(user)) return [];
  const locked = new Set(LOCKED_SERVICE_IDS);

  return ENTITIES.map((entity) => {
    const s = getSnapshot(user, entity.id, periodId, monthIndex);
    if (!s) return null;

    const contracted = new Set(entity.services);
    const towers = SERVICES.map((service) => ({
      service,
      state: (!contracted.has(service.id)
        ? "available"
        : locked.has(service.id)
          ? "coming-soon"
          : "live") as OfferingState,
    }));

    return {
      entity,
      location: s.location,
      towers,
      liveCount: towers.filter((t) => t.state === "live").length,
      contractedCount: entity.services.length,
      benefits: {
        billedYtd: s.billing.ytd,
        slaActual: s.sla.overall,
        slaTarget: s.sla.target,
        slaStatus: s.sla.status,
        csat: s.cx.csat,
        nps: s.cx.nps,
        issuesResolved: s.counts.resolvedThisPeriod,
        avgResolutionDays: s.counts.avgResolutionDays,
        hoursSavedYtd: s.automation?.hoursSavedYtd ?? 0,
        costSavingYtd: s.automation?.costSavingYtd ?? 0,
        transactionsAutomated: s.automation?.transactionsAutomated ?? 0,
        automationRoi: s.automation?.roi ?? 0,
        automationCoverage: s.automation?.automationCoverage ?? 0,
        analyticsValue: s.analytics?.valueIdentified ?? 0,
      },
    } satisfies CustomerAdoption;
  })
    .filter((r): r is CustomerAdoption => r !== null)
    .sort((a, b) => b.benefits.billedYtd - a.benefits.billedYtd);
}

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const listServices = () => SERVICES;
export const listLocations = () => LOCATIONS;
export const getPeriodById = (id: string): Period => getPeriod(id);
export { getEntity };

/**
 * The conceptual system-of-record map. Displayed in the UI so the customer
 * can see where each number would come from — no integration is performed.
 */
export const DATA_SOURCE_MAP: { area: string; systems: string[]; status: string }[] = [
  {
    area: "F&A — AP, AR, Travel, R2R, Treasury",
    systems: ["SAP S/4HANA", "SAP Concur", "Bank host-to-host"],
    status: "Planned",
  },
  {
    area: "HR Ops — TA, Payroll, L&D, Core HR",
    systems: ["SAP SuccessFactors", "Payroll engine", "HR service desk"],
    status: "Planned",
  },
  {
    area: "Procurement & Contracts",
    systems: ["SAP Ariba", "SAP S/4HANA", "SAP MDG"],
    status: "Planned",
  },
  {
    area: "Indirect Tax",
    systems: ["GSTN portal", "IRP / NIC e-invoice", "SAP S/4HANA"],
    status: "Planned",
  },
  {
    area: "Direct Tax",
    systems: ["TRACES", "Income Tax portal", "SAP S/4HANA"],
    status: "Planned",
  },
  { area: "Automation", systems: ["RPA Control Tower", "AI Agent Platform"], status: "Planned" },
  {
    area: "Analytics & revenue",
    systems: ["SAP S/4HANA", "SAP Ariba", "Local IT systems"],
    status: "Planned",
  },
  { area: "Service management", systems: ["SSC Service Management"], status: "Planned" },
];
