import type { IssueStatus, Priority, ServiceId } from "../domain/types";

/**
 * Issue and feedback banks.
 *
 * Issues are not random — each one is written against a specific KPI or SLA
 * component so that the KPI → Issue → Feedback drill-down tells a coherent
 * story. `rank` controls which issues surface for smaller entities: the
 * engine allocates a per-service quota from the entity's billing mix and
 * takes the top-ranked items, so a large entity sees the long tail and a
 * small one sees only the things that matter.
 */

export interface IssueTemplate {
  key: string;
  title: string;
  description: string;
  serviceId: ServiceId;
  priority: Priority;
  status: IssueStatus;
  category: string;
  /** Days open as at the reporting date. */
  agingDays: number;
  slaTargetDays: number;
  owner: string;
  ownerTeam: string;
  linkedKpiId?: string;
  impact: string;
  timeline: { dayOffset: number; note: string; by: string }[];
  /** Pinned to particular entities; always included when in scope. */
  onlyEntities?: string[];
  /** Lower rank = higher priority for inclusion. */
  rank: number;
}

export const ISSUE_TEMPLATES: IssueTemplate[] = [
  /* ---------------------------- F&A ---------------------------- */
  {
    key: "fna-dup-payment",
    title: "Potential duplicate payment on three high-value supplier invoices",
    description:
      "The duplicate-invoice control flagged three invoices from the same vendor totalling ₹1.42 Cr with matching amounts and near-identical reference numbers. Payment run has been held pending vendor confirmation.",
    serviceId: "fna",
    priority: "critical",
    status: "in-progress",
    category: "Payment control",
    agingDays: 3,
    slaTargetDays: 5,
    owner: "Nikhil Bansal",
    ownerTeam: "F&A — Accounts Payable",
    linkedKpiId: "fna-kpi-exception",
    impact: "₹1.42 Cr of payment value on hold. No cash has left the account.",
    timeline: [
      { dayOffset: 0, note: "Duplicate control triggered during the weekly payment proposal review.", by: "Automated control" },
      { dayOffset: 1, note: "Payment run blocked for the three references. Vendor contacted for confirmation of original submission.", by: "Nikhil Bansal" },
      { dayOffset: 2, note: "Vendor confirmed two are genuine re-submissions after a portal failure. Third reference under review.", by: "Nikhil Bansal" },
    ],
    rank: 1,
  },
  {
    key: "fna-rejection-cargo",
    title: "Invoice rejection rate above tolerance for the cargo vendor group",
    description:
      "Rejections in the cargo vendor group have run above the 5% contractual tolerance for two consecutive months, driven predominantly by missing purchase order references and incorrect GST registration numbers on vendor submissions.",
    serviceId: "fna",
    priority: "high",
    status: "in-progress",
    category: "Process quality",
    agingDays: 9,
    slaTargetDays: 15,
    owner: "Priyanka Sethi",
    ownerTeam: "F&A — Accounts Payable",
    linkedKpiId: "fna-kpi-reject",
    impact: "Rework effort on rejected invoices is extending average processing time by roughly 0.4 days.",
    timeline: [
      { dayOffset: 0, note: "Trend flagged in the monthly service review.", by: "Priyanka Sethi" },
      { dayOffset: 3, note: "Root cause analysis complete — 68% of rejections trace to two freight forwarders.", by: "Priyanka Sethi" },
      { dayOffset: 6, note: "Vendor onboarding pack reissued with PO reference guidance. Joint session scheduled.", by: "Meera Subramanian" },
    ],
    rank: 3,
  },
  {
    key: "fna-grn-mismatch",
    title: "Delayed GRN posting causing three-way match failures",
    description:
      "Goods receipt notes for the engineering stores are being posted an average of six days after physical receipt, pushing otherwise clean invoices into the exception queue and delaying vendor payment.",
    serviceId: "fna",
    priority: "medium",
    status: "open",
    category: "Upstream dependency",
    agingDays: 6,
    slaTargetDays: 10,
    owner: "Rohit Kulkarni",
    ownerTeam: "F&A — Purchase to Pay",
    linkedKpiId: "fna-kpi-exception",
    impact: "Approximately 180 invoices per month enter the exception queue for a reason outside SSC control.",
    timeline: [
      { dayOffset: 0, note: "Exception queue analysis identified GRN timing as the largest single driver.", by: "Rohit Kulkarni" },
      { dayOffset: 4, note: "Referred to the customer stores team. Awaiting agreement on a posting SLA.", by: "Rohit Kulkarni" },
    ],
    rank: 5,
  },
  {
    key: "fna-master-tat",
    title: "Vendor master change requests exceeding the 48-hour turnaround",
    description:
      "Bank detail change requests are taking an average of 3.4 days against a 48-hour commitment because the additional call-back verification control introduced in September has not been resourced.",
    serviceId: "fna",
    priority: "medium",
    status: "awaiting-customer",
    category: "Service level",
    agingDays: 11,
    slaTargetDays: 10,
    owner: "Sneha Pillai",
    ownerTeam: "F&A — Master Data",
    linkedKpiId: "fna-kpi-sla",
    impact: "Master data is the lowest-scoring SLA component at 94.0% against a 95% target.",
    timeline: [
      { dayOffset: 0, note: "SLA component breach raised at the weekly operations call.", by: "Sneha Pillai" },
      { dayOffset: 5, note: "Proposal issued to add 0.5 FTE to the verification step from December.", by: "Meera Subramanian" },
      { dayOffset: 9, note: "Awaiting customer approval of the change request.", by: "Meera Subramanian" },
    ],
    rank: 7,
  },
  {
    key: "fna-close-delay",
    title: "Month-end close pack delayed by intercompany reconciliation breaks",
    description:
      "Unreconciled intercompany balances with two group entities delayed the October close pack by one working day. Breaks totalling ₹86 L remain open.",
    serviceId: "fna",
    priority: "high",
    status: "in-progress",
    category: "Month-end close",
    agingDays: 12,
    slaTargetDays: 15,
    owner: "Arvind Nagarajan",
    ownerTeam: "F&A — General Ledger",
    linkedKpiId: "fna-kpi-sla",
    impact: "Close calendar slipped by one day; management reporting pack issued on day 4 instead of day 3.",
    timeline: [
      { dayOffset: 0, note: "Break identified during the intercompany matching run.", by: "Arvind Nagarajan" },
      { dayOffset: 6, note: "₹52 L cleared against in-transit goods. ₹86 L remains under investigation.", by: "Arvind Nagarajan" },
    ],
    rank: 9,
  },
  {
    key: "fna-ar-ageing",
    title: "Receivables over 90 days concentrated in three concession counterparties",
    description:
      "Three retail concession counterparties account for 61% of the over-90-day receivable balance. Collections calls have been made but no payment plan has been agreed.",
    serviceId: "fna",
    priority: "high",
    status: "open",
    category: "Collections",
    agingDays: 16,
    slaTargetDays: 20,
    owner: "Farah Qureshi",
    ownerTeam: "F&A — Accounts Receivable",
    impact: "Concentrated collection risk in the oldest ageing bucket.",
    timeline: [
      { dayOffset: 0, note: "Escalated from the monthly debtors review.", by: "Farah Qureshi" },
      { dayOffset: 8, note: "Dunning letters issued. Two counterparties have acknowledged and requested terms.", by: "Farah Qureshi" },
    ],
    rank: 11,
  },
  {
    key: "fna-expense-policy",
    title: "Expense claims rejected for policy breaches trending upward",
    description:
      "Claim rejections have risen following the September travel policy revision. Most rejections relate to receipts submitted outside the new 30-day window.",
    serviceId: "fna",
    priority: "low",
    status: "open",
    category: "Process quality",
    agingDays: 19,
    slaTargetDays: 30,
    owner: "Sneha Pillai",
    ownerTeam: "F&A — Employee Services",
    linkedKpiId: "fna-kpi-reject",
    impact: "Employee satisfaction with expense settlement has softened in the latest pulse survey.",
    timeline: [
      { dayOffset: 0, note: "Trend noted in the expense settlement dashboard.", by: "Sneha Pillai" },
      { dayOffset: 11, note: "Communication drafted for the customer HR team to circulate.", by: "Sneha Pillai" },
    ],
    rank: 15,
  },
  {
    key: "fna-ap-goa",
    title: "AP invoice processing SLA below contracted level since go-live",
    description:
      "The AP tower has not yet reached the contracted 95% within-TAT level following transition. Volumes are stabilising but the knowledge transfer backlog on non-standard vendors persists.",
    serviceId: "fna",
    priority: "high",
    status: "in-progress",
    category: "Transition",
    agingDays: 24,
    slaTargetDays: 30,
    owner: "Rohit Kulkarni",
    ownerTeam: "F&A — Transition",
    linkedKpiId: "fna-kpi-sla",
    impact: "AP invoice processing is at 92.8% against a 95% target, dragging the overall F&A SLA.",
    timeline: [
      { dayOffset: 0, note: "Post-transition stabilisation review flagged the gap.", by: "Rohit Kulkarni" },
      { dayOffset: 10, note: "Two additional processors added to the pod from November.", by: "Kavitha Reddy" },
      { dayOffset: 18, note: "Within-TAT rate improved from 89.1% to 92.8% over three weeks.", by: "Rohit Kulkarni" },
    ],
    onlyEntities: ["goa-mopa"],
    rank: 2,
  },

  /* ----------------------------- HR ---------------------------- */
  {
    key: "hr-ta-sla",
    title: "Talent acquisition SLA breach — 40% of mandates beyond the agreed stage TAT",
    description:
      "The talent acquisition sub-tower is achieving 60% against a 90% commitment. The shortfall is concentrated in technical and airside operational roles where the qualified candidate pipeline is thin and interview panels are slow to convene.",
    serviceId: "hr",
    priority: "critical",
    status: "in-progress",
    category: "Service level",
    agingDays: 18,
    slaTargetDays: 20,
    owner: "Deepa Ramanathan",
    ownerTeam: "HR — Talent Acquisition",
    linkedKpiId: "hr-kpi-ta-sla",
    impact:
      "Talent acquisition is the single largest drag on the HR SLA roll-up and is the most frequent theme in customer feedback.",
    timeline: [
      { dayOffset: 0, note: "SLA breach formally raised. Root cause analysis commissioned.", by: "Deepa Ramanathan" },
      { dayOffset: 5, note: "Analysis complete: 62% of delay sits in panel scheduling, 24% in sourcing, 14% in offer approval.", by: "Deepa Ramanathan" },
      { dayOffset: 11, note: "Two additional sourcing specialists onboarded. Panel scheduling moved to a self-service calendar.", by: "Deepa Ramanathan" },
      { dayOffset: 16, note: "Recovery plan agreed with the customer: return to 85% by January, 90% by March.", by: "Meera Subramanian" },
    ],
    rank: 1,
  },
  {
    key: "hr-candidate-comms",
    title: "Candidate communication gaps reported in post-interview feedback",
    description:
      "Candidates report silence of up to two weeks between interview and outcome. The status update step exists in the process but is manual and is being skipped when recruiter load is high.",
    serviceId: "hr",
    priority: "high",
    status: "open",
    category: "Customer experience",
    agingDays: 7,
    slaTargetDays: 15,
    owner: "Deepa Ramanathan",
    ownerTeam: "HR — Talent Acquisition",
    linkedKpiId: "hr-kpi-candidate",
    impact: "Candidate experience has fallen to 4.3 from 4.6 over two quarters and is now below the 4.2 amber threshold at some entities.",
    timeline: [
      { dayOffset: 0, note: "Theme identified across 14 candidate feedback responses.", by: "Deepa Ramanathan" },
      { dayOffset: 4, note: "Automated status notification added to the automation backlog for December delivery.", by: "Karthik Sundaram" },
    ],
    rank: 2,
  },
  {
    key: "hr-shift-allowance",
    title: "Shift allowance miscalculated for 42 ground staff in the October payroll",
    description:
      "A configuration change to the night shift allowance band was applied one cycle early, under-paying 42 employees. Off-cycle correction has been processed and the configuration reverted.",
    serviceId: "hr",
    priority: "high",
    status: "in-progress",
    category: "Payroll accuracy",
    agingDays: 4,
    slaTargetDays: 5,
    owner: "Manish Trivedi",
    ownerTeam: "HR — Payroll Operations",
    linkedKpiId: "hr-kpi-payroll",
    impact: "42 payslips required correction. Off-cycle payment released within 48 hours of identification.",
    timeline: [
      { dayOffset: 0, note: "Under-payment reported by the airport operations supervisor.", by: "Manish Trivedi" },
      { dayOffset: 1, note: "Root cause confirmed as early application of a configuration change. Configuration reverted.", by: "Manish Trivedi" },
      { dayOffset: 2, note: "Off-cycle correction released to all 42 employees.", by: "Manish Trivedi" },
    ],
    rank: 4,
  },
  {
    key: "hr-offer-approval",
    title: "Offer approval workflow stalling at the second approval level",
    description:
      "Offers are waiting an average of 4.6 days at the second approval level against a one-day commitment, largely because approvers have no mobile access to the workflow.",
    serviceId: "hr",
    priority: "medium",
    status: "awaiting-customer",
    category: "Upstream dependency",
    agingDays: 13,
    slaTargetDays: 15,
    owner: "Deepa Ramanathan",
    ownerTeam: "HR — Talent Acquisition",
    linkedKpiId: "hr-kpi-tth",
    impact: "Adds roughly 3.6 days to time-to-hire on every mandate that reaches offer stage.",
    timeline: [
      { dayOffset: 0, note: "Stage timing analysis isolated approval as the largest delay after sourcing.", by: "Deepa Ramanathan" },
      { dayOffset: 7, note: "Mobile approval enablement raised with the customer IT team.", by: "Meera Subramanian" },
    ],
    rank: 6,
  },
  {
    key: "hr-helpdesk-kb",
    title: "Employee helpdesk knowledge base requires refresh",
    description:
      "Around a third of helpdesk tickets are repeat queries already answered in the knowledge base, but the articles predate the current leave policy and are no longer trusted by employees.",
    serviceId: "hr",
    priority: "low",
    status: "open",
    category: "Continuous improvement",
    agingDays: 22,
    slaTargetDays: 45,
    owner: "Ritu Chandra",
    ownerTeam: "HR — Employee Services",
    impact: "Deflectable ticket volume estimated at 640 tickets per month across the account.",
    timeline: [
      { dayOffset: 0, note: "Repeat query analysis presented at the quarterly service review.", by: "Ritu Chandra" },
      { dayOffset: 14, note: "Content refresh scoped — 38 articles to be rewritten.", by: "Ritu Chandra" },
    ],
    rank: 12,
  },
  {
    key: "hr-onboarding-ghial",
    title: "Onboarding completion falling short across airside operational roles",
    description:
      "Day-one readiness is being missed for airside roles because security badge issuance depends on a customer-side clearance step with no committed turnaround.",
    serviceId: "hr",
    priority: "critical",
    status: "open",
    category: "Service level",
    agingDays: 21,
    slaTargetDays: 15,
    owner: "Ritu Chandra",
    ownerTeam: "HR — Employee Services",
    linkedKpiId: "hr-kpi-sla",
    impact:
      "Onboarding completion is at 76.0% against a 95% target and is the second-largest contributor to the HR SLA shortfall.",
    timeline: [
      { dayOffset: 0, note: "Day-one readiness misses escalated by the operations leadership team.", by: "Ritu Chandra" },
      { dayOffset: 6, note: "Dependency mapped to security clearance. 71% of misses trace to this step.", by: "Ritu Chandra" },
      { dayOffset: 14, note: "Joint working group formed with the customer security team.", by: "Kavitha Reddy" },
    ],
    onlyEntities: ["ghial"],
    rank: 1,
  },
  {
    key: "hr-helpdesk-ghial",
    title: "Helpdesk resolution rate below target for three consecutive months",
    description:
      "First-contact resolution has fallen as ticket volume grew 22% following the terminal expansion, without a corresponding increase in helpdesk capacity.",
    serviceId: "hr",
    priority: "high",
    status: "in-progress",
    category: "Capacity",
    agingDays: 27,
    slaTargetDays: 30,
    owner: "Ritu Chandra",
    ownerTeam: "HR — Employee Services",
    linkedKpiId: "hr-kpi-sla",
    impact: "Helpdesk resolution is at 80.0% against a 95% target.",
    timeline: [
      { dayOffset: 0, note: "Third consecutive month below target. Formal capacity review opened.", by: "Ritu Chandra" },
      { dayOffset: 12, note: "Volume growth confirmed at 22% year on year against flat capacity.", by: "Ritu Chandra" },
      { dayOffset: 22, note: "Capacity uplift proposal issued to the customer for approval.", by: "Kavitha Reddy" },
    ],
    onlyEntities: ["ghial"],
    rank: 2,
  },

  /* ---------------------------- Tax ---------------------------- */
  {
    key: "tax-notice-fy24",
    title: "GST notice response pending for the FY24 assessment",
    description:
      "A notice seeking reconciliation between GSTR-3B and the audited financial statements for FY24 requires supporting schedules from the customer finance team before a response can be filed.",
    serviceId: "tax",
    priority: "high",
    status: "awaiting-customer",
    category: "Assessment",
    agingDays: 7,
    slaTargetDays: 5,
    owner: "Ashwin Kamath",
    ownerTeam: "Tax — Indirect Tax",
    linkedKpiId: "tax-kpi-notice",
    impact: "Response is two working days past the internal five-day window. Statutory deadline is still 18 days away.",
    timeline: [
      { dayOffset: 0, note: "Notice received on the GSTN portal and logged.", by: "Ashwin Kamath" },
      { dayOffset: 2, note: "Draft response prepared. Three supporting schedules requested from the customer.", by: "Ashwin Kamath" },
      { dayOffset: 5, note: "Two schedules received. Reminder issued for the third.", by: "Ashwin Kamath" },
    ],
    rank: 1,
  },
  {
    key: "tax-itc-mismatch",
    title: "Input tax credit mismatch against GSTR-2B for two vendor groups",
    description:
      "Input credit of ₹41 L is unmatched because two vendor groups have not filed their GSTR-1 for the period. Credit cannot be claimed until the counterparty files.",
    serviceId: "tax",
    priority: "medium",
    status: "in-progress",
    category: "Compliance",
    agingDays: 14,
    slaTargetDays: 20,
    owner: "Ashwin Kamath",
    ownerTeam: "Tax — Indirect Tax",
    linkedKpiId: "tax-kpi-itc",
    impact: "₹41 L of recoverable input tax credit is deferred to a later period.",
    timeline: [
      { dayOffset: 0, note: "Mismatch identified in the monthly 2B reconciliation.", by: "Ashwin Kamath" },
      { dayOffset: 6, note: "Vendors contacted. One has confirmed filing in the next cycle.", by: "Ashwin Kamath" },
    ],
    rank: 4,
  },
  {
    key: "tax-tds-lower",
    title: "Lower deduction certificates expiring for eleven vendors",
    description:
      "Eleven vendor lower-deduction certificates expire at the end of December. Without renewal, withholding will revert to the standard rate and vendors will raise queries.",
    serviceId: "tax",
    priority: "medium",
    status: "open",
    category: "Compliance",
    agingDays: 9,
    slaTargetDays: 30,
    owner: "Neha Agarwal",
    ownerTeam: "Tax — Direct Tax",
    impact: "Preventable vendor query volume and cash flow impact for the affected vendors.",
    timeline: [
      { dayOffset: 0, note: "Expiry report generated from TRACES.", by: "Neha Agarwal" },
      { dayOffset: 5, note: "Vendor notification issued with renewal guidance.", by: "Neha Agarwal" },
    ],
    rank: 6,
  },
  {
    key: "tax-advisory-backlog",
    title: "Advisory query backlog building in the concession agreements area",
    description:
      "Taxability queries on revenue-share concession agreements are taking longer than the four-day commitment because each requires review of a bespoke contract.",
    serviceId: "tax",
    priority: "low",
    status: "open",
    category: "Service level",
    agingDays: 17,
    slaTargetDays: 20,
    owner: "Neha Agarwal",
    ownerTeam: "Tax — Advisory",
    linkedKpiId: "tax-kpi-tat",
    impact: "Advisory turnaround has moved from 3.2 to 3.6 days over the quarter.",
    timeline: [
      { dayOffset: 0, note: "Backlog flagged in the weekly review.", by: "Neha Agarwal" },
      { dayOffset: 9, note: "Standard position paper drafted for the three most common agreement structures.", by: "Neha Agarwal" },
    ],
    rank: 9,
  },
  {
    key: "tax-notice-aerocity",
    title: "Assessment notice response consistently beyond the agreed window",
    description:
      "Notice responses are averaging 8.1 working days against a five-day commitment. Every notice in this portfolio requires property-level documentation that is held by the customer.",
    serviceId: "tax",
    priority: "high",
    status: "in-progress",
    category: "Service level",
    agingDays: 15,
    slaTargetDays: 20,
    owner: "Ashwin Kamath",
    ownerTeam: "Tax — Indirect Tax",
    linkedKpiId: "tax-kpi-notice",
    impact: "Notice response is at 88.4% against a 95% target — the weakest tax SLA component for this entity.",
    timeline: [
      { dayOffset: 0, note: "Pattern confirmed across the last six notices.", by: "Ashwin Kamath" },
      { dayOffset: 8, note: "Document pre-collection process proposed to remove the dependency.", by: "Ashwin Kamath" },
    ],
    onlyEntities: ["aerocity"],
    rank: 2,
  },

  /* ------------------------- Automation ------------------------ */
  {
    key: "auto-tax-bot-fail",
    title: "Tax reconciliation bot failing on the revised GSTR-2B file format",
    description:
      "The GSTN portal changed the 2B download schema in the November release. The bot's parser rejects the new column ordering, and 46 jobs have failed since the change.",
    serviceId: "automation",
    priority: "high",
    status: "in-progress",
    category: "Bot failure",
    agingDays: 5,
    slaTargetDays: 7,
    owner: "Karthik Sundaram",
    ownerTeam: "Automation CoE",
    linkedKpiId: "auto-kpi-success",
    impact:
      "Reconciliation has reverted to manual processing, consuming roughly 46 hours of effort until the fix ships.",
    timeline: [
      { dayOffset: 0, note: "Failure alert raised by the control tower after three consecutive job failures.", by: "Control Tower" },
      { dayOffset: 1, note: "Root cause confirmed as a GSTN schema change. Manual fallback activated.", by: "Karthik Sundaram" },
      { dayOffset: 3, note: "Parser fix developed and in test. Deployment planned for the coming weekend.", by: "Karthik Sundaram" },
    ],
    rank: 1,
  },
  {
    key: "auto-licence-util",
    title: "Bot licence utilisation below 60% on two runtimes",
    description:
      "Two runtime licences are running at 41% and 54% utilisation. Consolidating the schedules onto a single runtime would release one licence.",
    serviceId: "automation",
    priority: "low",
    status: "open",
    category: "Cost optimisation",
    agingDays: 14,
    slaTargetDays: 30,
    owner: "Karthik Sundaram",
    ownerTeam: "Automation CoE",
    impact: "Releasing one runtime licence would reduce automation billing by ₹26,000 per month.",
    timeline: [
      { dayOffset: 0, note: "Identified in the monthly licence utilisation review.", by: "Karthik Sundaram" },
      { dayOffset: 8, note: "Schedule consolidation modelled. No SLA impact expected.", by: "Karthik Sundaram" },
    ],
    rank: 5,
  },
  {
    key: "auto-exception-queue",
    title: "Automation exception queue growing faster than it is being cleared",
    description:
      "Exceptions routed back from bots to human review are being added faster than they are cleared. The queue has grown for four consecutive weeks.",
    serviceId: "automation",
    priority: "medium",
    status: "open",
    category: "Exception handling",
    agingDays: 10,
    slaTargetDays: 15,
    owner: "Karthik Sundaram",
    ownerTeam: "Automation CoE",
    linkedKpiId: "auto-kpi-success",
    impact: "Growing queue erodes the effective benefit of automation on the affected processes.",
    timeline: [
      { dayOffset: 0, note: "Queue growth flagged by the control tower trend alert.", by: "Control Tower" },
      { dayOffset: 6, note: "Top three exception reasons identified; two are candidates for straight-through handling.", by: "Karthik Sundaram" },
    ],
    rank: 7,
  },

  /* ------------------------- Analytics ------------------------- */
  {
    key: "an-feed-delay",
    title: "Non-aero revenue feed from local systems delayed by two days",
    description:
      "The nightly extract from the concession management system has failed twice this month owing to a certificate renewal on the customer side, delaying the non-aero revenue dashboard refresh.",
    serviceId: "analytics",
    priority: "medium",
    status: "open",
    category: "Data pipeline",
    agingDays: 3,
    slaTargetDays: 5,
    owner: "Sanjana Rao",
    ownerTeam: "Analytics — Data Engineering",
    linkedKpiId: "an-kpi-fresh",
    impact: "Non-aero revenue analytics is showing data as at two days prior rather than same-day.",
    timeline: [
      { dayOffset: 0, note: "Extract failure detected by the pipeline monitor.", by: "Automated monitor" },
      { dayOffset: 1, note: "Traced to an expired certificate on the source system. Raised with customer IT.", by: "Sanjana Rao" },
    ],
    rank: 1,
  },
  {
    key: "an-adoption",
    title: "Analytics adoption below the level agreed at go-live",
    description:
      "68% of licensed users were active in the last 30 days against a 70% target. Adoption is strongest in finance and weakest in commercial and operations.",
    serviceId: "analytics",
    priority: "low",
    status: "open",
    category: "Adoption",
    agingDays: 25,
    slaTargetDays: 45,
    owner: "Sanjana Rao",
    ownerTeam: "Analytics — Insight",
    linkedKpiId: "an-kpi-adoption",
    impact: "Analytics value realisation is below plan in the commercial function.",
    timeline: [
      { dayOffset: 0, note: "Adoption review presented at the quarterly business review.", by: "Sanjana Rao" },
      { dayOffset: 15, note: "Function-specific enablement sessions scheduled for December.", by: "Sanjana Rao" },
    ],
    rank: 4,
  },
];

