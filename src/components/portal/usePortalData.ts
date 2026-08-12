"use client";

import { useMemo } from "react";
import { useSession } from "@/state/session";
import { getSnapshot, getUserScope } from "@/lib/api";
import type { EntitySnapshot, PortalUser } from "@/lib/domain/types";

/**
 * Single hook every portal page uses to get its data. Keeping the API call
 * in one place means swapping the mock engine for real services later is a
 * change to `lib/api.ts` and this file, and nothing else.
 */
export function usePortalData(): {
  user: PortalUser | null;
  snapshot: EntitySnapshot | null;
  ready: boolean;
} {
  const { user, entityId, periodId, ready } = useSession();

  const snapshot = useMemo(() => {
    if (!user || !entityId || !periodId) return null;
    return getSnapshot(user, entityId, periodId);
  }, [user, entityId, periodId]);

  return { user, snapshot, ready };
}

export function useUserScope() {
  const { user } = useSession();
  return useMemo(() => (user ? getUserScope(user) : null), [user]);
}
