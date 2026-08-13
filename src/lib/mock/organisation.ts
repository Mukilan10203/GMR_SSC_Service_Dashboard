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
    services: ["fna", "hrops", "procurement", "idt", "dt"],
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
    services: ["fna", "hrops", "idt"],
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
    services: ["fna", "procurement", "idt"],
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
    services: ["fna", "hrops", "procurement", "idt", "dt"],
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
    services: ["fna", "hrops"],
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
    services: ["fna", "hrops", "procurement"],
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
    services: ["fna", "idt"],
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
    services: ["fna", "hrops", "procurement"],
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
    services: ["fna", "hrops", "idt", "dt"],
    opsDelta: -0.2,
    contractStart: "2023-01-01",
    relationshipManager: "Kavitha Reddy",
  },
];

/* ------------------------------------------------------------------ */
/* Service catalogue                                                   */
/* ------------------------------------------------------------------ */

/**
 * The SSC's five service towers, and the sub-services delivered inside each.
 *
 * The sub-service list is not decoration: every entry names an SLA component
 * in `SLA_COMPONENTS`, so the service level a customer sees on a tower is a
 * weighted roll-up of exactly these sub-services.
 *
 * SAP SuccessFactors deliberately appears as a *system*, not a sub-service —
 * HR Ops runs on it, it is not something the SSC sells.
 */
export const SERVICES: ServiceDefinition[] = [
  {
    id: "fna",
    code: "F&A",
    name: "Finance & Accounting",
    tagline: "Payables, receivables, travel, record to report and treasury",
    description:
      "End-to-end finance transaction processing across purchase-to-pay, order-to-cash, employee travel and expense, record-to-report close and reporting, and day-to-day treasury operations.",
    subServices: [
      {
        id: "fna-ap",
        code: "AP",
        name: "Accounts Payable",
        description:
          "Supplier invoice capture, three-way match, exception clearing and payment-ready posting.",
        slaComponentId: "fna-sla-ap",
      },
      {
        id: "fna-ar",
        code: "AR",
        name: "Accounts Receivable",
        description:
          "Customer invoicing, receipt application, dunning and collections support against the debtors ledger.",
        slaComponentId: "fna-sla-ar",
      },
      {
        id: "fna-travel",
        code: "Travel",
        name: "Travel & Expense",
        description:
          "Travel request and claim processing, policy audit, and employee reimbursement settlement.",
        slaComponentId: "fna-sla-travel",
      },
      {
        id: "fna-r2r",
        code: "R2R",
        name: "Record to Report",
        description:
          "Journals, reconciliations, intercompany matching, month-end close and the management reporting pack.",
        slaComponentId: "fna-sla-r2r",
      },
      {
        id: "fna-treasury",
        code: "Treasury",
        name: "Treasury",
        description:
          "Payment runs, bank host-to-host processing, bank reconciliation and daily cash position reporting.",
        slaComponentId: "fna-sla-treasury",
      },
    ],
    colorKey: "fna",
    sourceSystems: ["SAP S/4HANA", "SAP Concur", "Bank host-to-host"],
    slaTarget: 95,
  },
  {
    id: "hrops",
    code: "HR Ops",
    name: "HR Operations",
    tagline: "Talent acquisition, payroll and learning, run on SAP SuccessFactors",
    description:
      "Recruitment support from requisition to offer, end-to-end payroll processing, learning and development administration, and the employee lifecycle and helpdesk operations that sit on SAP SuccessFactors.",
    subServices: [
      {
        id: "hrops-ta",
        code: "TA",
        name: "Talent Acquisition",
        description:
          "Requisition intake, sourcing, screening, interview coordination and offer administration.",
        slaComponentId: "hrops-sla-ta",
      },
      {
        id: "hrops-payroll",
        code: "Payroll",
        name: "Payroll",
        description:
          "Input consolidation, payroll run, statutory deductions, off-cycle corrections and full-and-final settlements.",
        slaComponentId: "hrops-sla-payroll",
      },
      {
        id: "hrops-lnd",
        code: "L&D",
        name: "Learning & Development",
        description:
          "Training calendar administration, enrolment and attendance, compliance curricula and completion tracking.",
        slaComponentId: "hrops-sla-lnd",
      },
      {
        id: "hrops-core",
        code: "Core HR",
        name: "Employee Lifecycle & Helpdesk",
        description:
          "Onboarding and exit formalities, employee data administration and the tier-1 employee helpdesk on SAP SuccessFactors.",
        slaComponentId: "hrops-sla-core",
      },
    ],
    colorKey: "hrops",
    sourceSystems: ["SAP SuccessFactors", "Payroll engine", "HR service desk"],
    slaTarget: 90,
  },
  {
    id: "procurement",
    code: "P&C",
    name: "Procurement & Contracts",
    tagline: "Sourcing, purchase orders, contracts and vendor management",
    description:
      "Operational procurement from requisition to purchase order, sourcing event support, contract drafting, renewal and repository management, and vendor onboarding and master data.",
    subServices: [
      {
        id: "proc-po",
        code: "P2P",
        name: "Requisition & Purchase Orders",
        description:
          "Requisition validation, purchase order creation, amendment and expediting against agreed catalogues.",
        slaComponentId: "proc-sla-po",
      },
      {
        id: "proc-sourcing",
        code: "Sourcing",
        name: "Sourcing & Category Support",
        description:
          "RFx preparation, bid administration, comparative analysis and negotiation support for category teams.",
        slaComponentId: "proc-sla-sourcing",
      },
      {
        id: "proc-contract",
        code: "CLM",
        name: "Contract Lifecycle",
        description:
          "Contract drafting from templates, renewal tracking, obligation management and the central contract repository.",
        slaComponentId: "proc-sla-contract",
      },
      {
        id: "proc-vendor",
        code: "Vendor",
        name: "Vendor Management",
        description:
          "Vendor onboarding, due diligence, bank detail verification and vendor master data maintenance.",
        slaComponentId: "proc-sla-vendor",
      },
    ],
    colorKey: "procurement",
    sourceSystems: ["SAP Ariba", "SAP S/4HANA", "SAP MDG"],
    slaTarget: 95,
  },
  {
    id: "idt",
    code: "IDT",
    name: "Indirect Tax",
    tagline: "GST compliance, e-invoicing, input credit and assessments",
    description:
      "GST return preparation and filing, e-invoice and e-way bill generation, input tax credit reconciliation against GSTR-2B, and notice, audit and assessment handling.",
    subServices: [
      {
        id: "idt-return",
        code: "GST",
        name: "GST Returns & Compliance",
        description:
          "GSTR-1, GSTR-3B and annual return preparation, review and filing before the statutory due date.",
        slaComponentId: "idt-sla-filing",
      },
      {
        id: "idt-einvoice",
        code: "E-Inv",
        name: "E-Invoicing & E-Way Bills",
        description:
          "IRN generation, QR posting and e-way bill issue against the invoice register, with failure re-processing.",
        slaComponentId: "idt-sla-einvoice",
      },
      {
        id: "idt-itc",
        code: "ITC",
        name: "Input Tax Credit",
        description:
          "Purchase register to GSTR-2B reconciliation, mismatch follow-up with vendors and credit eligibility review.",
        slaComponentId: "idt-sla-itc",
      },
      {
        id: "idt-notice",
        code: "Notices",
        name: "Notices & Assessments",
        description:
          "GST notice logging, response preparation, departmental audit support and litigation documentation.",
        slaComponentId: "idt-sla-notice",
      },
    ],
    colorKey: "idt",
    sourceSystems: ["GSTN portal", "IRP / NIC e-invoice", "SAP S/4HANA"],
    slaTarget: 97,
  },
  {
    id: "dt",
    code: "DT",
    name: "Direct Tax",
    tagline: "Withholding tax, corporate returns, transfer pricing and assessments",
    description:
      "TDS and withholding compliance, corporate tax computation and return filing, transfer pricing documentation, and assessment and litigation support.",
    subServices: [
      {
        id: "dt-tds",
        code: "TDS",
        name: "Withholding Tax",
        description:
          "TDS determination, monthly deposit, quarterly statement filing and lower-deduction certificate tracking.",
        slaComponentId: "dt-sla-tds",
      },
      {
        id: "dt-cert",
        code: "Certs",
        name: "TDS Certificates",
        description:
          "Form 16 and 16A generation from TRACES, vendor and employee distribution and query resolution.",
        slaComponentId: "dt-sla-cert",
      },
      {
        id: "dt-return",
        code: "Returns",
        name: "Corporate Tax Returns",
        description:
          "Advance tax computation, tax provision support, and corporate income tax return preparation and filing.",
        slaComponentId: "dt-sla-return",
      },
      {
        id: "dt-assessment",
        code: "TP & Assmt",
        name: "Transfer Pricing & Assessments",
        description:
          "Transfer pricing documentation and benchmarking, scrutiny assessment responses and appellate support.",
        slaComponentId: "dt-sla-assessment",
      },
    ],
    colorKey: "dt",
    sourceSystems: ["TRACES", "Income Tax portal", "SAP S/4HANA"],
    slaTarget: 97,
  },
];

