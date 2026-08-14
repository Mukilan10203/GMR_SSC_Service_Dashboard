"use client";

import { useEffect } from "react";
import Link from "next/link";
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

  // An SSC account in here is previewing a customer's own portal, so it says
  // so — and offers the way back to the console.
  if (user.kind === "ssc") {
    return (
      <>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent px-5 py-2 text-center text-[12px] font-medium text-white">
          <span>You are viewing this customer&rsquo;s own portal as {user.name}.</span>
          <Link href="/ssc" className="font-bold underline underline-offset-2">
            Back to the delivery console
          </Link>
        </div>
        <PortalShell>{children}</PortalShell>
      </>
    );
  }

  return <PortalShell>{children}</PortalShell>;
}
