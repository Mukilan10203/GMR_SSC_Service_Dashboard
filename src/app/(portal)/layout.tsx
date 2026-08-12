"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { PortalShell } from "@/components/portal/PortalShell";

/**
 * Auth gate for the whole portal. Simulated: a missing session simply sends
 * the visitor back to sign-in. In production this becomes a server-side
 * session check with the route rendered on the server.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-[13px] text-ink-3">Loading your portal…</p>
      </div>
    );
  }

  return <PortalShell>{children}</PortalShell>;
}
