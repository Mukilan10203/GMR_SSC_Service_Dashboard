"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { demoPassword, listDemoUsers } from "@/lib/api";
import type { PortalUser } from "@/lib/domain/types";
import { ENTITIES, LOCATIONS, SERVICE_MAP } from "@/lib/mock/organisation";
import { PortalMark } from "@/components/portal/PortalMark";

/**
 * Sign-in. A conventional credential form on the right, the product's promise
 * on the left. Authentication is simulated, so the demo accounts are listed
 * below the form: picking one fills the credentials in rather than signing
 * straight in, which keeps the flow honest — you still press Sign in.
 */

const PROMISES = [
  {
    title: "Every service in one view",
    body: "F&A, HR Ops, Procurement & Contracts, Indirect Tax and Direct Tax — down to the sub-service: what you consume, what it costs and how it is performing.",
  },
  {
    title: "Billing you can interrogate",
    body: "Every rupee traced back to a transaction volume or an FTE on your rate card, with the drivers behind each movement.",
  },
  {
    title: "Problems that find you",
    body: "SLA breaches, ageing issues and billing anomalies are surfaced against the service and the owner accountable for them.",
  },
];

/** The one-line scope caption under each demo account. */
function scopeCaption(u: PortalUser): string {
  if (u.kind === "ssc") return "All 9 entities · Delivery console";

  if (u.entityIds.length > 1) {
    return `${u.entityIds.length} entities · ${
      u.restrictedServices?.length ? "Restricted services" : "All services"
    }`;
  }

  const entity = ENTITIES.find((e) => e.id === u.entityIds[0]);
  const location = LOCATIONS.find((l) => l.id === entity?.locationId);
  const services = (entity?.services ?? [])
    .filter((s) => !(u.restrictedServices ?? []).includes(s))
    .map((s) => SERVICE_MAP[s].code);
  return `${location?.name ?? "—"} · ${services.join(" · ")}`;
}

/** The headline on each demo account card. */
function accountTitle(u: PortalUser): string {
  if (u.kind === "ssc") return `${u.role} — Shared Service Centre`;
  if (u.entityIds.length > 1) return `${u.role} — ${u.entityIds.length} entities`;
  const entity = ENTITIES.find((e) => e.id === u.entityIds[0]);
  return `${u.role} — ${entity?.name ?? "Workspace"}`;
}

