import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Header from "../components/Header";
import QrCode from "../components/QrCode";
import { api } from "../lib/api";
import type { BillSnapshot, Venue, VenueTable } from "../lib/bill";
import { rich, t } from "../lib/i18n";
import { useBillChanges } from "../lib/liveEvents";
import { formatMoney } from "../lib/money";
import { setPendingTable, tableLight, tableUrl, type Light } from "../lib/restaurant";
import { navigate } from "../lib/router";
import { clearDraft, loadProfile, saveProfile } from "../lib/storage";
import { setPendingPhoto } from "./Editor";

const LIGHT_LABEL: Record<Light, () => string> = {
  free: () => t("frei"),
  red: () => t("offen"),
  yellow: () => t("teilweise bezahlt"),
  green: () => t("bezahlt"),
};

/** A new restaurant: its name and how many tables (each gets a QR code of its own). */
function CreateVenue({ onCreated }: { onCreated: (venue: Venue) => void }) {
  const [name, setName] = useState(() => loadProfile().name.trim());
  const [tables, setTables] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const venue = await api.createVenue(name.trim(), tables);
      // Guests see the restaurant as the one who paid ("bezahlt von …").
      if (!loadProfile().name.trim()) saveProfile({ ...loadProfile(), name: name.trim() });
      onCreated(venue);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Das hat nicht geklappt."));
      setBusy(false);
    }
  }

  return (
    <form className="card restaurant-setup" onSubmit={submit}>
      <h2>{t("Dein Restaurant bei klicksplit")}</h2>
      <p className="muted">
        {t("Jeder Tisch bekommt einen eigenen QR-Code. Gäste scannen ihn, haken ab, was sie hatten, und begleichen ihren Anteil – Du siehst hier auf einen Blick, welcher Tisch bezahlt ist.")}
      </p>
      <label className="field">
        <span>{t("Name des Restaurants")}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("z.B. Brauhaus am Dom")} />
      </label>
      <label className="field">
        <span>{t("Wie viele Tische?")}</span>
        <input type="number" inputMode="numeric" min={1} max={80} value={tables} onChange={(e) => setTables(Math.max(1, Math.min(80, Number(e.target.value) || 1)))} />
      </label>
      {error && <p className="alert">{error}</p>}
      <button className="btn btn-primary btn-large" disabled={busy || !name.trim()}>
        {t("Restaurant anlegen")}
      </button>
    </form>
  );
}

/** One table on the traffic-light board. */
function TableCard({ table, snapshot, onChanged }: { table: VenueTable; snapshot: BillSnapshot | null | undefined; onChanged: () => void }) {
  const open = table.billId && snapshot !== null;
  const { light, missing, received, guests } = tableLight(open ? snapshot : null);
  const currency = snapshot?.data.currency ?? "EUR";
  const [confirm, setConfirm] = useState(false);

  function startBill(photo?: File) {
    clearDraft();
    setPendingTable(table.id);
    if (photo) setPendingPhoto(photo);
    navigate("/new");
  }

  async function free() {
    await api.setTableBill(table.id, null).catch(() => undefined);
    setConfirm(false);
    onChanged();
  }

  return (
    <li className={`table-card light-${light}`}>
      <div className="table-card-head">
        <b>{table.name}</b>
        <span className="table-light">
          <i aria-hidden="true" />
          {LIGHT_LABEL[light]()}
        </span>
      </div>
      {open && snapshot ? (
        <>
          <p className="table-amount">
            {light === "green"
              ? t("{amount} bezahlt", { amount: formatMoney(received, currency) })
              : t("noch {amount} offen", { amount: formatMoney(missing, currency) })}
          </p>
          <p className="muted small">
            {guests === 1 ? t("1 Gast") : t("{count} Gäste", { count: guests })}
            {light === "yellow" && ` · ${t("{amount} bezahlt", { amount: formatMoney(received, currency) })}`}
          </p>
          {confirm ? (
            <div className="table-actions">
              <p className="small">{t("Noch {amount} offen – Tisch trotzdem freigeben?", { amount: formatMoney(missing, currency) })}</p>
              <button type="button" className="btn btn-small" onClick={() => void free()}>
                {t("Freigeben")}
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirm(false)}>
                {t("Abbrechen")}
              </button>
            </div>
          ) : (
            <div className="table-actions">
              <button type="button" className="btn btn-small" onClick={() => navigate(`/b/${table.billId}?zurueck=restaurant`)}>
                {t("Rechnung öffnen")}
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => (light === "green" ? void free() : setConfirm(true))}>
                {t("Tisch freigeben")}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="table-actions">
          <label className="btn btn-primary btn-small">
            {t("Kassenbon fotografieren")}
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && startBill(e.target.files[0])} />
          </label>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => startBill()}>
            {t("Eintippen")}
          </button>
        </div>
      )}
    </li>
  );
}

/** QR codes to print, one per table (table stands, stickers). */
function QrSheet({ venue }: { venue: Venue }) {
  return (
    <div className="qr-sheet">
      <div className="qr-sheet-bar">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          {t("Drucken")}
        </button>
      </div>
      <ul className="qr-sheet-grid">
        {venue.tables.map((table) => (
          <li key={table.id} className="qr-sheet-card">
            <b>{venue.name}</b>
            <span>{table.name}</span>
            <QrCode value={tableUrl(table.id)} label={t("QR-Code für {table}", { table: table.name })} />
            <small>{rich(t("Scannen, abhaken, <b>Anteil begleichen</b>"))}</small>
            <small className="muted">klicksplit.de</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Restaurant mode for the staff: the tables as a traffic-light board (red = nothing paid,
 * yellow = partly, green = paid), a bill opened at a table from the receipt, the tables' QR codes.
 */
export default function Restaurant({ qr = false }: { qr?: boolean }) {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [snaps, setSnaps] = useState<Record<string, BillSnapshot | null>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.venues();
      setVenues(list);
      const ids = list.flatMap((v) => v.tables.map((tb) => tb.billId)).filter((id): id is string => Boolean(id));
      setSnaps(ids.length ? await api.getBills(ids) : {});
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Laden fehlgeschlagen."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  // Live: a guest ticks or pays, the staff marks a share as received – the light changes
  // (bundled, as one change often comes with several updates).
  const reloadTimer = useRef<number | null>(null);
  const onBillChanged = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => void load(), 350);
  }, [load]);
  useBillChanges(onBillChanged);

  const venue = venues?.[0];
  return (
    <div className="page restaurant">
      <Header title={venue?.name ?? t("Restaurant")} back={qr ? "/restaurant" : "/profile"} />
      <main className="content">
        {error && <p className="alert">{error}</p>}
        {venues === null && !error && <p className="muted">{t("Wird geladen …")}</p>}
        {venues && !venue && <CreateVenue onCreated={() => void load()} />}
        {venue && qr && <QrSheet venue={venue} />}
        {venue && !qr && (
          <>
            <div className="restaurant-bar">
              <p className="muted small">{t("Rot = offen · Gelb = teilweise bezahlt · Grün = bezahlt")}</p>
              <button type="button" className="btn btn-small" onClick={() => navigate("/restaurant/qr")}>
                {t("QR-Codes drucken")}
              </button>
            </div>
            <ul className="table-board">
              {venue.tables.map((table) => (
                <TableCard key={table.id} table={table} snapshot={table.billId ? snaps[table.billId] : undefined} onChanged={() => void load()} />
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
