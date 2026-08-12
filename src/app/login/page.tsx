"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { demoPassword, listDemoUsers } from "@/lib/api";
import { ENTITIES, LOCATIONS, SERVICE_MAP } from "@/lib/mock/organisation";
import { cx } from "@/lib/format";
import { PortalMark } from "@/components/portal/PortalMark";

const VALUE_PROPS = [
  {
    title: "Every service in one view",
    body: "Finance & accounting, HR, tax, automation and analytics — what you consume, what it costs and how it is performing.",
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

export default function LoginPage() {
  const { login, user, ready } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("cfo@delhiairport.demo");
  const [password, setPassword] = useState(demoPassword);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/overview");
  }, [ready, user, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = login(email, password);
    if (!result.ok) {
      setError(result.error ?? "Unable to sign in.");
      setBusy(false);
      return;
    }
    router.replace("/overview");
  };

  const users = listDemoUsers();

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ---------------------------------------------------------- */}
      {/* Brand panel                                                */}
      {/* ---------------------------------------------------------- */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-rail px-12 py-12 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5]"
          style={{
            background:
              "radial-gradient(1100px 520px at 12% -8%, rgba(56,116,182,0.42), transparent 62%), radial-gradient(760px 460px at 96% 108%, rgba(20,74,120,0.5), transparent 60%)",
          }}
        />
        <div className="relative">
          <PortalMark tone="light" />
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] text-white">
            Everything your Shared Service Centre does for you, in one place.
          </h1>
          <ul className="mt-9 space-y-6">
            {VALUE_PROPS.map((v) => (
              <li key={v.title} className="border-l-2 border-rail-line pl-4">
                <p className="text-[14px] font-semibold text-white">{v.title}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-rail-ink">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-rail-ink-dim">
          Prototype build · Illustrative data only · No production system is connected
        </p>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Sign-in                                                    */}
      {/* ---------------------------------------------------------- */}
      <section className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="lg:hidden">
            <PortalMark tone="dark" />
          </div>

          <h2 className="mt-8 text-[26px] font-semibold tracking-[-0.02em] text-ink lg:mt-0">
            Sign in
          </h2>
          <p className="mt-1.5 text-[13.5px] text-ink-3">
            Use your organisation email address to access your service portal.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
                placeholder="name@organisation.com"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="password" className="text-[12.5px] font-medium text-ink-2">
                  Password
                </label>
                <button
                  type="button"
                  className="text-[12.5px] font-medium text-accent hover:text-accent-strong"
                  onClick={() => setError("Password reset is not enabled in this prototype.")}
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
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            <label className="flex items-center gap-2.5 pt-0.5 text-[13px] text-ink-2 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 rounded border-line-strong accent-[var(--color-accent)]"
              />
              Keep me signed in on this device
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-bad-line bg-bad-soft px-3 py-2.5 text-[12.5px] text-bad"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-rail px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-rail-2 disabled:opacity-70"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Demo personas */}
          <div className="mt-9 border-t border-line pt-6">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Demo accounts</p>
              <p className="text-[11.5px] text-ink-4">
                Password <code className="rounded bg-neutral-soft px-1.5 py-0.5 font-mono text-ink-2">{demoPassword}</code>
              </p>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
              Each account carries a different scope. The portal only ever shows the entities and
              services that account is authorised for.
            </p>

            <ul className="mt-3.5 space-y-2">
              {users.map((u) => {
                const entity = ENTITIES.find((e) => e.id === u.entityIds[0]);
                const location = LOCATIONS.find((l) => l.id === entity?.locationId);
                const services = (entity?.services ?? []).filter(
                  (s) => !(u.restrictedServices ?? []).includes(s),
                );
                const selected = email.toLowerCase() === u.email;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(u.email);
                        setPassword(demoPassword);
                        setError(null);
                      }}
                      className={cx(
                        "w-full rounded-lg border px-3.5 py-3 text-left transition-colors",
                        selected
                          ? "border-accent-line bg-accent-soft"
                          : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunken",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cx(
                            "flex size-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold",
                            selected ? "bg-accent text-white" : "bg-neutral-soft text-ink-2",
                          )}
                        >
                          {u.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {u.role} —{" "}
                            {u.entityIds.length > 1
                              ? `${u.entityIds.length} entities`
                              : entity?.name}
                          </p>
                          <p className="truncate font-mono text-[11.5px] text-ink-3">{u.email}</p>
                        </div>
                      </div>
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-4">
                        <span>{u.entityIds.length > 1 ? `${u.entityIds.length} entities` : location?.name}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {u.entityIds.length > 1
                            ? "All services"
                            : services.map((s) => SERVICE_MAP[s].code).join(" · ")}
                        </span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-7 text-[11.5px] leading-relaxed text-ink-4">
            This is a demonstration build. Authentication is simulated, all figures are illustrative,
            and no SAP, Ariba, HR or automation system is connected.
          </p>
        </div>
      </section>
    </main>
  );
}