export default function LoginPage() {
  const { login, logout, ready } = useSession();
  const router = useRouter();

  const users = listDemoUsers();
  const [email, setEmail] = useState(users[0]?.email ?? "");
  const [password, setPassword] = useState(demoPassword);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cleared = useRef(false);

  // Landing on sign-in means "let me choose an account" — so a session left
  // over in localStorage is dropped rather than restored. Without this the
  // page bounced straight to the portal before anything was clicked.
  useEffect(() => {
    if (!ready || cleared.current) return;
    cleared.current = true;
    logout();
  }, [ready, logout]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNote(null);
    setBusy(true);

    const result = login(email, password, { remember });
    if (!result.ok) {
      setError(result.error ?? "Unable to sign in.");
      setBusy(false);
      return;
    }

    // SSC staff land in the delivery console; customers in their own portal.
    const account = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    router.replace(account?.kind === "ssc" ? "/ssc" : "/overview");
  };

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* -------------------------------------------------------- */}
      {/* The promise                                               */}
      {/* -------------------------------------------------------- */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden px-12 py-11 lg:flex"
        style={{
          background:
            "linear-gradient(150deg,var(--color-navy) 0%,var(--color-navy-2) 55%,#001b41 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-52 size-[640px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 42% 42%,rgba(246,160,26,.16),rgba(255,255,255,.05) 34%,transparent 68%)",
          }}
        />

        <div className="relative">
          <PortalMark tone="light" />
        </div>

        <div className="relative max-w-[560px]">
          <h2 className="text-[42px] leading-[1.1] font-bold tracking-[-0.035em] text-white">
            Everything your Shared Service Centre does for you, in one place.
          </h2>

          <ul className="mt-9 space-y-6">
            {PROMISES.map((p) => (
              <li key={p.title} className="border-l-2 border-white/25 pl-4">
                <p className="text-[15px] font-semibold text-white">{p.title}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/70">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-white/55">
          Prototype build · Illustrative data only · No production system is connected
        </p>
      </aside>

      {/* -------------------------------------------------------- */}
      {/* Credentials                                               */}
      {/* -------------------------------------------------------- */}
      <section className="flex min-h-dvh flex-col justify-center bg-canvas px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-8 lg:hidden">
            <PortalMark tone="dark" />
          </div>

          <h1
            className="text-[34px] leading-tight font-bold tracking-[-0.035em]"
            style={{ color: "var(--color-navy)" }}
          >
            Sign in
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-3">
            Use your organisation email address to access your service portal.
          </p>

          <form onSubmit={submit} className="mt-7">
            <label htmlFor="email" className="block text-[13px] font-semibold text-ink-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-line bg-surface px-4 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
              placeholder="you@yourcompany.com"
              required
            />

            <div className="mt-5 flex items-baseline justify-between gap-4">
              <label htmlFor="password" className="block text-[13px] font-semibold text-ink-2">
                Password
              </label>
              <button
                type="button"
                onClick={() => setNote(`Demonstration build — the password for every account is ${demoPassword}.`)}
                className="text-[13px] font-medium text-accent hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-line bg-surface px-4 text-[14px] text-ink outline-none transition-colors focus:border-accent"
              required
            />

            <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-[14px] text-ink-2">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-[18px] cursor-pointer accent-[var(--color-accent)]"
              />
              Keep me signed in on this device
            </label>

            <button
              type="submit"
              disabled={busy}
              className="mt-6 h-[52px] w-full rounded-xl text-[15px] font-bold text-white transition-transform hover:-translate-y-px disabled:opacity-60"
              style={{ background: "var(--color-navy)" }}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-[10px] border border-bad-line bg-bad-soft px-3 py-2.5 text-[12.5px] text-bad"
              >
                {error}
              </p>
            )}
            {note && (
              <p className="mt-4 rounded-[10px] border border-accent-line bg-accent-soft px-3 py-2.5 text-[12.5px] text-accent-strong">
                {note}
              </p>
            )}
          </form>

          {/* ---------------------------------------------------- */}
          {/* Demo accounts                                         */}
          {/* ---------------------------------------------------- */}
          <div className="mt-9 border-t border-line pt-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="eyebrow-muted">Demo accounts</p>
              <p className="text-[11.5px] text-ink-4">
                Password <span className="font-mono text-ink-3">{demoPassword}</span>
              </p>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
              Each account carries a different scope. The portal only ever shows the entities and
              services that account is authorised for.
            </p>

            <div className="mt-4 space-y-2.5">
              {users.map((u) => {
                const selected = u.email.toLowerCase() === email.trim().toLowerCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword(demoPassword);
                      setError(null);
                      setNote(null);
                    }}
                    aria-pressed={selected}
                    className={`w-full rounded-[13px] border p-4 text-left transition-all ${
                      selected
                        ? "border-accent-line bg-accent-soft"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunken"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${
                          selected ? "text-white" : "text-ink-3"
                        }`}
                        style={{
                          background: selected ? "var(--color-navy)" : "var(--color-neutral-soft)",
                        }}
                      >
                        {u.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <b
                            className="text-[14.5px] font-semibold"
                            style={{ color: "var(--color-navy)" }}
                          >
                            {accountTitle(u)}
                          </b>
                          {u.kind === "ssc" && (
                            <span className="rounded-full border border-cta/30 px-2 py-[2px] text-[9px] font-extrabold tracking-[0.06em] text-cta uppercase">
                              SSC
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block font-mono text-[12px] text-ink-3">
                          {u.email}
                        </span>
                      </span>
                    </div>
                    <p className="mt-2.5 text-[12px] text-ink-4">{scopeCaption(u)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-7 text-[12px] leading-relaxed text-ink-4">
            This is a demonstration build. Authentication is simulated, all figures are illustrative,
            and no SAP, Ariba, HR or automation system is connected.
          </p>
        </div>
      </section>
    </main>
  );
}
