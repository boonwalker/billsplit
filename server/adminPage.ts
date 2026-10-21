import type { BillSummary } from "../src/lib/billCore.ts";
import type { DayStats, ErrorEntry } from "./monitor.ts";
import type { DeviceInfo, VisitDay } from "./visits.ts";

/**
 * The operator's overview (/api/admin?token=ADMIN_TOKEN): who uses klicksplit (visits, devices,
 * accounts), what happens (bills, joins, payments), the receipt recognition per day (calls,
 * tokens, cost) and the latest errors. People are known by their participant id; names come
 * from the bills they joined, e-mail addresses from their account.
 */

export interface AdminInput {
  days: DayStats[];
  errors: ErrorEntry[];
  storage: string;
  version: string;
  backupUrl: string | null;
  visitDays: VisitDay[];
  devices: (DeviceInfo & { id: string })[];
  active: { day: number; week: number; month: number };
  /** Participant ids with the app open right now. */
  online: Set<string>;
  accounts: { email: string; name: string; createdAt: string; id: string }[];
  bills: BillSummary[];
  pushSubscribers: number;
  isPushed: (participantId: string) => boolean;
  /** The admin token, for the forms that change accounts (sent with each of them). */
  token?: string;
  /** What the last change on this page did (shown at the top). */
  notice?: string | null;
  now?: Date;
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;
const int = (n: number) => n.toLocaleString("de-DE");
const money = (cents: number, currency: string) => new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
/** "16.10.26, 14:05" in German time. */
const when = (iso: string) =>
  iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–";
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : "–");

