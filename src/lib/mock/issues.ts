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
  /* ============================== F&A ============================== */
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
    key: "fna-close-delay",
    title: "Month-end close pack delayed by intercompany reconciliation breaks",
    description:
      "Unreconciled intercompany balances with two group entities delayed the October close pack by one working day. Breaks totalling ₹86 L remain open in the record-to-report tower.",
    serviceId: "fna",
    priority: "high",
    status: "in-progress",
    category: "Record to report",
    agingDays: 12,
    slaTargetDays: 15,
    owner: "Arvind Nagarajan",
    ownerTeam: "F&A — Record to Report",
    linkedKpiId: "fna-kpi-close",
    impact: "Close calendar slipped by one day; management reporting pack issued on day 4 instead of day 3.",
    timeline: [
      { dayOffset: 0, note: "Break identified during the intercompany matching run.", by: "Arvind Nagarajan" },
      { dayOffset: 6, note: "₹52 L cleared against in-transit goods. ₹86 L remains under investigation.", by: "Arvind Nagarajan" },
    ],
    rank: 4,
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
    key: "fna-ar-ageing",
    title: "Receivables over 90 days concentrated in three concession counterparties",
    description:
      "Three retail concession counterparties account for 61% of the over-90-day receivable balance. Collections calls have been made but no payment plan has been agreed.",
    serviceId: "fna",
    priority: "high",
    status: "open",
    category: "Accounts receivable",
    agingDays: 16,
    slaTargetDays: 20,
    owner: "Farah Qureshi",
    ownerTeam: "F&A — Accounts Receivable",
    linkedKpiId: "fna-kpi-collection",
    impact: "Concentrated collection risk in the oldest ageing bucket, holding collection effectiveness below target.",
    timeline: [
      { dayOffset: 0, note: "Escalated from the monthly debtors review.", by: "Farah Qureshi" },
      { dayOffset: 8, note: "Dunning letters issued. Two counterparties have acknowledged and requested terms.", by: "Farah Qureshi" },
    ],
    rank: 6,
  },
  {
    key: "fna-bank-breaks",
    title: "Unreconciled bank items building on the main collection account",
    description:
      "Auto-matching on the primary collection account is clearing only 96% of statement lines since the bank revised its narration format. Unidentified receipts are being parked to suspense and cleared manually.",
    serviceId: "fna",
    priority: "medium",
    status: "in-progress",
    category: "Treasury",
    agingDays: 8,
    slaTargetDays: 10,
    owner: "Sneha Pillai",
    ownerTeam: "F&A — Treasury Operations",
    linkedKpiId: "fna-kpi-treasury",
    impact: "48 items sit unreconciled, delaying customer account clearing and the daily cash position.",
    timeline: [
      { dayOffset: 0, note: "Auto-match rate drop detected in the daily reconciliation report.", by: "Automated control" },
      { dayOffset: 3, note: "Narration format change confirmed with the bank relationship team.", by: "Sneha Pillai" },
      { dayOffset: 6, note: "Matching rules updated in test. Production deployment planned for the weekend.", by: "Sneha Pillai" },
    ],
    rank: 8,
  },
  {
    key: "fna-travel-policy",
    title: "Travel claims rejected for policy breaches trending upward",
    description:
      "Claim rejections have risen following the September travel policy revision. Most rejections relate to receipts submitted outside the new 30-day window.",
    serviceId: "fna",
    priority: "low",
    status: "open",
    category: "Travel & expense",
    agingDays: 19,
    slaTargetDays: 30,
    owner: "Sneha Pillai",
    ownerTeam: "F&A — Travel & Expense",
    linkedKpiId: "fna-kpi-travel",
    impact: "Employee satisfaction with expense settlement has softened in the latest pulse survey.",
    timeline: [
      { dayOffset: 0, note: "Trend noted in the expense settlement dashboard.", by: "Sneha Pillai" },
      { dayOffset: 11, note: "Communication drafted for the customer HR team to circulate.", by: "Sneha Pillai" },
    ],
    rank: 12,
  },
  {
    key: "fna-bot-exception",
    title: "Automation exception queue growing faster than it is being cleared",
    description:
      "Exceptions routed back from the F&A bots to human review are being added faster than they are cleared. The queue has grown for four consecutive weeks, mostly on invoice capture and three-way match.",
    serviceId: "fna",
    priority: "medium",
    status: "open",
    category: "Automation",
    agingDays: 10,
    slaTargetDays: 15,
    owner: "Karthik Sundaram",
    ownerTeam: "Automation CoE",
    linkedKpiId: "fna-kpi-exception",
    impact: "A growing queue erodes the effective benefit of automation on the affected AP processes.",
    timeline: [
      { dayOffset: 0, note: "Queue growth flagged by the control tower trend alert.", by: "Control Tower" },
      { dayOffset: 6, note: "Top three exception reasons identified; two are candidates for straight-through handling.", by: "Karthik Sundaram" },
    ],
    rank: 14,
  },
  {
    key: "fna-ap-goa",
    title: "AP invoice processing SLA below contracted level since go-live",
    description:
      "The AP sub-tower has not yet reached the contracted 95% within-TAT level following transition. Volumes are stabilising but the knowledge transfer backlog on non-standard vendors persists.",
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

  /* ============================= HR Ops ============================ */
  {
    key: "hrops-ta-sla",
    title: "Talent acquisition SLA breach — 40% of mandates beyond the agreed stage TAT",
    description:
      "The talent acquisition sub-service is achieving 60% against a 90% commitment. The shortfall is concentrated in technical and airside operational roles where the qualified candidate pipeline is thin and interview panels are slow to convene.",
    serviceId: "hrops",
    priority: "critical",
    status: "in-progress",
    category: "Service level",
    agingDays: 18,
    slaTargetDays: 20,
    owner: "Deepa Ramanathan",
    ownerTeam: "HR Ops — Talent Acquisition",
    linkedKpiId: "hrops-kpi-ta-sla",
    impact:
      "Talent acquisition is the single largest drag on the HR Ops SLA roll-up and is the most frequent theme in customer feedback.",
    timeline: [
      { dayOffset: 0, note: "SLA breach formally raised. Root cause analysis commissioned.", by: "Deepa Ramanathan" },
      { dayOffset: 5, note: "Analysis complete: 62% of delay sits in panel scheduling, 24% in sourcing, 14% in offer approval.", by: "Deepa Ramanathan" },
      { dayOffset: 11, note: "Two additional sourcing specialists onboarded. Panel scheduling moved to a self-service calendar.", by: "Deepa Ramanathan" },
      { dayOffset: 16, note: "Recovery plan agreed with the customer: return to 85% by January, 90% by March.", by: "Meera Subramanian" },
    ],
    rank: 1,
  },
  {
    key: "hrops-candidate-comms",
    title: "Candidate communication gaps reported in post-interview feedback",
    description:
      "Candidates report silence of up to two weeks between interview and outcome. The status update step exists in SuccessFactors but is manual and is being skipped when recruiter load is high.",
    serviceId: "hrops",
    priority: "high",
    status: "open",
    category: "Customer experience",
    agingDays: 7,
    slaTargetDays: 15,
    owner: "Deepa Ramanathan",
    ownerTeam: "HR Ops — Talent Acquisition",
    linkedKpiId: "hrops-kpi-candidate",
    impact: "Candidate experience has fallen to 4.3 from 4.6 over two quarters and is now below the 4.2 amber threshold at some entities.",
    timeline: [
      { dayOffset: 0, note: "Theme identified across 14 candidate feedback responses.", by: "Deepa Ramanathan" },
      { dayOffset: 4, note: "Automated status notification added to the automation backlog for December delivery.", by: "Karthik Sundaram" },
    ],
    rank: 2,
  },
  {
    key: "hrops-shift-allowance",
    title: "Shift allowance miscalculated for 42 ground staff in the October payroll",
    description:
      "A configuration change to the night shift allowance band was applied one cycle early, under-paying 42 employees. Off-cycle correction has been processed and the configuration reverted.",
    serviceId: "hrops",
    priority: "high",
    status: "in-progress",
    category: "Payroll accuracy",
    agingDays: 4,
    slaTargetDays: 5,
    owner: "Manish Trivedi",
    ownerTeam: "HR Ops — Payroll",
    linkedKpiId: "hrops-kpi-payroll",
    impact: "42 payslips required correction. Off-cycle payment released within 48 hours of identification.",
    timeline: [
      { dayOffset: 0, note: "Under-payment reported by the airport operations supervisor.", by: "Manish Trivedi" },
      { dayOffset: 1, note: "Root cause confirmed as early application of a configuration change. Configuration reverted.", by: "Manish Trivedi" },
      { dayOffset: 2, note: "Off-cycle correction released to all 42 employees.", by: "Manish Trivedi" },
    ],
    rank: 3,
  },
  {
    key: "hrops-lnd-completion",
    title: "Mandatory safety refresher completion behind plan for operational staff",
    description:
      "74 enrolments on the airside safety refresher curriculum are open past their completion date. Shift rosters do not currently reserve time for the module, so completion depends on staff finding time off-shift.",
    serviceId: "hrops",
    priority: "medium",
    status: "in-progress",
    category: "Learning & development",
    agingDays: 15,
    slaTargetDays: 20,
    owner: "Ritu Chandra",
    ownerTeam: "HR Ops — Learning & Development",
    linkedKpiId: "hrops-kpi-lnd",
    impact:
      "Learning completion is at 82.4% against an 85% target, and the compliance curriculum is the whole of the shortfall.",
    timeline: [
      { dayOffset: 0, note: "Completion gap raised at the monthly learning governance call.", by: "Ritu Chandra" },
      { dayOffset: 7, note: "Analysis shows 81% of open enrolments belong to three shift-based departments.", by: "Ritu Chandra" },
      { dayOffset: 12, note: "Proposal issued to block learning time into the roster from December.", by: "Meera Subramanian" },
    ],
    rank: 5,
  },
  {
    key: "hrops-offer-approval",
    title: "Offer approval workflow stalling at the second approval level",
    description:
      "Offers are waiting an average of 4.6 days at the second approval level against a one-day commitment, largely because approvers have no mobile access to the SuccessFactors workflow.",
    serviceId: "hrops",
    priority: "medium",
    status: "awaiting-customer",
    category: "Upstream dependency",
    agingDays: 13,
    slaTargetDays: 15,
    owner: "Deepa Ramanathan",
    ownerTeam: "HR Ops — Talent Acquisition",
    linkedKpiId: "hrops-kpi-tth",
    impact: "Adds roughly 3.6 days to time-to-hire on every mandate that reaches offer stage.",
    timeline: [
      { dayOffset: 0, note: "Stage timing analysis isolated approval as the largest delay after sourcing.", by: "Deepa Ramanathan" },
      { dayOffset: 7, note: "Mobile approval enablement raised with the customer IT team.", by: "Meera Subramanian" },
    ],
    rank: 6,
  },
  {
    key: "hrops-helpdesk-kb",
    title: "ASK HR knowledge base requires refresh",
    description:
      "Around a third of ASK HR queries are repeat questions already answered in the knowledge base, but the articles predate the current leave policy and are no longer trusted by employees.",
    serviceId: "hrops",
    priority: "low",
    status: "open",
    category: "Continuous improvement",
    agingDays: 22,
    slaTargetDays: 45,
    owner: "Ritu Chandra",
    ownerTeam: "HR Ops — Employee Services",
    linkedKpiId: "hrops-raw-ask-hr-within-tat-of-2-wd",
    impact: "Deflectable query volume estimated at 640 tickets per month across the account.",
    timeline: [
      { dayOffset: 0, note: "Repeat query analysis presented at the quarterly service review.", by: "Ritu Chandra" },
      { dayOffset: 14, note: "Content refresh scoped — 38 articles to be rewritten.", by: "Ritu Chandra" },
    ],
    rank: 12,
  },
  {
    key: "hrops-onboarding-ghial",
    title: "Onboarding completion falling short across airside operational roles",
    description:
      "Day-one readiness is being missed for airside roles because security badge issuance depends on a customer-side clearance step with no committed turnaround.",
    serviceId: "hrops",
    priority: "critical",
    status: "open",
    category: "Service level",
    agingDays: 21,
    slaTargetDays: 15,
    owner: "Ritu Chandra",
    ownerTeam: "HR Ops — Employee Services",
    linkedKpiId: "hrops-kpi-sla",
    impact:
      "Day-one readiness misses are a material contributor to the HR Ops SLA landing at 79.4% against the 90% commitment.",
    timeline: [
      { dayOffset: 0, note: "Day-one readiness misses escalated by the operations leadership team.", by: "Ritu Chandra" },
      { dayOffset: 6, note: "Dependency mapped to security clearance. 71% of misses trace to this step.", by: "Ritu Chandra" },
      { dayOffset: 14, note: "Joint working group formed with the customer security team.", by: "Kavitha Reddy" },
    ],
    onlyEntities: ["ghial"],
    rank: 1,
  },
  {
    key: "hrops-helpdesk-ghial",
    title: "ASK HR resolution rate below target for three consecutive months",
    description:
      "First-contact resolution has fallen as query volume grew 22% following the terminal expansion, without a corresponding increase in ASK HR capacity.",
    serviceId: "hrops",
    priority: "high",
    status: "in-progress",
    category: "Capacity",
    agingDays: 27,
    slaTargetDays: 30,
    owner: "Ritu Chandra",
    ownerTeam: "HR Ops — Employee Services",
    linkedKpiId: "hrops-raw-ask-hr-within-tat-of-2-wd",
    impact: "Learning & development delivery is at 74.0% against a 95% target.",
    timeline: [
      { dayOffset: 0, note: "Third consecutive month below target. Formal capacity review opened.", by: "Ritu Chandra" },
      { dayOffset: 12, note: "Volume growth confirmed at 22% year on year against flat capacity.", by: "Ritu Chandra" },
      { dayOffset: 22, note: "Capacity uplift proposal issued to the customer for approval.", by: "Kavitha Reddy" },
    ],
    onlyEntities: ["ghial"],
    rank: 2,
  },

  /* ====================== Procurement & Contracts =================== */
  {
    key: "proc-contract-expiry",
    title: "38 contracts expire within 90 days without a named renewal owner",
    description:
      "The contract repository shows 38 agreements expiring inside the next quarter, 14 of them for services with no alternate supplier. None currently has a renewal decision recorded against it on the customer side.",
    serviceId: "procurement",
    priority: "high",
    status: "awaiting-customer",
    category: "Contract lifecycle",
    agingDays: 11,
    slaTargetDays: 15,
    owner: "Ananya Bose",
    ownerTeam: "P&C — Contract Management",
    linkedKpiId: "proc-kpi-contract",
    impact:
      "Any lapse forces either an emergency single-source extension or a service interruption. Two agreements expire within 30 days.",
    timeline: [
      { dayOffset: 0, note: "Expiry report circulated to category owners from the contract repository.", by: "Ananya Bose" },
      { dayOffset: 5, note: "24 of 38 acknowledged. 14 remain without a nominated renewal owner.", by: "Ananya Bose" },
      { dayOffset: 9, note: "Escalated to the customer procurement council for a decision.", by: "Meera Subramanian" },
    ],
    rank: 1,
  },
  {
    key: "proc-vendor-tat",
    title: "Vendor bank detail changes exceeding the 48-hour turnaround",
    description:
      "Bank detail change requests are taking an average of 3.4 days against a 48-hour commitment because the additional call-back verification control introduced in September has not been resourced.",
    serviceId: "procurement",
    priority: "medium",
    status: "awaiting-customer",
    category: "Vendor management",
    agingDays: 11,
    slaTargetDays: 10,
    owner: "Sneha Pillai",
    ownerTeam: "P&C — Vendor Master",
    linkedKpiId: "proc-kpi-vendor",
    impact: "Vendor master is the lowest-scoring P&C SLA component at 94.0% against a 95% target.",
    timeline: [
      { dayOffset: 0, note: "SLA component breach raised at the weekly operations call.", by: "Sneha Pillai" },
      { dayOffset: 5, note: "Proposal issued to add 0.5 FTE to the verification step from December.", by: "Meera Subramanian" },
      { dayOffset: 9, note: "Awaiting customer approval of the change request.", by: "Meera Subramanian" },
    ],
    rank: 2,
  },
  {
    key: "proc-maverick",
    title: "Maverick spend above tolerance in facilities and IT categories",
    description:
      "6.2% of addressable spend was committed without a purchase order or outside a contracted catalogue, against a 5% tolerance. Facilities call-outs and small IT purchases account for most of it.",
    serviceId: "procurement",
    priority: "medium",
    status: "in-progress",
    category: "Compliance",
    agingDays: 17,
    slaTargetDays: 25,
    owner: "Deepak Shetty",
    ownerTeam: "P&C — Sourcing",
    linkedKpiId: "proc-kpi-maverick",
    impact:
      "Spend outside contracted rates forgoes negotiated pricing and is the largest single leak in the realised savings figure.",
    timeline: [
      { dayOffset: 0, note: "Trend confirmed in the monthly spend compliance review.", by: "Deepak Shetty" },
      { dayOffset: 8, note: "Two catalogues extended to cover the most frequent off-contract items.", by: "Deepak Shetty" },
    ],
    rank: 4,
  },
  {
    key: "proc-pr-cycle",
    title: "Requisitions queuing at budget verification before purchase order release",
    description:
      "Requisitions above ₹5 L are waiting an average of 1.8 days at the budget verification step. The check is manual and is performed by a single approver group on the customer side.",
    serviceId: "procurement",
    priority: "low",
    status: "open",
    category: "Upstream dependency",
    agingDays: 20,
    slaTargetDays: 30,
    owner: "Ananya Bose",
    ownerTeam: "P&C — Purchase to Pay",
    linkedKpiId: "proc-kpi-cycle",
    impact: "Adds roughly 1.8 days to requisition-to-PO on around a fifth of all requisitions.",
    timeline: [
      { dayOffset: 0, note: "Stage timing analysis identified budget verification as the dominant delay.", by: "Ananya Bose" },
      { dayOffset: 10, note: "Automated budget availability check proposed for the December release.", by: "Karthik Sundaram" },
    ],
    rank: 7,
  },
  {
    key: "proc-vendor-ddfs",
    title: "Vendor onboarding backlog following the retail concession refresh",
    description:
      "46 new retail suppliers are pending onboarding after the concession refresh. Due diligence documentation is incomplete for 19 of them and the trading date is fixed.",
    serviceId: "procurement",
    priority: "high",
    status: "in-progress",
    category: "Vendor management",
    agingDays: 14,
    slaTargetDays: 15,
    owner: "Sneha Pillai",
    ownerTeam: "P&C — Vendor Master",
    linkedKpiId: "proc-kpi-sla",
    impact: "Vendor onboarding is at 91.2% against a 95% target — the weakest P&C component for this entity.",
    timeline: [
      { dayOffset: 0, note: "Backlog raised at the concession readiness review.", by: "Sneha Pillai" },
      { dayOffset: 7, note: "27 vendors cleared. Document chase underway for the remaining 19.", by: "Sneha Pillai" },
    ],
    onlyEntities: ["ddfs"],
    rank: 1,
  },

  /* =========================== Indirect Tax ======================== */
  {
    key: "idt-notice-fy24",
    title: "GST notice response pending for the FY24 assessment",
    description:
      "A notice seeking reconciliation between GSTR-3B and the audited financial statements for FY24 requires supporting schedules from the customer finance team before a response can be filed.",
    serviceId: "idt",
    priority: "high",
    status: "awaiting-customer",
    category: "Assessment",
    agingDays: 7,
    slaTargetDays: 5,
    owner: "Ashwin Kamath",
    ownerTeam: "IDT — Notices & Assessments",
    linkedKpiId: "idt-kpi-notice",
    impact: "Response is two working days past the internal five-day window. Statutory deadline is still 18 days away.",
    timeline: [
      { dayOffset: 0, note: "Notice received on the GSTN portal and logged.", by: "Ashwin Kamath" },
      { dayOffset: 2, note: "Draft response prepared. Three supporting schedules requested from the customer.", by: "Ashwin Kamath" },
      { dayOffset: 5, note: "Two schedules received. Reminder issued for the third.", by: "Ashwin Kamath" },
    ],
    rank: 1,
  },
  {
    key: "idt-bot-schema",
    title: "Input credit reconciliation bot failing on the revised GSTR-2B file format",
    description:
      "The GSTN portal changed the 2B download schema in the November release. The bot's parser rejects the new column ordering, and 46 jobs have failed since the change.",
    serviceId: "idt",
    priority: "high",
    status: "in-progress",
    category: "Automation",
    agingDays: 5,
    slaTargetDays: 7,
    owner: "Karthik Sundaram",
    ownerTeam: "Automation CoE",
    linkedKpiId: "idt-kpi-itc",
    impact:
      "Reconciliation has reverted to manual processing, consuming roughly 46 hours of effort until the fix ships.",
    timeline: [
      { dayOffset: 0, note: "Failure alert raised by the control tower after three consecutive job failures.", by: "Control Tower" },
      { dayOffset: 1, note: "Root cause confirmed as a GSTN schema change. Manual fallback activated.", by: "Karthik Sundaram" },
      { dayOffset: 3, note: "Parser fix developed and in test. Deployment planned for the coming weekend.", by: "Karthik Sundaram" },
    ],
    rank: 2,
  },
  {
    key: "idt-itc-mismatch",
    title: "Input tax credit mismatch against GSTR-2B for two vendor groups",
    description:
      "Input credit of ₹41 L is unmatched because two vendor groups have not filed their GSTR-1 for the period. Credit cannot be claimed until the counterparty files.",
    serviceId: "idt",
    priority: "medium",
    status: "in-progress",
    category: "Input tax credit",
    agingDays: 14,
    slaTargetDays: 20,
    owner: "Ashwin Kamath",
    ownerTeam: "IDT — Input Tax Credit",
    linkedKpiId: "idt-kpi-itc",
    impact: "₹41 L of recoverable input tax credit is deferred to a later period.",
    timeline: [
      { dayOffset: 0, note: "Mismatch identified in the monthly 2B reconciliation.", by: "Ashwin Kamath" },
      { dayOffset: 6, note: "Vendors contacted. One has confirmed filing in the next cycle.", by: "Ashwin Kamath" },
    ],
    rank: 4,
  },
  {
    key: "idt-einvoice-reject",
    title: "IRP rejecting e-invoices for three service line item descriptions",
    description:
      "The invoice registration portal is rejecting documents where the service description exceeds the permitted length after the November schema tightening. Affected invoices are being re-submitted manually.",
    serviceId: "idt",
    priority: "medium",
    status: "in-progress",
    category: "E-invoicing",
    agingDays: 6,
    slaTargetDays: 10,
    owner: "Meghna Iyer",
    ownerTeam: "IDT — E-Invoicing",
    linkedKpiId: "idt-kpi-einvoice",
    impact:
      "First-pass acceptance has slipped from 99.7% to 99.4%. No invoice has missed its issue date, but the manual re-submission effort is growing.",
    timeline: [
      { dayOffset: 0, note: "Rejection pattern detected in the daily IRN exception report.", by: "Meghna Iyer" },
      { dayOffset: 2, note: "Three material master descriptions identified as the cause.", by: "Meghna Iyer" },
      { dayOffset: 4, note: "Master data change request raised with the customer for the three items.", by: "Meghna Iyer" },
    ],
    rank: 5,
  },
  {
    key: "idt-notice-aerocity",
    title: "Assessment notice response consistently beyond the agreed window",
    description:
      "Notice responses are averaging 8.1 working days against a five-day commitment. Every notice in this portfolio requires property-level documentation that is held by the customer.",
    serviceId: "idt",
    priority: "high",
    status: "in-progress",
    category: "Service level",
    agingDays: 15,
    slaTargetDays: 20,
    owner: "Ashwin Kamath",
    ownerTeam: "IDT — Notices & Assessments",
    linkedKpiId: "idt-kpi-notice",
    impact: "Notice response is at 88.4% against a 95% target — the weakest indirect tax component for this entity.",
    timeline: [
      { dayOffset: 0, note: "Pattern confirmed across the last six notices.", by: "Ashwin Kamath" },
      { dayOffset: 8, note: "Document pre-collection process proposed to remove the dependency.", by: "Ashwin Kamath" },
    ],
    onlyEntities: ["aerocity"],
    rank: 2,
  },

  /* ============================ Direct Tax ========================= */
  {
    key: "dt-assessment-fy22",
    title: "Scrutiny assessment for AY 2022-23 requires a reconciliation the customer holds",
    description:
      "The assessing officer has sought a reconciliation of contractor payments to the TDS statements for AY 2022-23. Two of the four supporting schedules sit with the customer's project finance team.",
    serviceId: "dt",
    priority: "high",
    status: "awaiting-customer",
    category: "Assessment",
    agingDays: 9,
    slaTargetDays: 7,
    owner: "Neha Agarwal",
    ownerTeam: "DT — Assessments",
    linkedKpiId: "dt-kpi-assessment",
    impact:
      "Response is two working days past the internal window. The hearing date is fixed and cannot be deferred again.",
    timeline: [
      { dayOffset: 0, note: "Notice under section 143(2) logged and acknowledged on the portal.", by: "Neha Agarwal" },
      { dayOffset: 3, note: "Two of four schedules prepared from S/4HANA. Remaining two requested from the customer.", by: "Neha Agarwal" },
      { dayOffset: 7, note: "Reminder issued; hearing date confirmed for the third week of December.", by: "Neha Agarwal" },
    ],
    rank: 1,
  },
  {
    key: "dt-tds-lower",
    title: "Lower deduction certificates expiring for eleven vendors",
    description:
      "Eleven vendor lower-deduction certificates expire at the end of December. Without renewal, withholding will revert to the standard rate and vendors will raise queries.",
    serviceId: "dt",
    priority: "medium",
    status: "open",
    category: "Withholding tax",
    agingDays: 9,
    slaTargetDays: 30,
    owner: "Neha Agarwal",
    ownerTeam: "DT — Withholding Tax",
    linkedKpiId: "dt-kpi-cert",
    impact: "Preventable vendor query volume and a cash flow impact for the eleven affected vendors.",
    timeline: [
      { dayOffset: 0, note: "Expiry report generated from TRACES.", by: "Neha Agarwal" },
      { dayOffset: 5, note: "Vendor notification issued with renewal guidance.", by: "Neha Agarwal" },
    ],
    rank: 3,
  },
  {
    key: "dt-tp-benchmarking",
    title: "Transfer pricing benchmarking data pending for two intercompany service agreements",
    description:
      "The FY25 transfer pricing documentation set cannot be completed for two intra-group service agreements until comparable cost allocation data is received from the group shared services function.",
    serviceId: "dt",
    priority: "medium",
    status: "in-progress",
    category: "Transfer pricing",
    agingDays: 18,
    slaTargetDays: 25,
    owner: "Rakesh Menon",
    ownerTeam: "DT — Transfer Pricing",
    impact:
      "Documentation must be in place before the accountant's report is due. Slippage would create a penalty exposure.",
    timeline: [
      { dayOffset: 0, note: "Data gap identified during the documentation review.", by: "Rakesh Menon" },
      { dayOffset: 9, note: "Cost allocation basis agreed with group finance; extraction in progress.", by: "Rakesh Menon" },
    ],
    rank: 5,
  },
  {
    key: "dt-advisory-backlog",
    title: "Advisory query backlog building on concession agreement withholding",
    description:
      "Withholding queries on revenue-share concession agreements are taking longer than the four-day commitment because each requires review of a bespoke contract.",
    serviceId: "dt",
    priority: "low",
    status: "open",
    category: "Service level",
    agingDays: 17,
    slaTargetDays: 20,
    owner: "Rakesh Menon",
    ownerTeam: "DT — Advisory",
    linkedKpiId: "dt-kpi-advisory",
    impact: "Advisory turnaround has moved from 3.4 to 3.9 days over the quarter.",
    timeline: [
      { dayOffset: 0, note: "Backlog flagged in the weekly review.", by: "Rakesh Menon" },
      { dayOffset: 9, note: "Standard position paper drafted for the three most common agreement structures.", by: "Rakesh Menon" },
    ],
    rank: 8,
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
    category: "Treasury",
    resolvedDaysAgo: 6,
    resolutionDays: 4,
    owner: "Sneha Pillai",
    ownerTeam: "F&A — Treasury Operations",
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
    resolution: "IFSC code corrected in vendor master following a bank branch merger.",
  },
  {
    key: "res-fna-invoice-bot",
    title: "Invoice capture bot mis-reading scanned invoices from one vendor",
    serviceId: "fna",
    priority: "medium",
    category: "Automation",
    resolvedDaysAgo: 18,
    resolutionDays: 5,
    owner: "Karthik Sundaram",
    ownerTeam: "Automation CoE",
    resolution: "Template retrained on the vendor's revised invoice layout; accuracy restored to 99.1%.",
  },
  {
    key: "res-hrops-fnf",
    title: "Full and final settlements delayed for nine September leavers",
    serviceId: "hrops",
    priority: "high",
    category: "Payroll accuracy",
    resolvedDaysAgo: 9,
    resolutionDays: 7,
    owner: "Manish Trivedi",
    ownerTeam: "HR Ops — Payroll",
    resolution: "Clearance workflow re-sequenced so asset return no longer blocks settlement calculation.",
  },
  {
    key: "res-proc-catalogue",
    title: "Catalogue pricing out of step with the renegotiated facilities contract",
    serviceId: "procurement",
    priority: "medium",
    category: "Contract lifecycle",
    resolvedDaysAgo: 11,
    resolutionDays: 4,
    owner: "Ananya Bose",
    ownerTeam: "P&C — Contract Management",
    resolution: "Catalogue re-priced to the renegotiated rate card and back-charges recovered from the supplier.",
  },
  {
    key: "res-idt-gstr1",
    title: "GSTR-1 filing rejected owing to an invalid HSN code",
    serviceId: "idt",
    priority: "high",
    category: "GST compliance",
    resolvedDaysAgo: 15,
    resolutionDays: 1,
    owner: "Ashwin Kamath",
    ownerTeam: "IDT — GST Compliance",
    resolution: "HSN master corrected and return refiled the same day, before the due date.",
  },
  {
    key: "res-dt-tds-return",
    title: "Quarterly TDS statement rejected for four invalid PAN records",
    serviceId: "dt",
    priority: "medium",
    category: "Withholding tax",
    resolvedDaysAgo: 20,
    resolutionDays: 3,
    owner: "Neha Agarwal",
    ownerTeam: "DT — Withholding Tax",
    resolution: "PANs validated against the vendor master and the correction statement accepted by TRACES.",
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
    key: "fb-hrops-candidate",
    serviceId: "hrops",
    author: "Anjali Deshpande",
    authorRole: "Head — Airport Operations",
    daysAgo: 5,
    rating: 2,
    type: "complaint",
    quote:
      "Candidate communication is delayed. We regularly hear nothing for two weeks after an interview panel, and by the time an offer is ready the candidate has accepted elsewhere. We have lost two airside supervisors this way.",
    linkedKpiId: "hrops-kpi-ta-sla",
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
    linkedKpiId: "fna-kpi-close",
    responded: true,
    rank: 1,
  },
  {
    key: "fb-hrops-payroll",
    serviceId: "hrops",
    author: "Sunil Verma",
    authorRole: "Manager — Ground Operations",
    daysAgo: 3,
    rating: 3,
    type: "complaint",
    quote:
      "The shift allowance error affected 42 of my people. The correction was handled quickly and communicated well, but this is the second configuration issue this year and it damages trust in the payslip.",
    linkedKpiId: "hrops-kpi-payroll",
    responded: true,
    rank: 2,
  },
  {
    key: "fb-idt-filing",
    serviceId: "idt",
    author: "Kavita Menon",
    authorRole: "Head — Taxation",
    daysAgo: 12,
    rating: 5,
    type: "compliment",
    quote:
      "Every GST filing has gone in before the due date this year, including through the audit period. The notice tracker gives me exactly the visibility I need before the board meeting.",
    linkedKpiId: "idt-kpi-ontime",
    responded: false,
    rank: 1,
  },
  {
    key: "fb-proc-vendor",
    serviceId: "procurement",
    author: "Deepak Shetty",
    authorRole: "Head — Procurement",
    daysAgo: 7,
    rating: 3,
    type: "complaint",
    quote:
      "Vendor bank detail changes are taking three to four days. I understand the verification control and I support it, but our vendors compare us with the two-day turnaround they had before transition.",
    linkedKpiId: "proc-kpi-vendor",
    responded: true,
    rank: 1,
  },
  {
    key: "fb-proc-spend",
    serviceId: "procurement",
    author: "Nandini Prasad",
    authorRole: "Head — Commercial",
    daysAgo: 26,
    rating: 5,
    type: "compliment",
    quote:
      "The sourcing team surfaced ₹1.1 Cr of maverick spend across three categories in the first month and put two of them onto catalogues. That analysis paid for itself several times over.",
    linkedKpiId: "proc-kpi-savings",
    responded: true,
    rank: 2,
  },
  {
    key: "fb-fna-automation",
    serviceId: "fna",
    author: "Ramesh Iyengar",
    authorRole: "Financial Controller",
    daysAgo: 16,
    rating: 5,
    type: "compliment",
    quote:
      "The invoice capture bot has taken a genuine load off the team. We reallocated two people from data entry to vendor query resolution, and query ageing has halved as a result.",
    linkedKpiId: "fna-kpi-tat",
    responded: true,
    rank: 2,
  },
  {
    key: "fb-hrops-lnd",
    serviceId: "hrops",
    author: "Prakash Menon",
    authorRole: "Head — Airside Operations",
    daysAgo: 13,
    rating: 3,
    type: "suggestion",
    quote:
      "The learning calendar is well run but the compliance modules assume people can find an hour off-shift. If the enrolment could be scheduled into the roster directly, completion would look after itself.",
    linkedKpiId: "hrops-kpi-lnd",
    responded: false,
    rank: 3,
  },
  {
    key: "fb-fna-travel",
    serviceId: "fna",
    author: "Priti Malhotra",
    authorRole: "Head — Corporate Services",
    daysAgo: 19,
    rating: 4,
    type: "suggestion",
    quote:
      "Travel settlement is reliable now. If the portal could show employees where their claim sits in the queue, the volume of chase emails to my team would drop noticeably.",
    linkedKpiId: "fna-kpi-travel",
    responded: true,
    rank: 5,
  },
  {
    key: "fb-hrops-helpdesk",
    serviceId: "hrops",
    author: "Ritika Sharma",
    authorRole: "Manager — Employee Relations",
    daysAgo: 14,
    rating: 4,
    type: "compliment",
    quote:
      "ASK HR response has improved a lot since the escalation matrix was published. Employees know who to go to and the first response is usually the same day.",
    linkedKpiId: "hrops-raw-ask-hr-within-tat-of-2-wd",
    responded: false,
    rank: 4,
  },
  {
    key: "fb-dt-advisory",
    serviceId: "dt",
    author: "Ramesh Iyengar",
    authorRole: "Financial Controller",
    daysAgo: 22,
    rating: 4,
    type: "suggestion",
    quote:
      "The withholding advice on concession agreements is strong, but each query takes longer than I would like. A standard position paper on the common structures would resolve most of them upfront.",
    linkedKpiId: "dt-kpi-advisory",
    responded: true,
    rank: 2,
  },
  {
    key: "fb-dt-cert",
    serviceId: "dt",
    author: "Kavita Menon",
    authorRole: "Head — Taxation",
    daysAgo: 18,
    rating: 5,
    type: "compliment",
    quote:
      "Form 16A distribution went out on time to every vendor this quarter and the query volume afterwards was almost nil. That was not the case two years ago.",
    linkedKpiId: "dt-kpi-cert",
    responded: true,
    rank: 1,
  },
  {
    key: "fb-idt-einvoice",
    serviceId: "idt",
    author: "Alok Pandey",
    authorRole: "Finance Manager",
    daysAgo: 21,
    rating: 4,
    type: "suggestion",
    quote:
      "E-invoicing runs cleanly, but when the portal rejects a document we hear about it from the customer rather than from the exception report. A same-day alert would close that gap.",
    linkedKpiId: "idt-kpi-einvoice",
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
    linkedKpiId: "fna-kpi-collection",
    responded: true,
    rank: 6,
  },
  {
    key: "fb-fna-exception",
    serviceId: "fna",
    author: "Priyanka Sethi",
    authorRole: "Manager — Accounts Payable",
    daysAgo: 20,
    rating: 3,
    type: "suggestion",
    quote:
      "When a bot throws an exception it comes back to us with very little context. A short reason code on each exception would save the team a lot of investigation time.",
    linkedKpiId: "fna-kpi-exception",
    responded: false,
    rank: 7,
  },
  {
    key: "fb-hrops-onboarding-ghial",
    serviceId: "hrops",
    author: "Prakash Menon",
    authorRole: "Head — Airside Operations",
    daysAgo: 8,
    rating: 2,
    type: "complaint",
    quote:
      "New joiners are turning up on day one without a security badge and cannot go airside. It is not entirely an SSC problem, but somebody has to own the end-to-end process and right now nobody does.",
    linkedKpiId: "hrops-kpi-sla",
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
];