/** Recently closed items — used for resolution metrics and history. */
export interface ResolvedIssueTemplate {
  key: string;
  title: string;
  serviceId: ServiceId;
  priority: Priority;
  category: string;
  resolvedDaysAgo: number;
  resolutionDays: number;
  owner: string;
  ownerTeam: string;
  resolution: string;
}

export const RESOLVED_ISSUE_TEMPLATES: ResolvedIssueTemplate[] = [
  {
    key: "res-fna-bank",
    title: "Bank statement auto-reconciliation failing for one collection account",
    serviceId: "fna",
    priority: "high",
    category: "Reconciliation",
    resolvedDaysAgo: 6,
    resolutionDays: 4,
    owner: "Arvind Nagarajan",
    ownerTeam: "F&A — General Ledger",
    resolution: "Statement format mapping corrected after the bank changed its MT940 layout.",
  },
  {
    key: "res-fna-payment",
    title: "Payment proposal rejected by the bank for two vendor references",
    serviceId: "fna",
    priority: "medium",
    category: "Payment control",
    resolvedDaysAgo: 12,
    resolutionDays: 2,
    owner: "Nikhil Bansal",
    ownerTeam: "F&A — Accounts Payable",
    resolution: "IFSC code corrected in vendor master following bank branch merger.",
  },
  {
    key: "res-hr-fnf",
    title: "Full and final settlements delayed for nine September leavers",
    serviceId: "hr",
    priority: "high",
    category: "Payroll accuracy",
    resolvedDaysAgo: 9,
    resolutionDays: 7,
    owner: "Manish Trivedi",
    ownerTeam: "HR — Payroll Operations",
    resolution: "Clearance workflow re-sequenced so asset return no longer blocks settlement calculation.",
  },
  {
    key: "res-tax-gstr1",
    title: "GSTR-1 filing rejected owing to an invalid HSN code",
    serviceId: "tax",
    priority: "high",
    category: "Compliance",
    resolvedDaysAgo: 15,
    resolutionDays: 1,
    owner: "Ashwin Kamath",
    ownerTeam: "Tax — Indirect Tax",
    resolution: "HSN master corrected and return refiled the same day, before the due date.",
  },
  {
    key: "res-auto-invoice-bot",
    title: "Invoice capture bot mis-reading scanned invoices from one vendor",
    serviceId: "automation",
    priority: "medium",
    category: "Bot failure",
    resolvedDaysAgo: 18,
    resolutionDays: 5,
    owner: "Karthik Sundaram",
    ownerTeam: "Automation CoE",
    resolution: "Template retrained on the vendor's revised invoice layout; accuracy restored to 99.1%.",
  },
  {
    key: "res-an-dashboard",
    title: "Spend analytics dashboard timing out for full-year queries",
    serviceId: "analytics",
    priority: "medium",
    category: "Performance",
    resolvedDaysAgo: 21,
    resolutionDays: 6,
    owner: "Sanjana Rao",
    ownerTeam: "Analytics — Data Engineering",
    resolution: "Aggregate tables introduced; full-year query time reduced from 46 s to 3 s.",
  },
];

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export interface FeedbackTemplate {
  key: string;
  serviceId: ServiceId;
  author: string;
  authorRole: string;
  daysAgo: number;
  rating: number;
  type: "compliment" | "complaint" | "suggestion";
  quote: string;
  linkedKpiId?: string;
  responded: boolean;
  onlyEntities?: string[];
  rank: number;
}

