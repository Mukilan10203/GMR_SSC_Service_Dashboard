import type { Entity, Location, PortalUser, ServiceDefinition, ServiceId } from "../domain/types";

/* ------------------------------------------------------------------ */
/* Locations                                                           */
/* ------------------------------------------------------------------ */

export const LOCATIONS: Location[] = [
  { id: "delhi", name: "Delhi", region: "North" },
  { id: "hyderabad", name: "Hyderabad", region: "South" },
  { id: "chennai", name: "Chennai", region: "South" },
  { id: "mumbai", name: "Mumbai", region: "West" },
  { id: "goa", name: "Goa", region: "West" },
];

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

/**
 * `scale` is the single lever that sizes an entity. Every transaction
 * volume, FTE count, bot count and rupee of billing is derived from it,
 * so switching entity re-prices the whole portal coherently.
 *
 * `opsDelta` shifts service quality in SLA percentage points, which is how
 * different entities end up with genuinely different performance stories.
 */
export const ENTITIES: Entity[] = [
  {
    id: "dial",
    name: "Delhi International Airport",
    shortName: "DIAL",
    legalName: "Delhi International Airport Limited",
    locationId: "delhi",
    sector: "Airport Operations",
    scale: 1.0,
    services: ["fna", "hr", "tax", "automation", "analytics"],
    opsDelta: 0,
    contractStart: "2021-04-01",
    relationshipManager: "Meera Subramanian",
  },
  {
    id: "aerocity",
    name: "Delhi Aerocity Developments",
    shortName: "Aerocity",
    legalName: "Delhi Aerocity Developments Limited",
    locationId: "delhi",
    sector: "Real Estate & Hospitality",
    scale: 0.34,
    services: ["fna", "hr", "tax"],
    opsDelta: -0.6,
    contractStart: "2022-07-01",
    relationshipManager: "Meera Subramanian",
  },
  {
    id: "ddfs",
    name: "Delhi Duty Free Services",
    shortName: "DDFS",
    legalName: "Delhi Duty Free Services Private Limited",
    locationId: "delhi",
    sector: "Retail",
    scale: 0.21,
    services: ["fna", "tax", "analytics"],
    opsDelta: 0.4,
    contractStart: "2023-04-01",
    relationshipManager: "Arjun Bhatia",
  },
  {
    id: "ghial",
    name: "GMR Hyderabad International Airport",
    shortName: "GHIAL",
    legalName: "GMR Hyderabad International Airport Limited",
    locationId: "hyderabad",
    sector: "Airport Operations",
    scale: 0.76,
    services: ["fna", "hr", "tax", "automation"],
    opsDelta: -1.1,
    contractStart: "2021-10-01",
    relationshipManager: "Kavitha Reddy",
  },
  {
    id: "hyd-aero",
    name: "Hyderabad Aerotropolis",
    shortName: "Aerotropolis",
    legalName: "Hyderabad Aerotropolis Limited",
    locationId: "hyderabad",
    sector: "Infrastructure Development",
    scale: 0.19,
    services: ["fna", "hr"],
    opsDelta: -0.3,
    contractStart: "2023-01-01",
    relationshipManager: "Kavitha Reddy",
  },
  {
    id: "chn-power",
    name: "GMR Power & Urban Infra",
    shortName: "GPUIL Chennai",
    legalName: "GMR Power and Urban Infra Limited — Chennai",
    locationId: "chennai",
    sector: "Energy & Urban Infrastructure",
    scale: 0.29,
    services: ["fna", "hr", "analytics"],
    opsDelta: 0.2,
    contractStart: "2022-04-01",
    relationshipManager: "Deepak Varma",
  },
  {
    id: "chn-cargo",
    name: "Chennai Cargo & Logistics",
    shortName: "CCLS",
    legalName: "Chennai Cargo & Logistics Services Limited",
    locationId: "chennai",
    sector: "Cargo & Logistics",
    scale: 0.16,
    services: ["fna", "tax"],
    opsDelta: -0.4,
    contractStart: "2023-07-01",
    relationshipManager: "Deepak Varma",
  },
  {
    id: "mum-aviation",
    name: "Mumbai Aviation Services",
    shortName: "MAS",
    legalName: "Mumbai Aviation Services Limited",
    locationId: "mumbai",
    sector: "Ground Handling",
    scale: 0.27,
    services: ["fna", "hr", "automation"],
    opsDelta: 0.5,
    contractStart: "2022-10-01",
    relationshipManager: "Arjun Bhatia",
  },
  {
    id: "goa-mopa",
    name: "GMR Goa International Airport",
    shortName: "GGIAL",
    legalName: "GMR Goa International Airport Limited (MOPA)",
    locationId: "goa",
    sector: "Airport Operations",
    scale: 0.38,
    services: ["fna", "hr", "tax", "automation"],
    opsDelta: -0.2,
    contractStart: "2023-01-01",
    relationshipManager: "Kavitha Reddy",
  },
];

/* ------------------------------------------------------------------ */
/* Service catalogue                                                   */
/* ------------------------------------------------------------------ */

