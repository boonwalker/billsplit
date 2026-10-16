import path from "node:path";

type Env = Record<string, string | undefined>;

/** Where the data lives: DATA_DIR, else the volume Railway mounts, else ./data. */
export function dataDir(env: Env, root: string): string {
  return path.resolve(root, env.DATA_DIR || env.RAILWAY_VOLUME_MOUNT_PATH || "data");
}

/**
 * On Railway every deploy starts a fresh container: data outside the volume is gone afterwards
 * (bills, accounts, push keys – it happened with DATA_DIR=data on 16.10.2026). Returns why the
 * server must not start, or null when the data lives on the volume (or not on Railway at all).
 * Not starting keeps the previous deployment running, as its health check never passes.
 */
export function ephemeralDataProblem(env: Env, dir: string): string | null {
  if (!env.RAILWAY_ENVIRONMENT) return null;
  const volume = env.RAILWAY_VOLUME_MOUNT_PATH;
  if (!volume) return "Am Service hängt kein Volume – die Daten wären beim nächsten Deploy weg. Volume anlegen (Mount-Pfad z. B. /data).";
  const inside = path.relative(path.resolve(volume), dir);
  if (inside.startsWith("..") || path.isAbsolute(inside)) {
    return `Der Datenordner ${dir} liegt nicht auf dem Volume (${volume}) – die Daten wären beim nächsten Deploy weg. Variable DATA_DIR löschen oder auf das Volume zeigen lassen.`;
  }
  return null;
}
