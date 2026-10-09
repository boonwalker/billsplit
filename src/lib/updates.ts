import { DEMO } from "./demo";

/**
 * A home-screen app can stay open for days and keep running old code after a new
 * version went live – which then misreads data the new server sends. The app
 * remembers the server version it started with and reloads once it changes.
 */
let startedWith: string | null = null;

export async function checkForUpdate(): Promise<void> {
  if (DEMO) return;
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const { version } = (await res.json()) as { version?: string };
    if (!version) return;
    if (startedWith === null) startedWith = version;
    else if (version !== startedWith) window.location.reload();
  } catch {
    // offline or server restarting – try again next time
  }
}

/** Checks on start and whenever the app comes back to the foreground. */
export function watchForUpdates(): void {
  if (DEMO) return;
  void checkForUpdate();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  });
}
