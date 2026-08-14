import type { EntitySnapshot } from "@/lib/domain/types";
import { billedTotal, billedTotalLabel, formatMoney } from "@/lib/format";

/**
 * Report export. The prototype produces a real CSV from the same snapshot
 * the screens render, so "Download report" is a working action rather than a
 * dead button. In production this is where a formatted PDF pack would go.
 */
export function buildReportCsv(snapshot: EntitySnapshot): string {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: string[] = [];
  const push = (...cells: (string | number)[]) => rows.push(cells.map(q).join(","));
 


  
  push("SSC Customer Portal — Executive Report");
  push("Entity", snapshot.entity.name);
  push("Location", snapshot.location.name);
  push("Period", `${snapshot.period.label} (${snapshot.period.range})`);
  push("Data as at", snapshot.period.asOf);
  push("Basis", "Prototype data — illustrative only, no production system connected");
  push("");

  push("EXECUTIVE SUMMARY");
  push("Measure", "Value");
  push(
    billedTotalLabel(snapshot.period.isCurrent),
    formatMoney(
      billedTotal(snapshot.period.isCurrent, snapshot.billing.ytd, snapshot.billing.fyForecast),
    ),
  );
  push("Months closed", snapshot.period.actualMonthCount);
  push("Month-on-month change", `${snapshot.billing.momPct.toFixed(1)}%`);
  push("YTD variance vs budget", `${snapshot.billing.ytdVariancePct.toFixed(1)}%`);
  push("Outstanding", formatMoney(snapshot.billing.outstanding));
  push("Overall SLA", `${snapshot.sla.overall.toFixed(1)}%`);
  push("SLA target", `${snapshot.sla.target.toFixed(1)}%`);
  push("Customer satisfaction", `${snapshot.cx.csat.toFixed(1)} / 5`);
  push("Net promoter score", `${snapshot.cx.nps >= 0 ? "+" : ""}${snapshot.cx.nps}`);
  push("Open issues", snapshot.counts.openIssues);
  push("Critical issues", snapshot.counts.criticalIssues);
  push("");

  push("BILLING BY SERVICE");
  push(
    "Service",
    "YTD billing",
    billedTotalLabel(snapshot.period.isCurrent),
    "Share of spend",
    "MoM change",
    "SLA",
    "SLA target",
  );
  for (const s of snapshot.services) {
    push(
      s.service.name,
      formatMoney(s.billing.ytd),
      formatMoney(billedTotal(snapshot.period.isCurrent, s.billing.ytd, s.billing.fyForecast)),
      `${(s.billing.mix * 100).toFixed(1)}%`,
      `${s.billing.momPct.toFixed(1)}%`,
      `${s.sla.overall.toFixed(1)}%`,
      `${s.sla.target}%`,
    );
  }
  push("");

  push("MONTHLY BILLING");
  push("Month", "Transaction based", "FTE based", "Total", "Budget", "Basis");
  for (const m of snapshot.billing.monthly) {
    push(m.short, m.txn, m.fte, m.total, Math.round(m.budget), m.isActual ? "Actual" : "Forecast");
  }
  push("");

  push("CHARGING MODEL — CURRENT MONTH");
  push("Service", "Charge line", "Volume / FTE", "Rate", "Amount", "Source system");
  for (const s of snapshot.services) {
    for (const l of s.billing.txnLines) {
      push(s.service.code, l.label, l.volume, l.rate, l.amount, l.sourceSystem);
    }
    for (const l of s.billing.fteLines) {
      push(s.service.code, `${l.role} (FTE)`, l.fte, l.ratePerFte, l.amount, "SSC resourcing");
    }
  }
  push("");

  push("KEY PERFORMANCE INDICATORS");
  push("Service", "KPI", "Actual", "Target", "Direction", "Status", "Trend");
  for (const s of snapshot.services) {
    for (const k of s.kpis) {
      push(
        s.service.code,
        k.name,
        k.actual,
        k.target,
        k.direction === "higher-better" ? "Higher is better" : "Lower is better",
        k.status === "good" ? "On target" : k.status === "warn" ? "At risk" : "Off target",
        k.trend,
      );
    }
  }
  push("");

  push("ATTENTION REQUIRED");
  push("Severity", "Item", "Detail", "Actual", "Target");
  for (const a of snapshot.attention) {
    push(a.severity, a.title, a.detail, a.actual ?? "", a.target ?? "");
  }
  push("");

  push("OPEN ISSUES");
  push("Reference", "Issue", "Service", "Priority", "Status", "Opened", "Ageing (days)", "Owner");
  for (const i of snapshot.issues.filter((i) => i.status !== "resolved")) {
    push(i.ref, i.title, i.serviceId.toUpperCase(), i.priority, i.status, i.openedOn, i.agingDays, i.owner);
  }

  return rows.join("\r\n");
}

export function downloadReport(snapshot: EntitySnapshot) {
  const csv = buildReportCsv(snapshot);
  // BOM so Excel opens the ₹ symbol and Indian names correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SSC-report-${snapshot.entity.shortName.replace(/\s+/g, "-")}-${snapshot.period.short}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
