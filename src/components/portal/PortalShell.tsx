"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { usePortalData, useUserScope } from "./usePortalData";
import { PortalMark } from "./PortalMark";
import { downloadReport } from "./export";
import { cx, formatMoney } from "@/lib/format";
import { lockedServicesFor, SERVICE_MAP } from "@/lib/mock/organisation";
import { DEMO_AS_OF_LABEL } from "@/lib/mock/calendar";
import type { EntitySnapshot } from "@/lib/domain/types";
import { serviceColor, StatusDot } from "@/components/ui/primitives";
import {
  IconAnalytics,
  IconAutomation,
  IconBell,
  IconBilling,
  IconChevron,
  IconChevronDown,
  IconClose,
  IconDownload,
  IconIssues,
  IconLock,
  IconLogout,
  IconMenu,
  IconOverview,
  IconPerformance,
  IconPortfolio,
  IconSearch,
  IconServices,
  IconSidebar,
} from "./icons";

/* ------------------------------------------------------------------ */
/* Navigation model                                                    */
/* ------------------------------------------------------------------ */

const NAV = [
  { href: "/overview", label: "Overview", Icon: IconOverview },
  { href: "/services", label: "Services", Icon: IconServices, expandable: true },
  { href: "/billing", label: "Billing", Icon: IconBilling },
  { href: "/issues", label: "Issues & Feedback", Icon: IconIssues },
] as const;

/** Capabilities not yet available in this preview — shown locked, not hidden. */
const LOCKED_NAV = [
  { label: "Performance", Icon: IconPerformance },
  { label: "Automation", Icon: IconAutomation },
  { label: "Analytics", Icon: IconAnalytics },
] as const;

/* ------------------------------------------------------------------ */
/* Popover plumbing                                                    */
/* ------------------------------------------------------------------ */

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function Select({
  label,
  value,
  options,
  onChange,
  minWidth = 168,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; hint?: string; disabled?: boolean }[];
  onChange: (id: string) => void;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find((o) => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left transition-colors hover:border-line-strong"
        style={{ minWidth }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-[11px] font-medium tracking-wide text-ink-4 uppercase">{label}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
          {current?.label ?? "—"}
        </span>
        <IconChevronDown size={14} className="shrink-0 text-ink-4" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+4px)] left-0 z-50 max-h-[340px] min-w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-pop"
        >
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                disabled={o.disabled}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] transition-colors",
                  o.id === value ? "bg-accent-soft text-accent-strong" : "text-ink hover:bg-surface-sunken",
                  o.disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.label}</span>
                  {o.hint && <span className="mt-0.5 block truncate text-[11.5px] text-ink-4">{o.hint}</span>}
                </span>
                {o.id === value && <span className="mt-0.5 shrink-0 text-accent">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scope selectors                                                     */
/* ------------------------------------------------------------------ */

function ScopeControls() {
  const { entityId, periodId, monthIndex, setEntity, setPeriod, setMonthIndex } = useSession();
  const { snapshot } = usePortalData();
  const scope = useUserScope();
  const [locationId, setLocationId] = useState<string>("");

  const currentEntity = scope?.entities.find((e) => e.id === entityId);
  const activeLocation = locationId || currentEntity?.locationId || "";

  useEffect(() => {
    if (currentEntity && !locationId) setLocationId(currentEntity.locationId);
  }, [currentEntity, locationId]);

  if (!scope) return null;

  const entitiesInLocation = scope.entities.filter((e) => e.locationId === activeLocation);
  const multiEntity = scope.entities.length > 1;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {multiEntity && (
        <Select
          label="Location"
          value={activeLocation}
          minWidth={150}
          options={scope.locations.map((l) => ({
            id: l.id,
            label: l.name,
            hint: `${scope.entities.filter((e) => e.locationId === l.id).length} entities · ${l.region}`,
          }))}
          onChange={(id) => {
            setLocationId(id);
            const first = scope.entities.find((e) => e.locationId === id);
            if (first) setEntity(first.id);
          }}
        />
      )}

      <Select
        label="Entity"
        value={entityId}
        minWidth={multiEntity ? 230 : 260}
        options={(multiEntity ? entitiesInLocation : scope.entities).map((e) => ({
          id: e.id,
          label: e.name,
          hint: `${e.services.length} services · ${e.sector}`,
        }))}
        onChange={setEntity}
      />

      <Select
        label="Period"
        value={periodId}
        minWidth={132}
        options={scope.periods.map((p) => ({
          id: p.id,
          label: p.label,
          hint: p.isCurrent ? "Current year, in progress" : "Closed year",
        }))}
        onChange={setPeriod}
      />

      {snapshot && <MonthSelect snapshot={snapshot} value={monthIndex} onChange={setMonthIndex} />}
    </div>
  );
}

