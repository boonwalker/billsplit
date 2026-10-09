import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "profile"; next?: string }
  | { name: "new" }
  | { name: "scan" }
  | { name: "bill"; id: string }
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
      return third === "edit" ? { name: "edit", id: second } : { name: "bill", id: second };
    default:
      return { name: "home" };
  }
}

export function navigate(path: string, { replace = false } = {}): void {
  if (replace) {
    history.replaceState(null, "", `#${path}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = path;
  }
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