export const FEEDBACK_TEMPLATES: FeedbackTemplate[] = [
  {
    key: "fb-hr-candidate",
    serviceId: "hr",
    author: "Anjali Deshpande",
    authorRole: "Head — Airport Operations",
    daysAgo: 5,
    rating: 2,
    type: "complaint",
    quote:
      "Candidate communication is delayed. We regularly hear nothing for two weeks after an interview panel, and by the time an offer is ready the candidate has accepted elsewhere. We have lost two airside supervisors this way.",
    linkedKpiId: "hr-kpi-ta-sla",
    responded: true,
    rank: 1,
  },
  {
    key: "fb-fna-close",
    serviceId: "fna",
    author: "Ramesh Iyengar",
    authorRole: "Financial Controller",
    daysAgo: 9,
    rating: 5,
    type: "compliment",
    quote:
      "The month-end pack landed on day three again, and the variance commentary is genuinely useful — it is the first thing I read rather than something I have to reconstruct myself.",
    linkedKpiId: "fna-kpi-sla",
    responded: true,
    rank: 2,
  },
  {
    key: "fb-hr-payroll",
    serviceId: "hr",
    author: "Sunil Verma",
    authorRole: "Manager — Ground Operations",
    daysAgo: 3,
    rating: 3,
    type: "complaint",
    quote:
      "The shift allowance error affected 42 of my people. The correction was handled quickly and communicated well, but this is the second configuration issue this year and it damages trust in the payslip.",
    linkedKpiId: "hr-kpi-payroll",
    responded: true,
    rank: 3,
  },
  {
    key: "fb-tax-filing",
    serviceId: "tax",
    author: "Kavita Menon",
    authorRole: "Head — Taxation",
    daysAgo: 12,
    rating: 5,
    type: "compliment",
    quote:
      "Every statutory filing has gone in before the due date this year, including through the audit period. The notice tracker gives me exactly the visibility I need before the board meeting.",
    linkedKpiId: "tax-kpi-ontime",
    responded: false,
    rank: 2,
  },
  {
    key: "fb-fna-vendor",
    serviceId: "fna",
    author: "Deepak Shetty",
    authorRole: "Head — Procurement",
    daysAgo: 7,
    rating: 3,
    type: "complaint",
    quote:
      "Vendor bank detail changes are taking three to four days. I understand the verification control and I support it, but our vendors compare us with the two-day turnaround they had before transition.",
    linkedKpiId: "fna-kpi-sla",
    responded: true,
    rank: 4,
  },
  {
    key: "fb-auto-value",
    serviceId: "automation",
    author: "Ramesh Iyengar",
    authorRole: "Financial Controller",
    daysAgo: 16,
    rating: 5,
    type: "compliment",
    quote:
      "The invoice capture bot has taken a genuine load off the team. We reallocated two people from data entry to vendor query resolution, and query ageing has halved as a result.",
    linkedKpiId: "auto-kpi-success",
    responded: true,
    rank: 1,
  },
  {
    key: "fb-an-request",
    serviceId: "analytics",
    author: "Nandini Prasad",
    authorRole: "Head — Commercial",
    daysAgo: 11,
    rating: 4,
    type: "suggestion",
    quote:
      "The non-aero revenue view is good but I need it split by concession category and by terminal, not just in total. That is the cut I actually take to the commercial review.",
    linkedKpiId: "an-kpi-adoption",
    responded: false,
    rank: 1,
  },
  {
    key: "fb-fna-expense",
    serviceId: "fna",
    author: "Priti Malhotra",
    authorRole: "Head — Corporate Services",
    daysAgo: 19,
    rating: 4,
    type: "suggestion",
    quote:
      "Expense settlement is reliable now. If the portal could show employees where their claim sits in the queue, the volume of chase emails to my team would drop noticeably.",
    responded: true,
    rank: 6,
  },
  {
    key: "fb-hr-helpdesk",
    serviceId: "hr",
    author: "Ritika Sharma",
    authorRole: "Manager — Employee Relations",
    daysAgo: 14,
    rating: 4,
    type: "compliment",
    quote:
      "Helpdesk response has improved a lot since the escalation matrix was published. Employees know who to go to and the first response is usually the same day.",
    responded: false,
    rank: 5,
  },
  {
    key: "fb-tax-advisory",
    serviceId: "tax",
    author: "Ramesh Iyengar",
    authorRole: "Financial Controller",
    daysAgo: 22,
    rating: 4,
    type: "suggestion",
    quote:
      "The advisory support on concession agreements is strong, but each query takes longer than I would like. A standard position paper on the common structures would resolve most of them upfront.",
    linkedKpiId: "tax-kpi-tat",
    responded: true,
    rank: 4,
  },
  {
    key: "fb-an-spend",
    serviceId: "analytics",
    author: "Deepak Shetty",
    authorRole: "Head — Procurement",
    daysAgo: 26,
    rating: 5,
    type: "compliment",
    quote:
      "Spend analytics surfaced ₹1.1 Cr of maverick spend across three categories in the first month. That analysis paid for the analytics subscription several times over.",
    responded: true,
    rank: 2,
  },
  {
    key: "fb-hr-onboarding-ghial",
    serviceId: "hr",
    author: "Prakash Menon",
    authorRole: "Head — Airside Operations",
    daysAgo: 8,
    rating: 2,
    type: "complaint",
    quote:
      "New joiners are turning up on day one without a security badge and cannot go airside. It is not entirely an SSC problem, but somebody has to own the end-to-end process and right now nobody does.",
    linkedKpiId: "hr-kpi-sla",
    responded: true,
    onlyEntities: ["ghial"],
    rank: 1,
  },
  {
    key: "fb-fna-goa",
    serviceId: "fna",
    author: "Alok Pandey",
    authorRole: "Finance Manager",
    daysAgo: 10,
    rating: 3,
    type: "complaint",
    quote:
      "Invoice processing has improved since two more processors joined, but we are still behind the service level we signed. I would like to see the recovery plan tracked formally each month.",
    linkedKpiId: "fna-kpi-sla",
    responded: true,
    onlyEntities: ["goa-mopa"],
    rank: 1,
  },
  {
    key: "fb-auto-exception",
    serviceId: "automation",
    author: "Priyanka Sethi",
    authorRole: "Manager — Accounts Payable",
    daysAgo: 20,
    rating: 3,
    type: "suggestion",
    quote:
      "When a bot throws an exception it comes back to us with very little context. A short reason code on each exception would save the team a lot of investigation time.",
    responded: false,
    rank: 3,
  },
  {
    key: "fb-fna-ar",
    serviceId: "fna",
    author: "Farah Qureshi",
    authorRole: "Manager — Credit Control",
    daysAgo: 24,
    rating: 4,
    type: "compliment",
    quote:
      "The debtors ageing view by counterparty has changed how we run the collections call. We now walk in knowing exactly which three conversations matter.",
    responded: true,
    rank: 7,
  },
];
