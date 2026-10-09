import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "settings" }
  | { name: "editor" }
  | { name: "share"; data: string }
  | { name: "view"; data: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "");
  const [, first, ...rest] = path.split("/");
  const data = rest.join("/");
  switch (first) {
    case "settings":
      return { name: "settings" };
    case "new":
      return { name: "editor" };
    case "share":
      return data ? { name: "share", data } : { name: "home" };
    case "b":
      return data ? { name: "view", data } : { name: "home" };
    default:
      return { name: "home" };
  }
}

export function navigate(path: string): void {
  window.location.hash = path;
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
