/** The system setting "Bewegung reduzieren" (iOS) / "Animationen entfernen": no demos, no gliding. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Smooth scrolling, unless motion is to be reduced (then it jumps). */
export function scrollBehavior(): ScrollBehavior {
  return reducedMotion() ? "auto" : "smooth";
}
