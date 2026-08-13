import type {
  Entity,
  EntitySnapshot,
  Issue,
  Location,
  Period,
  PortalUser,
  ServiceId,
  ServiceSnapshot,
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
  SERVICES,
  USERS,
} from "./mock/organisation";

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

export function canAccessEntity(user: PortalUser, entityId: string): boolean {
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
): EntitySnapshot | null {
  if (!canAccessEntity(user, entityId)) return null;

  const services = getAuthorisedServices(user, entityId);
  const key = `${entityId}|${periodId}|${services.join(",")}`;

  const hit = snapshotCache.get(key);
  if (hit) return hit;

  const snapshot = buildEntitySnapshot(entityId, periodId, services);
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