export const SERVICES: ServiceDefinition[] = [
  {
    id: "fna",
    code: "F&A",
    name: "Finance & Accounting",
    tagline: "Accounts payable, receivable, general ledger and reporting",
    description:
      "End-to-end transaction processing across purchase-to-pay, order-to-cash and record-to-report, including month-end close support and management reporting.",
    colorKey: "fna",
    sourceSystems: ["SAP S/4HANA", "SAP Concur", "Bank host-to-host"],
    slaTarget: 95,
  },
  {
    id: "hr",
    code: "HR",
    name: "Human Resources",
    tagline: "Payroll, talent acquisition and employee lifecycle",
    description:
      "Payroll processing, recruitment support, onboarding and exit administration, and an employee helpdesk covering the full employee lifecycle.",
    colorKey: "hr",
    sourceSystems: ["SuccessFactors", "Darwinbox", "Payroll engine"],
    slaTarget: 90,
  },
  {
    id: "tax",
    code: "Tax",
    name: "Taxation & Compliance",
    tagline: "Direct and indirect tax, filings and assessments",
    description:
      "GST and TDS compliance, statutory return preparation and filing, notice and assessment handling, and advisory support on transaction taxability.",
    colorKey: "tax",
    sourceSystems: ["SAP S/4HANA", "GSTN portal", "TRACES"],
    slaTarget: 97,
  },
  {
    id: "automation",
    code: "Automation",
    name: "Automation & AI",
    tagline: "Digital workforce running your transactions",
    description:
      "A managed fleet of RPA bots and AI agents executing high-volume, rules-based work, monitored through a control tower with exception routing back to human teams.",
    colorKey: "automation",
    sourceSystems: ["RPA Control Tower", "AI Agent Platform"],
    slaTarget: 97,
  },
  {
    id: "analytics",
    code: "Analytics",
    name: "Analytics & Insight",
    tagline: "Decision analytics built on your transaction data",
    description:
      "Curated analytics products over finance, procurement and revenue data — spend, revenue, ageing, variance and open-item analysis — delivered as governed dashboards.",
    colorKey: "analytics",
    sourceSystems: ["SAP S/4HANA", "SAP Ariba", "Local IT systems"],
    slaTarget: 95,
  },
];

export const SERVICE_MAP: Record<ServiceId, ServiceDefinition> = SERVICES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<ServiceId, ServiceDefinition>,
);

/* ------------------------------------------------------------------ */
/* Demo users                                                          */
/* ------------------------------------------------------------------ */

/**
 * Simulated authentication. Each persona demonstrates a different access
 * shape: single entity, multi-entity group scope, and service-restricted.
 */
export const DEMO_PASSWORD = "demo1234";

export const USERS: PortalUser[] = [
  {
    id: "u-cfo-dial",
    name: "Rajiv Menon",
    email: "cfo@delhiairport.demo",
    role: "CFO",
    title: "Chief Financial Officer",
    initials: "RM",
    entityIds: ["dial"],
    demoPassword: DEMO_PASSWORD,
    demoNote: "Single entity · all five services",
  },
  {
    id: "u-group-cfo",
    name: "Ananya Krishnan",
    email: "group.cfo@gmrgroup.demo",
    role: "Group CFO",
    title: "Group Chief Financial Officer",
    initials: "AK",
    entityIds: [
      "dial",
      "aerocity",
      "ddfs",
      "ghial",
      "hyd-aero",
      "chn-power",
      "chn-cargo",
      "mum-aviation",
      "goa-mopa",
    ],
    demoPassword: DEMO_PASSWORD,
    demoNote: "All 9 entities across 5 locations",
  },
  {
    id: "u-ceo-ghial",
    name: "Vikram Rao",
    email: "ceo@hyderabadairport.demo",
    role: "CEO",
    title: "Chief Executive Officer",
    initials: "VR",
    entityIds: ["ghial", "hyd-aero"],
    demoPassword: DEMO_PASSWORD,
    demoNote: "Hyderabad cluster · HR service under stress",
  },
  {
    id: "u-hr-head-dial",
    name: "Suresh Iyer",
    email: "hr.head@delhiairport.demo",
    role: "Head of HR",
    title: "Head — Human Resources",
    initials: "SI",
    entityIds: ["dial"],
    restrictedServices: ["fna", "tax", "analytics"],
    demoPassword: DEMO_PASSWORD,
    demoNote: "Service-scoped access · HR and Automation only",
  },
];

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export const getEntity = (id: string): Entity | undefined => ENTITIES.find((e) => e.id === id);
export const getLocation = (id: string): Location | undefined => LOCATIONS.find((l) => l.id === id);
export const getUserByEmail = (email: string): PortalUser | undefined =>
  USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

/** Services this user may see for this entity = entity scope ∩ user scope. */
export function authorisedServices(user: PortalUser, entity: Entity): ServiceId[] {
  const blocked = new Set(user.restrictedServices ?? []);
  return entity.services.filter((s) => !blocked.has(s));
}
