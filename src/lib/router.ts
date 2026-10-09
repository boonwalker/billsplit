import { useEffect, useState } from "react";
import { DEMO } from "./demo";

export type Route =
  | { name: "home" }
  | { name: "profile"; next?: string }
  | { name: "new" }
  | { name: "scan" }
  | { name: "bill"; id: string }
  | { name: "original"; id: string }
  | { name: "edit"; id: string };

export function parseHash(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const [, first, second, third] = path.split("/");
  switch (first) {
    case "profile":
      return { name: "profile", next: params.get("next") ?? undefined };
    case "new":
      return { name: "new" };
    case "scan":
      return { name: "scan" };
    case "b":
      if (!second) return { name: "home" };
      if (third === "edit") return { name: "edit", id: second };
      if (third === "beleg") return { name: "original", id: second };
      return { name: "bill", id: second };
    default:
      return { name: "home" };
  }
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
