import { useEffect, useState } from "react";
import { DEMO } from "./demo";

export type Route =
  | { name: "home" }
  | { name: "profile"; next?: string }
  /** Signing in with the e-mail account. */
  | { name: "signin" }
  /** A single expense entered by hand ("Ausgabe zuweisen"). */
  | { name: "expense" }
  | { name: "new" }
  | { name: "scan" }
  /** transfer: a settlement payment to bring into view (from a notification). */
  | { name: "dashboard"; transfer?: string }
  | { name: "device"; code: string }
  /** At the new address: take over the old address's data, then on to `target` (see move.ts). */
  | { name: "move"; code: string; target?: string; app: boolean }
  /**
   * focus: a participant whose place on the bill to show (the payer's list of friends, or the
   * friend's own share) · back: where "Zurück" leads (e.g. "dashboard" when opened from a list).
   */
  | { name: "bill"; id: string; focus?: string; back?: string; recipient?: string }
  | { name: "original"; id: string }
  | { name: "edit"; id: string }
  /** Restaurant mode for the staff: the tables as a traffic-light board, or their QR codes to print. */
  | { name: "restaurant"; qr: boolean }
  /** A table's QR code while no bill is open there (the guest waits for it). */
  | { name: "table"; id: string }
  /** Privacy policy and imprint (pages/Legal). */
  | { name: "privacy" }
  | { name: "imprint" };

export function parseHash(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const [, first, second, third] = path.split("/");
  switch (first) {
    case "profile":
      return { name: "profile", next: params.get("next") ?? undefined };
    case "new":
      return { name: "new" };
    case "anmelden":
      return { name: "signin" };
    case "ausgabe":
      return { name: "expense" };
    case "datenschutz":
      return { name: "privacy" };
    case "restaurant":
      return { name: "restaurant", qr: second === "qr" };
    case "tisch":
      return second ? { name: "table", id: second } : { name: "home" };
    case "impressum":
      return { name: "imprint" };
    case "scan":
      return { name: "scan" };
    case "dashboard":
      return { name: "dashboard", transfer: params.get("zahlung") ?? undefined };
    case "umzug":
      return second ? { name: "move", code: second, target: params.get("ziel") ?? undefined, app: params.get("app") === "1" } : { name: "home" };
    case "geraet":
      return second ? { name: "device", code: second } : { name: "home" };
    case "b":
      if (!second) return { name: "home" };
      if (third === "edit") return { name: "edit", id: second };
      if (third === "beleg") return { name: "original", id: second };
      return { name: "bill", id: second, focus: params.get("an") ?? undefined, back: params.get("zurueck") ?? undefined, recipient: params.get("fuer") ?? undefined };
    default:
      return { name: "home" };
  }
}

/**
 * Shared bill links are real paths (`/b/<id>?to=…`, see billUrl) so that link previews can show
 * the bill; the app itself routes by hash: `/b/abc?to=x` becomes `/#/b/abc?to=x` before it starts.
 */
export function openPathLink(): void {
  if (DEMO || window.location.hash.length > 1) return;
  const { pathname, search } = window.location;
  if (!/^\/b\/[A-Za-z0-9_-]{6,40}\/?$/.test(pathname)) return;
  history.replaceState(null, "", `/#${pathname.replace(/\/$/, "")}${search}`);
}

/**
 * The demo is served inside a sandboxed frame where the URL hash cannot be
 * relied on, so it keeps the current route in memory instead.
 */
let memoryPath = "/";
const ROUTE_EVENT = "billsplit:route";

function currentHash(): string {
  return DEMO ? `#${memoryPath}` : window.location.hash;
}

export function navigate(path: string, { replace = false } = {}): void {
  if (DEMO) {
    memoryPath = path;
    window.dispatchEvent(new Event(ROUTE_EVENT));
  } else if (replace) {
    history.replaceState(null, "", `#${path}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = path;
  }
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(currentHash()));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(currentHash()));
    window.addEventListener("hashchange", onChange);
    window.addEventListener(ROUTE_EVENT, onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener(ROUTE_EVENT, onChange);
    };
  }, []);
  return route;
}

/** Path to a bill that opens at a participant's place, with "Zurück" leading to `back`. */
export function billPath(id: string, focus?: string, back?: string): string {
  const params = new URLSearchParams();
  if (focus) params.set("an", focus);
  if (back) params.set("zurueck", back);
  const query = params.toString();
  return `/b/${id}${query ? `?${query}` : ""}`;
}

