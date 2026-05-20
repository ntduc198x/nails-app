import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MobileAdminViewContext, ObserverScopeInput } from "@nails/shared";
import { resolveMobileAdminViewContext } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

const DEFAULT_OWNER_SCOPE: ObserverScopeInput = { mode: "org" };
type ObserverRuntimeSnapshot = {
  scope: ObserverScopeInput;
  viewContext: MobileAdminViewContext;
};

const runtimeSnapshots = new Map<string, ObserverRuntimeSnapshot>();
const runtimeListeners = new Set<(userId: string, snapshot: ObserverRuntimeSnapshot) => void>();

function getStorageKey(userId: string) {
  return `admin-observer-scope:${userId}`;
}

function emitRuntimeSnapshot(userId: string, snapshot: ObserverRuntimeSnapshot) {
  runtimeSnapshots.set(userId, snapshot);
  for (const listener of runtimeListeners) {
    listener(userId, snapshot);
  }
}

async function readStoredScope(userId: string): Promise<ObserverScopeInput | null> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { mode?: unknown; branchId?: unknown };
    if (parsed.mode === "org") {
      return { mode: "org" };
    }
    if (parsed.mode === "branch" && typeof parsed.branchId === "string" && parsed.branchId.trim()) {
      return { mode: "branch", branchId: parsed.branchId };
    }
  } catch {
    // Ignore invalid local preference payloads.
  }

  return null;
}

async function writeStoredScope(userId: string, scope: ObserverScopeInput) {
  try {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(scope));
  } catch {
    // Ignore local persistence failures and keep the in-memory scope.
  }
}

export function useAdminObserverScope() {
  const { isHydrated, role, user } = useSession();
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewContext, setViewContext] = useState<MobileAdminViewContext | null>(null);
  const [observerScope, setObserverScopeState] = useState<ObserverScopeInput>(DEFAULT_OWNER_SCOPE);

  const resolveScope = useCallback(
    async (requestedScope?: ObserverScopeInput | null) => {
      if (!mobileSupabase || !isHydrated || !user?.id || !role) {
        setViewContext(null);
        setObserverScopeState(DEFAULT_OWNER_SCOPE);
        setIsReady(Boolean(isHydrated));
        return null;
      }

      const preferredScope =
        role === "OWNER"
          ? requestedScope ?? (await readStoredScope(user.id)) ?? DEFAULT_OWNER_SCOPE
          : ({ mode: "branch" } satisfies ObserverScopeInput);

      const nextViewContext = await resolveMobileAdminViewContext(mobileSupabase, preferredScope);
      setViewContext(nextViewContext);
      setObserverScopeState(nextViewContext.observerScope);
      emitRuntimeSnapshot(user.id, {
        scope: nextViewContext.observerScope,
        viewContext: nextViewContext,
      });

      if (role === "OWNER") {
        await writeStoredScope(user.id, nextViewContext.observerScope);
      }

      return nextViewContext;
    },
    [isHydrated, role, user],
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const listener = (nextUserId: string, snapshot: ObserverRuntimeSnapshot) => {
      if (nextUserId !== user.id) {
        return;
      }

      setViewContext(snapshot.viewContext);
      setObserverScopeState(snapshot.scope);
      setIsReady(true);
      setLoading(false);
      setError(null);
    };

    runtimeListeners.add(listener);
    return () => {
      runtimeListeners.delete(listener);
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (user?.id) {
        const snapshot = runtimeSnapshots.get(user.id);
        if (snapshot) {
          setViewContext(snapshot.viewContext);
          setObserverScopeState(snapshot.scope);
          setIsReady(true);
        }
      }

      setLoading(true);
      setError(null);

      try {
        const resolved = await resolveScope();
        if (!cancelled && resolved) {
          setViewContext(resolved);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Khong tai duoc pham vi quan sat.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsReady(true);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [resolveScope, user?.id]);

  const setObserverScope = useCallback(
    async (scope: ObserverScopeInput) => {
      if (role !== "OWNER") {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await resolveScope(scope);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Khong cap nhat duoc pham vi quan sat.");
        throw nextError;
      } finally {
        setLoading(false);
      }
    },
    [resolveScope, role],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await resolveScope(observerScope);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Khong tai duoc pham vi quan sat.");
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [observerScope, resolveScope]);

  return useMemo(
    () => ({
      isReady,
      loading,
      error,
      viewContext,
      observerScope,
      setObserverScope,
      reload,
    }),
    [error, isReady, loading, observerScope, reload, setObserverScope, viewContext],
  );
}
