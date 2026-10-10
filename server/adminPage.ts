import type { DayStats, ErrorEntry } from "./monitor.ts";

/** The operator's overview: receipt recognition per day (calls, tokens, cost) and the latest errors. */

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;
const int = (n: number) => n.toLocaleString("de-DE");

export function adminPage(input: {
  days: DayStats[];
  errors: ErrorEntry[];
  storage: string;
  version: string;
  bills: number;
  backupUrl: string | null;
}): string {
  const month = input.days.filter((d) => d.day.slice(0, 7) === new Date().toISOString().slice(0, 7));
  const sum = (list: DayStats[], key: keyof DayStats) => list.reduce((s, d) => s + (d[key] as number), 0);
  const rows = input.days
    .map(
      (d) => `<tr><td>${d.day}</td><td>${int(d.receipts)}</td><td>${int(d.aiCalls)}</td><td>${int(d.aiFailures)}</td>
        <td>${int(d.inputTokens)}</td><td>${int(d.outputTokens)}</td><td>${usd(d.costUsd)}</td>
        <td>${int(d.serverErrors)}</td><td>${int(d.appErrors)}</td></tr>`,
    )
    .join("");
  const errors = input.errors
    .map(
      (e) => `<li><time>${escape(e.at.replace("T", " ").slice(0, 19))}</time> <b class="${e.source}">${e.source}</b> ${escape(e.message)}
        ${e.detail ? `<details><summary>Details</summary><pre>${escape(e.detail)}</pre></details>` : ""}</li>`,
    )
    .join("");
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>billsplit · Betrieb</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f7f4; --fg: #14201a; --muted: #5d6b63; --line: #d9ded8; --accent: #0f7a4d; --bad: #b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0e1612; --fg: #e8eee9; --muted: #9aa8a0; --line: #2a3530; --accent: #22a86a; --bad: #f97066; } }
  body { margin: 0; padding: 16px; font: 15px/1.45 system-ui, sans-serif; background: var(--bg); color: var(--fg); }
  h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 24px 0 8px; }
  .muted { color: var(--muted); } .tiles { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .tile { border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; min-width: 120px; }
  .tile b { display: block; font-size: 20px; }
  .scroll { overflow-x: auto; } table { border-collapse: collapse; min-width: 640px; }
  th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  ul { list-style: none; padding: 0; margin: 0; } li { padding: 8px 0; border-bottom: 1px solid var(--line); word-break: break-word; }
  time { color: var(--muted); font-variant-numeric: tabular-nums; } b.server, b.ai { color: var(--bad); } b.app { color: var(--accent); }
  pre { white-space: pre-wrap; font-size: 12px; } a { color: var(--accent); }
</style></head><body>
<h1>billsplit · Betrieb</h1>
<p class="muted">Version ${escape(input.version)} · Speicher: ${escape(input.storage)} · ${int(input.bills)} Rechnungen
${input.backupUrl ? ` · <a href="${escape(input.backupUrl)}">Datenbank herunterladen</a>` : ""}</p>
<div class="tiles">
  <div class="tile"><span class="muted">Belege diesen Monat</span><b>${int(sum(month, "receipts"))}</b></div>
  <div class="tile"><span class="muted">KI-Kosten diesen Monat</span><b>${usd(sum(month, "costUsd"))}</b></div>
  <div class="tile"><span class="muted">KI-Fehler diesen Monat</span><b>${int(sum(month, "aiFailures"))}</b></div>
  <div class="tile"><span class="muted">Fehler (Server/App) diesen Monat</span><b>${int(sum(month, "serverErrors"))} / ${int(sum(month, "appErrors"))}</b></div>
</div>
<h2>Pro Tag</h2>
<p class="muted">Kosten geschätzt nach dem Listenpreis des jeweiligen Modells (siehe <code>server/monitor.ts</code>). Ein Beleg kann zwei KI-Aufrufe brauchen (Summenprüfung).</p>
<div class="scroll"><table><thead><tr><th>Tag</th><th>Belege</th><th>KI-Aufrufe</th><th>KI-Fehler</th><th>Tokens ein</th><th>Tokens aus</th><th>Kosten</th><th>Server-Fehler</th><th>App-Fehler</th></tr></thead>
<tbody>${rows || `<tr><td colspan="9" class="muted">Noch keine Daten.</td></tr>`}</tbody></table></div>
<h2>Letzte Fehler</h2>
<ul>${errors || `<li class="muted">Keine.</li>`}</ul>
</body></html>`;
}
