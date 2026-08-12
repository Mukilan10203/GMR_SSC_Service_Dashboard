"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/state/session";

export default function RootPage() {
  const { user, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? "/overview" : "/login");
  }, [ready, user, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <p className="text-[13px] text-ink-3">Loading the SSC Customer Portal…</p>
    </main>
  );
}
