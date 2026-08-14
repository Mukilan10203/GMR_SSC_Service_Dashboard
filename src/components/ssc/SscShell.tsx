"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { getEstateSummary, getUserScope, providerTowers } from "@/lib/api";
import type { EstateSummary } from "@/lib/api";
import { PortalMark } from "@/components/portal/PortalMark";
import { Select } from "@/components/portal/PortalShell";
import { cx } from "@/lib/format";
import {
  IconCustomers,
  IconExternal,
  IconIssues,
  IconLogout,
  IconMenu,
  IconOverview,
  IconServices,
} from "@/components/portal/icons";

/**
 * Shell for the SSC delivery console — the provider's side of the portal.
 *
 * Deliberately not the customer shell. There is no entity switcher here,
 * because the console is never scoped to one customer: every screen reads
 * the whole estate. The rail is marked so nobody can mistake which side of
 * the contract they are looking at.
 */

const NAV = [
  { href: "/ssc", label: "Command centre", Icon: IconOverview },
  { href: "/ssc/issues", label: "Issue queue", Icon: IconIssues },
  { href: "/ssc/customers", label: "Customers & adoption", Icon: IconCustomers },
];

/**
 * The estate is nine snapshots wide, so it is built once here and handed
 * down rather than rebuilt per page.
 */
export function useEstate(): { estate: EstateSummary | null; ready: boolean } {
  const { user, periodId, monthIndex, ready } = useSession();
  const estate = useMemo(
    () => (user && periodId ? getEstateSummary(user, periodId, monthIndex) : null),
    [user, periodId, monthIndex],
  );
  return { estate, ready };
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useSession();
  const towers = user ? providerTowers(user) : [];

  return (
    <div className="flex h-full flex-col border-r border-line bg-rail">
      <div className="border-b border-line px-5 py-4">
        <Link href="/ssc" onClick={onNavigate} title="SSC Delivery Console">
          <PortalMark tone="dark" name="SSC Delivery Console" sub="Provider view" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5 pt-3">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/ssc" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cx(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
                    active
                      ? "bg-rail-active font-semibold text-accent"
                      : "text-rail-ink hover:bg-rail-active hover:text-accent",
                  )}
                >
                  <Icon size={17} className={active ? "text-accent" : "text-rail-ink-dim"} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-3 my-3 border-t border-rail-line" />

        <p className="px-3 pb-1.5 text-[9px] font-bold tracking-[0.08em] text-ink-4 uppercase">
          Towers in scope
        </p>
        <ul className="space-y-px">
          {towers.map((t) => (
            <li key={t.id}>
              <span className="flex items-center gap-2 rounded-md px-3 py-[7px] text-[12.5px] text-rail-ink">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: `var(--color-svc-${t.id})` }}
                />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mx-3 my-3 border-t border-rail-line" />

        <Link
          href="/overview"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-rail-ink transition-colors hover:bg-rail-active hover:text-accent"
        >
          <IconServices size={16} className="text-rail-ink-dim" />
          <span className="flex-1">Open customer view</span>
          <IconExternal size={13} className="text-rail-ink-dim" />
        </Link>
      </nav>

      <div className="border-t border-rail-line px-5 py-4">
        <p className="eyebrow-muted">Delivered by</p>
        <p
          className="mt-1.5 text-[12.5px] leading-snug font-semibold"
          style={{ color: "var(--color-navy)" }}
        >
          GMR Shared Service Centre
        </p>
        <p className="mt-1 text-[11px] text-ink-4">
          Every customer, every live tower, one queue.
        </p>
      </div>
    </div>
  );
}

function PeriodControl() {
  const { user, periodId, setPeriod } = useSession();
  const scope = useMemo(() => (user ? getUserScope(user) : null), [user]);
  if (!scope) return null;

  return (
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
  );
}

function AccountChip() {
  const { user, logout } = useSession();
  const router = useRouter();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="text-[12.5px] leading-tight font-medium text-ink">{user.name}</p>
        <p className="text-[11px] leading-tight text-ink-4">{user.role}</p>
      </div>
      <span
        className="flex size-[35px] items-center justify-center rounded-full text-[12px] font-extrabold text-white"
        style={{ background: "linear-gradient(135deg,var(--color-navy),var(--color-accent))" }}
      >
        {user.initials}
      </span>
      <button
        type="button"
        onClick={() => {
          logout();
          router.replace("/login");
        }}
        className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        aria-label="Sign out"
        title="Sign out"
      >
        <IconLogout size={16} />
      </button>
    </div>
  );
}

export function SscShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar />
      </aside>

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
          <div className="flex min-h-[68px] flex-wrap items-center gap-3 px-5 py-3 lg:flex-nowrap xl:px-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 lg:hidden"
              aria-label="Open navigation"
            >
              <IconMenu size={18} />
            </button>

            <span className="hidden items-center gap-2 rounded-lg border border-accent-line bg-accent-soft px-3 py-1.5 text-[11px] font-extrabold tracking-[0.06em] text-accent uppercase sm:inline-flex">
              Provider view
            </span>

            <PeriodControl />

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <AccountChip />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-5 pt-6 pb-16 xl:px-8">{children}</main>

        <footer className="border-t border-line px-5 py-5 xl:px-8">
          <p className="text-[11.5px] text-ink-4">
            SSC Delivery Console — prototype. The same records the customer portal shows, pivoted
            for the delivery organisation. All figures are illustrative.
          </p>
        </footer>
      </div>
    </div>
  );
}
