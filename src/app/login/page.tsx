"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { demoPassword, listDemoUsers } from "@/lib/api";
import type { PortalUser } from "@/lib/domain/types";
import { ENTITIES, LOCATIONS, SERVICE_MAP } from "@/lib/mock/organisation";
import { PortalMark } from "@/components/portal/PortalMark";

/**
 * Sign-in, styled as the "Choose your business workspace" card from the
 * GMR Transformation Engine design system: a centred modal card on a soft
 * gradient, a red eyebrow, a navy heading, and one tile per workspace.
 * No credentials are typed — selecting a workspace signs you into it.
 */

const WORKSPACE_ICON: Record<string, string> = {
  "cfo@delhiairport.demo": "✈",
  "group.cfo@gmrgroup.demo": "◈",
  "ceo@hyderabadairport.demo": "⚡",
  "hr.head@delhiairport.demo": "◎",
  "tax.head@delhiairport.demo": "▣",
};

/** The scope a persona signs into: one entity, a single-location cluster, or the group. */
function scopeLabel(entityIds: string[]): string {
  if (entityIds.length === 1) {
    return ENTITIES.find((e) => e.id === entityIds[0])?.name ?? "Workspace";
  }
  const entities = ENTITIES.filter((e) => entityIds.includes(e.id));
  const locations = new Set(entities.map((e) => e.locationId));
  if (locations.size === 1) {
    const loc = LOCATIONS.find((l) => l.id === entities[0].locationId);
    return `${loc?.name} cluster`;
  }
  return "GMR Group";
}

export default function LoginPage() {
  const { login, logout, ready } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cleared = useRef(false);

  // Landing on sign-in means "let me choose a workspace" — so a session left
  // over in localStorage is dropped rather than restored. Without this the
  // page bounced straight to /overview before anything was clicked.
  useEffect(() => {
    if (!ready || cleared.current) return;
    cleared.current = true;
    logout();
  }, [ready, logout]);

  /** SSC staff land in the delivery console; customers land in their portal. */
  const signIn = (user: PortalUser) => {
    setError(null);
    setBusy(user.email);
    const result = login(user.email, demoPassword);
    if (!result.ok) {
      setError(result.error ?? "Unable to sign in.");
      setBusy(null);
      return;
    }
    router.replace(user.kind === "ssc" ? "/ssc" : "/overview");
  };

  const allUsers = listDemoUsers();
  const users = allUsers.filter((u) => u.kind !== "ssc");
  const sscUsers = allUsers.filter((u) => u.kind === "ssc");

  return (
    <main
      className="grid min-h-dvh place-items-center px-5 py-10"
      style={{
        background:
          "linear-gradient(135deg,#f8fbff 0%,#eff7ff 52%,#f5fffe 100%)",
      }}
    >
      {/* Soft brand glow, as on the reference hero */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(6,63,145,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(6,63,145,.04) 1px,transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage: "linear-gradient(90deg,transparent,black)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 -right-40 size-[620px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 42% 42%,rgba(246,160,26,.20),rgba(6,63,145,.10) 32%,transparent 66%)",
        }}
      />

      <div
        className="relative w-full max-w-[720px] overflow-hidden bg-surface"
        style={{ borderRadius: 20, boxShadow: "0 30px 80px rgba(3,15,34,.22)" }}
      >
        {/* Head */}
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-6 sm:px-7">
          <div className="min-w-0">
            <p className="eyebrow">Secure customer access</p>
            <h1
              className="mt-2 text-[26px] leading-[1.12] font-semibold tracking-[-0.035em] sm:text-[28px]"
              style={{ color: "var(--color-navy)" }}
            >
              Choose your business workspace
            </h1>
          </div>
          <PortalMark tone="dark" compact />
        </header>

        {/* Body */}
        <div className="px-6 py-6 sm:px-7">
          <p className="mb-5 text-center text-[14px] leading-relaxed text-ink-3">
            Select a customer profile to preview its services, performance, billing and the value the
            Shared Service Centre is creating.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {users.map((u) => {
              const entity = ENTITIES.find((e) => e.id === u.entityIds[0]);
              const location = LOCATIONS.find((l) => l.id === entity?.locationId);
              const services = (entity?.services ?? []).filter(
                (s) => !(u.restrictedServices ?? []).includes(s),
              );
              const multi = u.entityIds.length > 1;
              const scope = scopeLabel(u.entityIds);
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => signIn(u)}
                  className="group rounded-[13px] border border-line bg-surface p-[18px] text-left transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent-soft disabled:opacity-60"
                >
                  <span className="text-[23px] leading-none" aria-hidden>
                    {WORKSPACE_ICON[u.email] ?? "◆"}
                  </span>
                  <b
                    className="mt-2.5 block text-[16px] font-semibold"
                    style={{ color: "var(--color-navy)" }}
                  >
                    {u.role}
                  </b>
                  <span className="mt-1 block text-[11.5px] leading-relaxed text-ink-3">
                    {scope}
                    {multi
                      ? ` · ${u.entityIds.length} entities`
                      : ` · ${location?.name}`}
                    <br />
                    {multi
                      ? "All contracted services"
                      : services.map((s) => SERVICE_MAP[s].name).join(", ")}
                  </span>
                  <span className="mt-3 block text-[11px] font-semibold text-accent">
                    {busy === u.email ? "Signing in…" : "Enter workspace →"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* The other side of the contract — the delivery organisation. */}
          {sscUsers.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="eyebrow mb-1">Shared Service Centre</p>
              <p className="mb-3 text-[12.5px] leading-relaxed text-ink-3">
                The SSC signs in to the delivery console: every customer, every live tower, and one
                queue holding every open issue in the estate.
              </p>
              <div className="grid gap-2.5">
                {sscUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => signIn(u)}
                    className="group rounded-[13px] border border-accent-line bg-accent-soft/40 p-[18px] text-left transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent-soft disabled:opacity-60"
                  >
                    <span className="text-[23px] leading-none" aria-hidden>
                      ◫
                    </span>
                    <b
                      className="mt-2.5 block text-[16px] font-semibold"
                      style={{ color: "var(--color-navy)" }}
                    >
                      {u.role}
                    </b>
                    <span className="mt-1 block text-[11.5px] leading-relaxed text-ink-3">
                      {u.name} · {u.demoNote}
                    </span>
                    <span className="mt-3 block text-[11px] font-semibold text-accent">
                      {busy === u.email ? "Signing in…" : "Enter delivery console →"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-[10px] border border-bad-line bg-bad-soft px-3 py-2.5 text-[12.5px] text-bad"
            >
              {error}
            </p>
          )}

          <div className="mt-[17px] rounded-[10px] bg-canvas p-[11px] text-[11px] leading-relaxed text-ink-3">
            <b style={{ color: "var(--color-navy)" }}>Leadership prototype:</b> No credentials are
            required. Every figure is illustrative and no production system is connected. Role-based
            access can be previewed inside the workspace.
          </div>
        </div>
      </div>
    </main>
  );
}