/**
 * Which closed month the portal is read at. "Latest" tracks the most recent
 * close; picking an earlier month re-cuts every figure as at that month end,
 * so later months become forecast.
 */
function MonthSelect({
  snapshot,
  value,
  onChange,
}: {
  snapshot: EntitySnapshot;
  value: number | null;
  onChange: (monthIndex: number | null) => void;
}) {
  // Only months that have closed in the underlying year can be selected.
  const closedCount = snapshot.period.isCurrent
    ? Math.max(snapshot.period.actualMonthCount, value != null ? value + 1 : 0)
    : 12;
  const selectable = snapshot.period.months.slice(0, Math.max(1, closedCount));
  const latest = selectable[selectable.length - 1];

  return (
    <Select
      label="Month"
      value={value == null ? "latest" : String(value)}
      minWidth={148}
      options={[
        { id: "latest", label: `Latest — ${latest?.short ?? ""}`, hint: "Most recent close" },
        ...selectable
          .map((m) => ({
            id: String(m.index),
            label: m.label,
            hint: `Q${m.quarter} · as at ${m.label} close`,
          }))
          .reverse(),
      ]}
      onChange={(id) => onChange(id === "latest" ? null : Number(id))}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const { snapshot } = usePortalData();
  const router = useRouter();

  const items = snapshot?.attention.slice(0, 6) ?? [];
  const critical = snapshot?.attention.filter((a) => a.severity === "critical").length ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        aria-label={`Notifications, ${critical} critical`}
      >
        <IconBell size={17} />
        {critical > 0 && (
          <span className="absolute -top-1 -right-1 flex size-[17px] items-center justify-center rounded-full bg-bad text-[10px] font-semibold text-white tnum">
            {critical}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[380px] rounded-xl border border-line bg-surface shadow-pop">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">Alerts</p>
            <p className="text-[11.5px] text-ink-4">{snapshot?.attention.length ?? 0} open</p>
          </header>
          <ul className="max-h-[400px] divide-y divide-line-soft overflow-y-auto">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(a.href);
                  }}
                  className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-sunken"
                >
                  <StatusDot
                    status={a.severity === "critical" ? "bad" : a.severity === "warning" ? "warn" : "good"}
                    title={a.severity}
                  />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] leading-snug font-medium text-ink">{a.title}</span>
                    <span className="mt-1 block line-clamp-2 text-[11.5px] leading-relaxed text-ink-3">
                      {a.detail}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <footer className="border-t border-line px-4 py-2.5">
            <Link
              href="/overview#attention"
              onClick={() => setOpen(false)}
              className="text-[12.5px] font-medium text-accent hover:text-accent-strong"
            >
              View all items requiring attention →
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Global search                                                       */
/* ------------------------------------------------------------------ */

interface Hit {
  id: string;
  label: string;
  detail: string;
  group: string;
  href: string;
}

function Search() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useDismiss(open, () => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);
  const { snapshot } = usePortalData();
  const router = useRouter();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    if (!snapshot) return [];
    const all: Hit[] = [
      ...snapshot.services.map((s) => ({
        id: `svc-${s.service.id}`,
        label: s.service.name,
        detail: `${s.service.tagline} · SLA ${s.sla.overall.toFixed(1)}%`,
        group: "Services",
        href: `/services/${s.service.id}`,
      })),
      ...snapshot.services.flatMap((s) =>
        s.kpis.map((k) => ({
          id: `kpi-${k.id}`,
          label: k.name,
          detail: `${s.service.code} · actual ${k.actual} against target ${k.target}`,
          group: "KPIs",
          href: `/services/${s.service.id}?tab=kpi`,
        })),
      ),
      ...snapshot.issues.map((i) => ({
        id: `iss-${i.id}`,
        label: i.title,
        detail: `${i.ref} · ${SERVICE_MAP[i.serviceId].code} · ${i.priority} · ${i.status}`,
        group: "Issues",
        href: `/issues?issue=${i.id}`,
      })),
    ];

    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 8);
    return all
      .filter((h) => `${h.label} ${h.detail}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [snapshot, q]);

  const grouped = hits.reduce<Record<string, Hit[]>>((acc, h) => {
    (acc[h.group] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
      >
        <IconSearch size={16} />
        <span className="hidden text-[13px] lg:inline">Search</span>
        <kbd className="ml-1 hidden rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-4 lg:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[440px] rounded-xl border border-line bg-surface shadow-pop">
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
            <IconSearch size={16} className="text-ink-4" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search services, KPIs, issues, bots…"
              className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4"
            />
            <button type="button" onClick={() => setOpen(false)} className="text-ink-4 hover:text-ink-2">
              <IconClose size={16} />
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto py-1.5">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="mb-1">
                <p className="eyebrow px-3.5 py-1.5">{group}</p>
                {list.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                      router.push(h.href);
                    }}
                    className="block w-full px-3.5 py-2 text-left transition-colors hover:bg-surface-sunken"
                  >
                    <span className="block truncate text-[13px] font-medium text-ink">{h.label}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{h.detail}</span>
                  </button>
                ))}
              </div>
            ))}
            {hits.length === 0 && (
              <p className="px-3.5 py-6 text-center text-[12.5px] text-ink-3">
                Nothing matches “{q}”. Try a service, KPI or issue reference.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account menu                                                        */
/* ------------------------------------------------------------------ */

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const { user, logout } = useSession();
  const { snapshot } = usePortalData();
  const router = useRouter();

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg border border-line bg-surface py-1 pr-2 pl-1 transition-colors hover:border-line-strong"
      >
        <span
          className="flex size-[35px] items-center justify-center rounded-full text-[12px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg,var(--color-navy),var(--color-accent))" }}
        >
          {user.initials}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block text-[12.5px] leading-tight font-medium text-ink">{user.name}</span>
          <span className="block text-[11px] leading-tight text-ink-4">{user.role}</span>
        </span>
        <IconChevronDown size={14} className="text-ink-4" />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[268px] rounded-xl border border-line bg-surface py-1.5 shadow-pop">
          <div className="border-b border-line px-4 pt-2 pb-3">
            <p className="text-[13px] font-semibold text-ink">{user.name}</p>
            <p className="text-[12px] text-ink-3">{user.title}</p>
            <p className="mt-1 font-mono text-[11px] text-ink-4">{user.email}</p>
          </div>
          <div className="border-b border-line px-4 py-3">
            <p className="eyebrow mb-1.5">Authorised scope</p>
            <p className="text-[12px] text-ink-2">
              {user.entityIds.length === 1
                ? snapshot?.entity.name
                : `${user.entityIds.length} entities across the group`}
            </p>
            <p className="mt-1 text-[11.5px] text-ink-4">
              {snapshot?.services.map((s) => s.service.code).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <IconLogout size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function Sidebar({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { snapshot, user } = usePortalData();
  const [servicesOpen, setServicesOpen] = useState(true);

  const services = snapshot?.services ?? [];
  const locked = snapshot ? lockedServicesFor(snapshot.entity) : [];
  const showPortfolio = (user?.entityIds.length ?? 0) > 1;

  const nav = NAV;

  return (
    <div className="flex h-full flex-col border-r border-line bg-rail">
      <div className={cx("border-b border-line py-4", collapsed ? "flex justify-center px-3" : "px-5")}>
        <Link href="/overview" onClick={onNavigate} title="SSC Customer Portal">
          <PortalMark tone="dark" compact={collapsed} />
        </Link>
      </div>

      <nav className={cx("flex-1 overflow-y-auto pb-4", collapsed ? "px-2" : "px-3")}>
        <ul className="space-y-0.5">
          {nav.map(({ href, label, Icon, ...rest }) => {
            const active = pathname === href || (href !== "/overview" && pathname.startsWith(href));
            const expandable = "expandable" in rest && rest.expandable;
            return (
              <li key={href}>
                <div className="flex items-center">
                  <Link
                    href={href}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    className={cx(
                      "flex flex-1 items-center rounded-lg py-2 text-[13.5px] transition-colors",
                      collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                      active
                        ? "bg-rail-active font-semibold text-accent"
                        : "text-rail-ink hover:bg-rail-active hover:text-accent",
                    )}
                  >
                    <Icon size={17} className={active ? "text-accent" : "text-rail-ink-dim"} />
                    {!collapsed && label}
                  </Link>
                  {expandable && !collapsed && (
                    <button
                      type="button"
                      onClick={() => setServicesOpen((v) => !v)}
                      aria-label={servicesOpen ? "Collapse services" : "Expand services"}
                      className="mr-1 rounded p-1 text-rail-ink-dim transition-colors hover:text-white"
                    >
                      <IconChevron
                        size={13}
                        className={cx("transition-transform", servicesOpen && "rotate-90")}
                      />
                    </button>
                  )}
                </div>

                {expandable && !collapsed && servicesOpen && services.length > 0 && (
                  <ul className="mt-0.5 mb-1 ml-[22px] space-y-px border-l border-rail-line pl-2.5">
                    {services.map((s) => {
                      const shref = `/services/${s.service.id}`;
                      const sactive = pathname === shref;
                      return (
                        <li key={s.service.id}>
                          <Link
                            href={shref}
                            onClick={onNavigate}
                            className={cx(
                              "flex items-center gap-2 rounded-md px-2.5 py-[7px] text-[12.5px] transition-colors",
                              sactive
                                ? "bg-rail-active font-semibold text-accent"
                                : "text-rail-ink hover:bg-rail-active hover:text-accent",
                            )}
                          >
                            <span
                              className="size-1.5 shrink-0 rounded-full"
                              style={{ background: serviceColor(s.service.id) }}
                            />
                            <span className="min-w-0 flex-1 truncate">{s.service.code}</span>
                            {s.sla.status !== "good" && (
                              <span
                                className="size-1.5 shrink-0 rounded-full"
                                style={{
                                  background: s.sla.status === "bad" ? "var(--color-bad)" : "var(--color-warn)",
                                }}
                                title={`SLA ${s.sla.overall.toFixed(1)}%`}
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                    {locked.map((s) => (
                      <li key={s.id}>
                        <span
                          className="flex cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-[7px] text-[12.5px] text-rail-ink-dim/70"
                          title={`${s.name} — coming soon`}
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-rail-ink-dim/40" />
                          <span className="min-w-0 flex-1 truncate">{s.code}</span>
                          <IconLock size={11} className="shrink-0" />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}

          <li className="pt-2">
            <div className="mx-3 mb-2 border-t border-rail-line" />
            <ul className="space-y-0.5">
              {LOCKED_NAV.map(({ label, Icon }) => (
                <li key={label}>
                  <span
                    className={cx(
                      "flex cursor-not-allowed items-center rounded-lg py-2 text-[13.5px] text-rail-ink-dim/70",
                      collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                    )}
                    title={`${label} — coming soon`}
                  >
                    <Icon size={17} className="text-rail-ink-dim/50" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{label}</span>
                        <IconLock size={13} className="text-rail-ink-dim/60" />
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </li>

          {showPortfolio && (
            <li className="pt-2">
              <div className="mx-3 mb-2 border-t border-rail-line" />
              <Link
                href="/portfolio"
                onClick={onNavigate}
                title={collapsed ? "Portfolio" : undefined}
                className={cx(
                  "flex items-center rounded-lg py-2 text-[13.5px] transition-colors",
                  collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                  pathname.startsWith("/portfolio")
                    ? "bg-rail-active font-semibold text-accent"
                    : "text-rail-ink hover:bg-rail-active hover:text-accent",
                )}
              >
                <IconPortfolio size={17} className={pathname.startsWith("/portfolio") ? "text-accent" : "text-rail-ink-dim"} />
                {!collapsed && "Portfolio"}
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <div className={cx("border-t border-rail-line px-5 py-4", collapsed && "hidden")}>
        {snapshot && (
          <>
            <p className="eyebrow-muted">Contracted with</p>
            <p className="mt-1.5 text-[12.5px] leading-snug font-semibold" style={{ color: "var(--color-navy)" }}>
              {snapshot.entity.legalName}
            </p>
            <p className="mt-1 text-[11px] text-ink-4">
              Relationship manager · {snapshot.entity.relationshipManager}
            </p>
          </>
        )}
        <p className="mt-3 border-t border-rail-line pt-3 text-[10.5px] leading-relaxed text-ink-4">
          Prototype build · illustrative data as at {DEMO_AS_OF_LABEL}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export function PortalShell({ children }: { children: ReactNode }) {
  const { snapshot } = usePortalData();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const [exported, setExported] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);

  // Remember the rail state — a full-width view should survive navigation.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem("ssc-rail-collapsed") === "1");
  }, []);
  const toggleRail = () =>
    setCollapsed((v) => {
      window.localStorage.setItem("ssc-rail-collapsed", v ? "0" : "1");
      return !v;
    });

  return (
    <div
      className={cx(
        "min-h-dvh lg:grid",
        collapsed ? "lg:grid-cols-[64px_minmax(0,1fr)]" : "lg:grid-cols-[248px_minmax(0,1fr)]",
      )}
    >
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[268px] shadow-pop">
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-surface">
          <div className="flex min-h-[68px] flex-wrap items-center gap-3 px-5 py-3 xl:px-6">
            <button
              type="button"
              onClick={toggleRail}
              className="hidden size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink lg:flex"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-pressed={collapsed}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              <IconSidebar size={17} />
            </button>

            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 lg:hidden"
              aria-label="Open navigation"
            >
              <IconMenu size={18} />
            </button>

            <ScopeControls />

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!snapshot) return;
                  downloadReport(snapshot);
                  setExported(true);
                  window.setTimeout(() => setExported(false), 2600);
                }}
                className="hidden h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink sm:flex"
              >
                <IconDownload size={16} />
                {exported ? "Downloaded" : "Report"}
              </button>
              <Search />
              <Notifications />
              <AccountMenu />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-5 pt-6 pb-16 xl:px-8">{children}</main>

        <footer className="border-t border-line px-5 py-5 xl:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-ink-4">
            <p>
              SSC Customer Portal — prototype. All figures are illustrative and no production system
              is connected.
            </p>
            {snapshot && (
              <p className="tnum">
                {snapshot.entity.name} · {snapshot.period.label} · data as at {snapshot.period.asOf} ·
                full-year SSC fee {formatMoney(snapshot.billing.fyForecast)}
              </p>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