/** Sub-service lookup by SLA component id — used to label the decomposition. */
export const SUB_SERVICE_BY_SLA_COMPONENT = SERVICES.reduce(
  (acc, s) => {
    for (const sub of s.subServices) acc[sub.slaComponentId] = sub;
    return acc;
  },
  {} as Record<string, ServiceDefinition["subServices"][number]>,
);

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
    demoNote: "Hyderabad cluster · HR Ops under stress",
  },
  {
    id: "u-hr-head-dial",
    name: "Suresh Iyer",
    email: "hr.head@delhiairport.demo",
    role: "Head of HR",
    title: "Head — Human Resources",
    initials: "SI",
    entityIds: ["dial"],
    restrictedServices: ["fna", "procurement", "idt", "dt"],
    demoPassword: DEMO_PASSWORD,
    demoNote: "Service-scoped access · HR Ops only",
  },
  {
    id: "u-tax-head-dial",
    name: "Neha Agarwal",
    email: "tax.head@delhiairport.demo",
    role: "Head of Taxation",
    title: "Head — Direct & Indirect Taxation",
    initials: "NA",
    entityIds: ["dial"],
    restrictedServices: ["fna", "hrops", "procurement"],
    demoPassword: DEMO_PASSWORD,
    demoNote: "Service-scoped access · Indirect and Direct Tax only",
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
