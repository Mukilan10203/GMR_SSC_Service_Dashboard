"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PortalUser } from "@/lib/domain/types";
import { authenticate, findUserById, getUserScope } from "@/lib/api";

/**
 * Simulated session. Scope (which entity and which financial year the user
 * is looking at) lives here alongside identity, because in this product they
 * are the same concern: what the user is allowed to see, and which slice of
 * it they have chosen.
 */

const STORAGE_KEY = "ssc-portal-session";

interface PersistedSession {
  userId: string;
  entityId: string;
  periodId: string;
}

interface SessionValue {
  user: PortalUser | null;
  entityId: string;
  periodId: string;
  /** Fiscal month being viewed, or null for "the latest closed month". */
  monthIndex: number | null;
  /** False until localStorage has been read — avoids a hydration flash. */
  ready: boolean;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  setEntity: (entityId: string) => void;
  setPeriod: (periodId: string) => void;
  setMonthIndex: (monthIndex: number | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [entityId, setEntityId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [monthIndex, setMonthIndex] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession;
        const restored = findUserById(parsed.userId);
        if (restored) {
          const scope = getUserScope(restored);
          setUser(restored);
          setEntityId(
            restored.entityIds.includes(parsed.entityId) ? parsed.entityId : scope.defaultEntityId,
          );
          setPeriodId(
            scope.periods.some((p) => p.id === parsed.periodId)
              ? parsed.periodId
              : scope.defaultPeriodId,
          );
        }
      }
    } catch {
      // A corrupt or unavailable store simply means "not signed in".
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: PersistedSession | null) => {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage being unavailable must not break the session.
    }
  }, []);

  const login = useCallback(
    (email: string, password: string) => {
      const result = authenticate(email, password);
      if (!result.ok) return { ok: false as const, error: result.error };

      const scope = getUserScope(result.user);
      setUser(result.user);
      setEntityId(scope.defaultEntityId);
      setPeriodId(scope.defaultPeriodId);
      persist({
        userId: result.user.id,
        entityId: scope.defaultEntityId,
        periodId: scope.defaultPeriodId,
      });
      return { ok: true as const };
    },
    [persist],
  );

  const logout = useCallback(() => {
    setUser(null);
    setEntityId("");
    setPeriodId("");
    persist(null);
  }, [persist]);

  const setEntity = useCallback(
    (next: string) => {
      setEntityId(next);
      if (user) persist({ userId: user.id, entityId: next, periodId });
    },
    [persist, periodId, user],
  );

  const setPeriod = useCallback(
    (next: string) => {
      setPeriodId(next);
      // A month index means a different month in a different year, so a year
      // change returns the view to that year's latest close.
      setMonthIndex(null);
      if (user) persist({ userId: user.id, entityId, periodId: next });
    },
    [persist, entityId, user],
  );

  const value = useMemo<SessionValue>(
    () => ({
      user,
      entityId,
      periodId,
      monthIndex,
      ready,
      login,
      logout,
      setEntity,
      setPeriod,
      setMonthIndex,
    }),
    [user, entityId, periodId, monthIndex, ready, login, logout, setEntity, setPeriod],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
