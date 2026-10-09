import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { BillSnapshot, ItemClaims } from "./bill";

const CLAIM_DEBOUNCE_MS = 300;

export interface LiveBill {
  snapshot: BillSnapshot | null;
  error: string | null;
  notFound: boolean;
  /** False while the live connection is (re)connecting. */
  live: boolean;
  setMyClaims: (claims: ItemClaims) => void;
  replace: (snapshot: BillSnapshot) => void;
}

/**
 * Loads a bill and keeps it updated in real time (Server-Sent Events, or the
 * in-browser store in the demo build).
 * Own claim changes are applied optimistically and sent debounced, so that
 * tapping several items quickly feels instant.
 */
export function useLiveBill(id: string): LiveBill {
  const [serverSnap, setServerSnap] = useState<BillSnapshot | null>(null);
  const [localClaims, setLocalClaims] = useState<ItemClaims | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [live, setLive] = useState(false);
  const pending = useRef<{ timer: number | null; inFlight: number }>({ timer: null, inFlight: 0 });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    setServerSnap(null);
    setNotFound(false);
    setError(null);

    api
      .getBill(id)
      .then((snap) => {
        if (cancelled) return;
        setServerSnap(snap);
        unsubscribe = api.subscribe(id, setServerSnap, setLive);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Die Rechnung konnte nicht geladen werden.");
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [id]);

  const setMyClaims = useCallback(
    (claims: ItemClaims) => {
      setLocalClaims(claims);
      const p = pending.current;
      if (p.timer) window.clearTimeout(p.timer);
      p.timer = window.setTimeout(() => {
        p.timer = null;
        p.inFlight++;
        api
          .setClaims(id, claims)
          .then((snap) => setServerSnap(snap))
          .catch((e: unknown) => setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen."))
          .finally(() => {
            p.inFlight--;
            // Only drop the optimistic state once nothing newer is queued.
            if (p.inFlight === 0 && !p.timer) setLocalClaims(null);
          });
      }, CLAIM_DEBOUNCE_MS);
    },
    [id],
  );

  // Overlay own optimistic claims on top of the server state.
  let snapshot = serverSnap;
  if (snapshot && localClaims && snapshot.me) {
    snapshot = {
      ...snapshot,
      participants: snapshot.participants.map((p) => (p.id === snapshot!.me ? { ...p, claims: localClaims } : p)),
    };
  }

  return { snapshot, error, notFound, live, setMyClaims, replace: setServerSnap };
}
