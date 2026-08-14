"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import { SscShell } from "@/components/ssc/SscShell";

/**
 * Auth gate for the delivery console. Only SSC accounts belong here — a
 * customer who lands on this URL is sent back to their own portal, not
 * shown an error, because the console is not something they are meant to
 * know exists.
 */
export default function SscLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.kind !== "ssc") router.replace("/overview");
  }, [ready, user, router]);

  if (!ready || !user || user.kind !== "ssc") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-[13px] text-ink-3">Loading the delivery console…</p>
      </div>
    );
  }

  return <SscShell>{children}</SscShell>;
}