export function adminPage(input: AdminInput): string {
  const now = input.now ?? new Date();
  const thisMonth = dayOf(now.toISOString()).slice(0, 7);
  const sum = <T>(list: T[], value: (item: T) => number) => list.reduce((s, x) => s + value(x), 0);

  // Who is who: the newest name a participant used in a bill, the account's name before that.
  const names = new Map<string, { name: string; at: string }>();
  const role = new Map<string, { owner: number; guest: number }>();
  for (const bill of input.bills) {
    for (const p of bill.participants) {
      const known = names.get(p.id);
      if (p.name.trim() && (!known || p.joinedAt > known.at)) names.set(p.id, { name: p.name.trim(), at: p.joinedAt });
      const r = role.get(p.id) ?? { owner: 0, guest: 0 };
      if (p.id === bill.ownerId) r.owner++;
      else r.guest++;
      role.set(p.id, r);
    }
  }
  const emailOf = new Map(input.accounts.map((a) => [a.id, a.email]));
  const nameOf = (id: string) => input.accounts.find((a) => a.id === id && a.name.trim())?.name.trim() ?? names.get(id)?.name ?? "–";
  const billsOf = (id: string) => {
    const r = role.get(id);
    return r ? `${int(r.owner)} / ${int(r.guest)}` : "–";
  };
  const deviceOf = new Map(input.devices.map((d) => [d.id, d]));
  const dot = (id: string) => (input.online.has(id) ? `<span class="dot" title="gerade online"></span>` : "");
  const yes = (on: boolean) => (on ? "✓" : "–");

  // Usage per day: visits from the app, bills and joins from the data.
  const created = new Map<string, number>();
  const joins = new Map<string, number>();
  const volume = new Map<string, number>();
  for (const bill of input.bills) {
    const day = dayOf(bill.createdAt);
    created.set(day, (created.get(day) ?? 0) + 1);
    if (bill.currency === "EUR") volume.set(day, (volume.get(day) ?? 0) + bill.total);
    for (const p of bill.participants) {
      if (p.id === bill.ownerId) continue;
      const joined = dayOf(p.joinedAt);
      joins.set(joined, (joins.get(joined) ?? 0) + 1);
    }
  }
  const visitsByDay = new Map(input.visitDays.map((d) => [d.day, d]));
  const usageDays = [...new Set([...visitsByDay.keys(), ...created.keys()])].sort().reverse().slice(0, 60);
  const usageRows = usageDays
    .map((day) => {
      const v = visitsByDay.get(day);
      return `<tr><td>${day}</td><td>${int(v?.visits ?? 0)}</td><td>${int(v?.devices ?? 0)}</td><td>${int(v?.newDevices ?? 0)}</td>
        <td>${pct(v?.appVisits ?? 0, v?.visits ?? 0)}</td><td>${int(created.get(day) ?? 0)}</td><td>${int(joins.get(day) ?? 0)}</td>
        <td>${money(volume.get(day) ?? 0, "EUR")}</td></tr>`;
    })
    .join("");

  const monthBills = input.bills.filter((b) => dayOf(b.createdAt).startsWith(thisMonth));
  const monthDays = input.days.filter((d) => d.day.startsWith(thisMonth));
  const guests = sum(input.bills, (b) => b.participants.length - 1);
  const paidGuests = sum(input.bills, (b) => b.participants.filter((p) => p.id !== b.ownerId && p.paid).length);

  // Changing an account: a small form per action, the token and the address go along.
  const form = (email: string, action: string, label: string, confirm: boolean, danger = false) => `<form method="post" action="/api/admin/account">
      <input type="hidden" name="token" value="${escape(input.token ?? "")}"><input type="hidden" name="email" value="${escape(email)}"><input type="hidden" name="action" value="${action}">
      ${confirm ? `<input name="confirm" placeholder="${escape(email)}" aria-label="E-Mail zur Bestätigung" autocomplete="off" required>` : ""}
      <button${danger ? ' class="danger"' : ""}>${label}</button></form>`;
  const manage = (email: string) => `<details class="manage"><summary>Verwalten</summary>
      <p class="muted">Zurücksetzen: Name und Zahlungsdaten im Konto vergessen – ein neues Gerät startet ohne sie.</p>
      ${form(email, "reset", "Profil zurücksetzen", false)}
      <p class="muted">Löschen: Verbindung von Adresse und Gerät lösen; Rechnungen bleiben, die Adresse ist wieder frei. Zur Bestätigung die Adresse abtippen.</p>
      ${form(email, "delete", "Konto löschen", true)}
      <p class="muted">Alle Daten löschen (Löschanfrage): Konto weg, Name in allen Rechnungen „Gelöscht“, Zahlungsdaten und Belegfotos eigener Rechnungen weg; Beträge bleiben. Nicht rückgängig zu machen.</p>
      ${form(email, "erase", "Alle Daten löschen", true, true)}</details>`;
  const accountRows = input.accounts
    .map((a) => {
      const d = deviceOf.get(a.id);
      return `<tr><td>${dot(a.id)}${escape(a.email)}</td><td class="left">${escape(nameOf(a.id))}</td><td>${when(a.createdAt)}</td><td>${when(d?.lastSeen ?? "")}</td>
        <td>${billsOf(a.id)}</td><td>${d ? (d.app ? "App" : "Browser") : "–"}</td><td>${yes(input.isPushed(a.id))}</td><td class="left">${input.token ? manage(a.email) : ""}</td></tr>`;
    })
    .join("");

  const deviceRows = input.devices
    .slice(0, 150)
    .map(
      (d) => `<tr><td>${dot(d.id)}${escape(nameOf(d.id))}</td><td class="left">${escape(emailOf.get(d.id) ?? "–")}</td><td>${when(d.firstSeen)}</td><td>${when(d.lastSeen)}</td>
        <td>${int(d.visits)}</td><td>${d.app ? "App" : "Browser"}</td><td>${escape(d.lang ?? "–")}</td><td>${billsOf(d.id)}</td><td>${yes(input.isPushed(d.id))}</td></tr>`,
    )
    .join("");

  const billRows = [...input.bills]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 60)
    .map((b) => {
      const others = b.participants.filter((p) => p.id !== b.ownerId);
      return `<tr><td>${when(b.createdAt)}</td><td class="left">${escape(b.title || "Rechnung")}</td><td class="left">${escape(nameOf(b.ownerId))}</td>
        <td>${int(others.length)}</td><td>${int(others.filter((p) => p.paid).length)} / ${int(others.length)}</td><td>${money(b.total, b.currency)}</td></tr>`;
    })
    .join("");

  const aiRows = input.days
    .map(
      (d) => `<tr><td>${d.day}</td><td>${int(d.receipts)}</td><td>${int(d.aiCalls)}</td><td>${int(d.aiFailures)}</td>
        <td>${int(d.inputTokens)}</td><td>${int(d.outputTokens)}</td><td>${usd(d.costUsd)}</td>
        <td>${int(d.serverErrors)}</td><td>${int(d.appErrors)}</td></tr>`,
    )
    .join("");
  const errors = input.errors
    .map(
      (e) => `<li><time>${escape(when(e.at))}</time> <b class="${e.source}">${e.source}</b> ${escape(e.message)}
        ${e.detail ? `<details><summary>Details</summary><pre>${escape(e.detail)}</pre></details>` : ""}</li>`,
    )
    .join("");
  const empty = (cols: number) => `<tr><td colspan="${cols}" class="muted">Noch keine Daten.</td></tr>`;

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>klicksplit · Betrieb</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f7f4; --fg: #14201a; --muted: #5d6b63; --line: #d9ded8; --accent: #0f7a4d; --bad: #b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0e1612; --fg: #e8eee9; --muted: #9aa8a0; --line: #2a3530; --accent: #22a86a; --bad: #f97066; } }
  body { margin: 0; padding: 16px; font: 15px/1.45 system-ui, sans-serif; background: var(--bg); color: var(--fg); }
  h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 8px; }
  nav { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 10px 0 4px; font-size: 14px; }
  .muted { color: var(--muted); } .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 12px; }
  .tile { border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; }
  .tile b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; } .tile small { color: var(--muted); }
  .scroll { overflow-x: auto; } table { border-collapse: collapse; min-width: 640px; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
  th { font-size: 13px; color: var(--muted); font-weight: 600; }
  th:first-child, td:first-child { text-align: left; } td.left, th.left { text-align: left; }
  ul { list-style: none; padding: 0; margin: 0; } li { padding: 8px 0; border-bottom: 1px solid var(--line); word-break: break-word; }
  time { color: var(--muted); font-variant-numeric: tabular-nums; } b.server, b.ai { color: var(--bad); } b.app { color: var(--accent); }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); margin-right: 6px; vertical-align: middle; }
  pre { white-space: pre-wrap; font-size: 12px; } a { color: var(--accent); }
  .notice { margin: 12px 0 0; padding: 10px 14px; border: 1px solid var(--accent); border-radius: 12px; }
  tr:has(details.manage[open]) td { vertical-align: top; }
  details.manage summary { cursor: pointer; color: var(--accent); }
  details.manage[open] { white-space: normal; min-width: 280px; max-width: 360px; }
  details.manage p { margin: 10px 0 4px; font-size: 13px; }
  details.manage form { display: flex; gap: 6px; }
  details.manage input, details.manage button { font: inherit; font-size: 14px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: inherit; }
  details.manage input { flex: 1; min-width: 0; }
  details.manage button { border-color: var(--accent); color: var(--accent); cursor: pointer; }
  details.manage button.danger { border-color: var(--bad); background: var(--bad); color: #fff; }
</style></head><body>
<h1>klicksplit · Betrieb</h1>
<p class="muted">Stand ${escape(when(now.toISOString()))} · Version ${escape(input.version)} · Speicher: ${escape(input.storage)}
${input.backupUrl ? ` · <a href="${escape(input.backupUrl)}">Datenbank herunterladen</a>` : ""}</p>
${input.notice ? `<p class="notice" role="status">${escape(input.notice)}</p>` : ""}
<nav><a href="#nutzung">Nutzung</a><a href="#konten">Konten</a><a href="#geraete">Geräte</a><a href="#rechnungen">Rechnungen</a><a href="#ki">Belegerkennung</a><a href="#fehler">Fehler</a></nav>
<div class="tiles">
  <div class="tile"><span class="muted">Gerade online</span><b>${int(input.online.size)}</b><small>App offen</small></div>
  <div class="tile"><span class="muted">Aktiv (24 h)</span><b>${int(input.active.day)}</b><small>7 Tage: ${int(input.active.week)} · 30 Tage: ${int(input.active.month)}</small></div>
  <div class="tile"><span class="muted">Geräte gesamt</span><b>${int(input.devices.length)}</b><small>${int(input.devices.filter((d) => d.app).length)} mit Home-Bildschirm-App</small></div>
  <div class="tile"><span class="muted">Konten</span><b>${int(input.accounts.length)}</b><small>${int(input.pushSubscribers)} mit Mitteilungen</small></div>
  <div class="tile"><span class="muted">Rechnungen</span><b>${int(input.bills.length)}</b><small>${int(monthBills.length)} diesen Monat</small></div>
  <div class="tile"><span class="muted">Beigetreten</span><b>${int(guests)}</b><small>${pct(paidGuests, guests)} haben bezahlt</small></div>
  <div class="tile"><span class="muted">Abgerechnet diesen Monat</span><b>${money(sum(monthBills.filter((b) => b.currency === "EUR"), (b) => b.total), "EUR")}</b><small>Rechnungen in Euro</small></div>
  <div class="tile"><span class="muted">KI diesen Monat</span><b>${usd(sum(monthDays, (d) => d.costUsd))}</b><small>${int(sum(monthDays, (d) => d.receipts))} Belege</small></div>
  <div class="tile"><span class="muted">Fehler diesen Monat</span><b>${int(sum(monthDays, (d) => d.serverErrors + d.appErrors + d.aiFailures))}</b><small>Server ${int(sum(monthDays, (d) => d.serverErrors))} · App ${int(sum(monthDays, (d) => d.appErrors))} · KI ${int(sum(monthDays, (d) => d.aiFailures))}</small></div>
</div>

<h2 id="nutzung">Nutzung pro Tag</h2>
<p class="muted">Ein Besuch = App geöffnet oder nach mindestens 30 Minuten wieder geöffnet. Geräte = verschiedene Geräte an dem Tag, neu = zum ersten Mal gesehen. Besuche werden seit 16.10.2026 gezählt.</p>
<div class="scroll"><table><thead><tr><th>Tag</th><th>Besuche</th><th>Geräte</th><th>davon neu</th><th>in der App</th><th>neue Rechnungen</th><th>Beitritte</th><th>Betrag (EUR)</th></tr></thead>
<tbody>${usageRows || empty(8)}</tbody></table></div>

<h2 id="konten">Konten (${int(input.accounts.length)})</h2>
<p class="muted">Rechnungen: als Rechnungssteller / als Gast. <span class="dot"></span>= gerade online.</p>
<div class="scroll"><table><thead><tr><th>E-Mail</th><th class="left">Name</th><th>angelegt</th><th>zuletzt aktiv</th><th>Rechnungen</th><th>genutzt als</th><th>Mitteilungen</th><th class="left">Konto</th></tr></thead>
<tbody>${accountRows || empty(8)}</tbody></table></div>

<h2 id="geraete">Geräte (${int(input.devices.length)})</h2>
<p class="muted">Die zuletzt aktiven 150. Name aus den Rechnungen bzw. dem Konto; ein Gerät ohne Konto bleibt anonym bis auf diesen Namen.</p>
<div class="scroll"><table><thead><tr><th>Name</th><th class="left">Konto</th><th>zuerst</th><th>zuletzt</th><th>Besuche</th><th>genutzt als</th><th>Sprache</th><th>Rechnungen</th><th>Mitteilungen</th></tr></thead>
<tbody>${deviceRows || empty(9)}</tbody></table></div>

<h2 id="rechnungen">Neueste Rechnungen (${int(input.bills.length)} insgesamt)</h2>
<div class="scroll"><table><thead><tr><th>angelegt</th><th class="left">Titel</th><th class="left">Rechnungssteller</th><th>Gäste</th><th>bezahlt</th><th>Betrag</th></tr></thead>
<tbody>${billRows || empty(6)}</tbody></table></div>

<h2 id="ki">Belegerkennung pro Tag</h2>
<p class="muted">Kosten geschätzt nach dem Listenpreis des jeweiligen Modells (siehe <code>server/monitor.ts</code>). Ein Beleg kann zwei KI-Aufrufe brauchen (Summenprüfung).</p>
<div class="scroll"><table><thead><tr><th>Tag</th><th>Belege</th><th>KI-Aufrufe</th><th>KI-Fehler</th><th>Tokens ein</th><th>Tokens aus</th><th>Kosten</th><th>Server-Fehler</th><th>App-Fehler</th></tr></thead>
<tbody>${aiRows || empty(9)}</tbody></table></div>

<h2 id="fehler">Letzte Fehler</h2>
<ul>${errors || `<li class="muted">Keine.</li>`}</ul>
</body></html>`;
}

/** Asks for the token (also offered by the password manager); `wrong` after a token that did not fit. */
export function adminLogin(wrong: boolean): string {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>klicksplit · Betrieb</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f7f4; --fg: #14201a; --muted: #5d6b63; --line: #d9ded8; --accent: #0f7a4d; --bad: #b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0e1612; --fg: #e8eee9; --muted: #9aa8a0; --line: #2a3530; --accent: #22a86a; --bad: #f97066; } }
  body { margin: 0; padding: 24px 16px; font: 16px/1.45 system-ui, sans-serif; background: var(--bg); color: var(--fg); }
  form { max-width: 360px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
  h1 { font-size: 20px; margin: 0; } p { margin: 0; } .muted { color: var(--muted); font-size: 14px; } .bad { color: var(--bad); }
  input, button { font: inherit; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: transparent; color: inherit; }
  button { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
</style></head><body>
<form method="get" action="/api/admin">
  <h1>klicksplit · Betrieb</h1>
  ${wrong ? `<p class="bad">Der Token passt nicht. Er muss genau dem Wert von ADMIN_TOKEN in Railway entsprechen (mindestens 12 Zeichen).</p>` : ""}
  <input type="text" name="username" value="klicksplit-admin" autocomplete="username" hidden>
  <input type="password" name="token" placeholder="Admin-Token" autocomplete="current-password" required autofocus aria-label="Admin-Token">
  <button type="submit">Öffnen</button>
  <p class="muted">Der Token ist der Wert der Variable ADMIN_TOKEN in Railway.</p>
</form>
</body></html>`;
}
