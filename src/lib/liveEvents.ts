import { useEffect } from "react";
import { api } from "./api";

/**
 * The app's one event stream to the server. It stays open while the app is in the foreground:
 * that is what makes this device count as online for everyone in its bills ("LIVE · 3"), and
 * it reports changes in any of the bills, so screens like the dashboard stay up to date.
 */
const listeners = new Set<(billId: string) => void>();

/** Keeps the stream open while the app is visible (call once, in the app shell). */
export function useAppEvents(): void {
  useEffect(() => {
    let close: (() => void) | null = null;
    const update = () => {
      if (document.visibilityState === "visible") {
        close ??= api.subscribeEvents((billId) => listeners.forEach((fn) => fn(billId)));
      } else {
        close?.();
        close = null;
      }
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      close?.();
    };
  }, []);
}

/** Calls `fn` whenever one of this device's bills changed (amounts, ticks, payments). */
export function useBillChanges(fn: (billId: string) => void): void {
  useEffect(() => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, [fn]);
}
