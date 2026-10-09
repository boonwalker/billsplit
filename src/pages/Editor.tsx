import { useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import { encodeBill, type Bill, type BillItem } from "../lib/bill";
import { prepareImage } from "../lib/image";
import { centsToInput, formatMoney, parseMoney } from "../lib/money";
import { recognizeReceipt } from "../lib/recognize";
import { navigate } from "../lib/router";
import { addMyBill, clearDraft, loadDraft, loadSettings, saveDraft } from "../lib/storage";

/** Photo taken on the home screen, handed over to the editor (files can't go through the URL). */
let pendingPhoto: File | null = null;
export function setPendingPhoto(file: File): void {
  pendingPhoto = file;
}

interface Row {
  key: number;
  name: string;
  qty: string;
  total: string;
}

interface Draft {
  title: string;
  date: string;
  currency: string;
  payerName: string;
  tipPercent: string;
  rows: Row[];
  receiptTotal: number | null;
  engine: "ai" | "ocr" | null;
}

let nextKey = 1;
const newRow = (item?: BillItem): Row => ({
  key: nextKey++,
  name: item?.name ?? "",
  qty: String(item?.qty ?? 1),
  total: item ? centsToInput(item.total) : "",
});

function emptyDraft(): Draft {
  return {
    title: "",
    date: new Date().toISOString().slice(0, 10),
    currency: "EUR",
    payerName: loadSettings().name,
    tipPercent: "0",
    rows: [newRow()],
    receiptTotal: null,
    engine: null,
  };
}

/** Opens an existing bill in the editor, e.g. to fix a typo after sharing. */
export function editBill(bill: Bill): void {
  const draft: Draft = {
    title: bill.title,
    date: bill.date,
    currency: bill.currency,
    payerName: bill.payerName,
    tipPercent: String(bill.tipPercent),
    rows: bill.items.map(newRow),
    receiptTotal: null,
    engine: null,
  };
  saveDraft(draft);
  navigate("/new");
}

function restoreDraft(): Draft {
  const saved = loadDraft<Draft>();
  if (!saved || !Array.isArray(saved.rows)) return emptyDraft();
  return { ...saved, rows: saved.rows.map((r) => ({ ...r, key: nextKey++ })) };
}

function rowToItem(row: Row): BillItem | null {
  const total = parseMoney(row.total);
  const qty = parseInt(row.qty, 10);
  if (!row.name.trim() || total === null || !(qty >= 1)) return null;
  return { name: row.name.trim(), qty, total };
}

export default function Editor() {
  const [draft, setDraft] = useState<Draft>(restoreDraft);
  const [busy, setBusy] = useState<{ message: string; progress?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const settings = loadSettings();
  const started = useRef(false);

  useEffect(() => saveDraft(draft), [draft]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function scan(file: File) {
    setError(null);
    setBusy({ message: "Bild wird vorbereitet …" });
    try {
      const image = await prepareImage(file);
      setPreview(image.previewUrl);
      const receipt = await recognizeReceipt(image, (message, progress) => setBusy({ message, progress }));
      if (receipt.items.length === 0) {
        setError("Auf dem Foto wurden keine Positionen erkannt. Versuch es mit einem schärferen Foto oder trag sie manuell ein.");
      }
      setDraft((d) => ({
        ...d,
        title: receipt.merchant || d.title,
        date: receipt.date || d.date,
        currency: receipt.currency || d.currency,
        receiptTotal: receipt.total,
        engine: receipt.engine,
        rows: receipt.items.length ? receipt.items.map(newRow) : d.rows,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Erkennung ist fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (started.current || !pendingPhoto) return;
    started.current = true;
    const file = pendingPhoto;
    pendingPhoto = null;
    void scan(file);
  }, []);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateRow = (key: number, patch: Partial<Row>) =>
    setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const removeRow = (key: number) => setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.key !== key) }));
  const addRow = () => setDraft((d) => ({ ...d, rows: [...d.rows, newRow()] }));

  const items = draft.rows.map(rowToItem);
  const validItems = items.filter((i): i is BillItem => i !== null);
  const sum = validItems.reduce((s, i) => s + i.total, 0);
  const tipPercent = Math.max(0, Number(draft.tipPercent.replace(",", ".")) || 0);
  const mismatch = draft.receiptTotal !== null && validItems.length > 0 && draft.receiptTotal !== sum;
  const hasPayment = Boolean(settings.payment.paypal || settings.payment.iban || settings.payment.cash);

  function create() {
    setShowErrors(true);
    if (items.some((i) => i === null) || validItems.length === 0 || !hasPayment) return;
    const bill: Bill = {
      title: draft.title.trim() || "Rechnung",
      date: draft.date,
      currency: draft.currency,
      payerName: draft.payerName.trim(),
      tipPercent,
      items: validItems,
      payment: settings.payment,
    };
    const encoded = encodeBill(bill);
    addMyBill({ encoded, title: bill.title, total: sum, currency: bill.currency, createdAt: new Date().toISOString() });
    clearDraft();
    navigate(`/share/${encoded}`);
  }

  return (
    <div className="page">
      <Header
        title="Rechnung prüfen"
        back="/"
        action={
          <label className="icon-btn" aria-label="Neues Foto">
            📷
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
          </label>
        }
      />
      <main className="content">
        {busy && (
          <div className="card scanning" role="status">
            {preview && <img src={preview} alt="Beleg" className="scan-preview" />}
            <div className="spinner" aria-hidden="true" />
            <p>{busy.message}</p>
            {busy.progress !== undefined && <progress max={1} value={busy.progress} />}
          </div>
        )}

        {error && <div className="alert">{error}</div>}

        {!busy && draft.engine && (
          <p className="muted small">
            {draft.engine === "ai" ? "✨ Automatisch per KI erkannt" : "🔎 Per Texterkennung auf dem Gerät erkannt"} – bitte kurz prüfen
            und ggf. korrigieren.
          </p>
        )}

        <div className="card">
          <label className="field">
            <span>Restaurant / Titel</span>
            <input value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="z. B. Trattoria Da Mario" />
          </label>
          <div className="row gap">
            <label className="field grow">
              <span>Datum</span>
              <input type="date" value={draft.date} onChange={(e) => update({ date: e.target.value })} />
            </label>
            <label className="field grow">
              <span>Bezahlt von</span>
              <input value={draft.payerName} onChange={(e) => update({ payerName: e.target.value })} placeholder="Dein Name" />
            </label>
          </div>
        </div>

        <h3 className="section-title">Positionen</h3>
        <div className="card items-editor">
          <div className="items-head muted small" aria-hidden="true">
            <span>Anz.</span>
            <span>Bezeichnung</span>
            <span>Preis gesamt</span>
            <span />
          </div>
          {draft.rows.map((row, idx) => {
            const invalid = showErrors && items[idx] === null;
            const item = items[idx];
            return (
              <div key={row.key} className={`item-row${invalid ? " invalid" : ""}`}>
                <input
                  className="qty-input"
                  inputMode="numeric"
                  aria-label="Anzahl"
                  value={row.qty}
                  onChange={(e) => updateRow(row.key, { qty: e.target.value.replace(/\D/g, "") })}
                />
                <input aria-label="Bezeichnung" value={row.name} placeholder="Bezeichnung" onChange={(e) => updateRow(row.key, { name: e.target.value })} />
                <div className="price-cell">
                  <input
                    className="price-input"
                    inputMode="decimal"
                    aria-label="Preis gesamt"
                    value={row.total}
                    placeholder="0,00"
                    onChange={(e) => updateRow(row.key, { total: e.target.value })}
                    onBlur={() => {
                      const c = parseMoney(row.total);
                      if (c !== null) updateRow(row.key, { total: centsToInput(c) });
                    }}
                  />
                  {item && item.qty > 1 && <small className="muted">à {formatMoney(Math.round(item.total / item.qty), draft.currency)}</small>}
                </div>
                <button className="icon-btn" aria-label="Position entfernen" onClick={() => removeRow(row.key)}>
                  ✕
                </button>
              </div>
            );
          })}
          <button className="btn btn-ghost" onClick={addRow}>
            + Position hinzufügen
          </button>
        </div>

        <div className="card">
          <div className="row between">
            <span>Summe Positionen</span>
            <strong>{formatMoney(sum, draft.currency)}</strong>
          </div>
          {mismatch && (
            <p className="warning small">
              Auf dem Beleg steht {formatMoney(draft.receiptTotal!, draft.currency)}. Fehlt eine Position oder ist ein Preis falsch erkannt?
            </p>
          )}
          <label className="field">
            <span>Trinkgeld (wird anteilig auf alle aufgeschlagen)</span>
            <div className="chips">
              {["0", "5", "10", "15"].map((p) => (
                <button key={p} className={`chip${draft.tipPercent === p ? " active" : ""}`} onClick={() => update({ tipPercent: p })}>
                  {p} %
                </button>
              ))}
              <input
                className="tip-input"
                inputMode="decimal"
                aria-label="Trinkgeld in Prozent"
                value={draft.tipPercent}
                onChange={(e) => update({ tipPercent: e.target.value.replace(/[^\d.,]/g, "") })}
              />
              <span>%</span>
            </div>
          </label>
        </div>

        <div className="card">
          <div className="row between">
            <h3 className="section-title flush">Zahlung an dich</h3>
            <button className="btn btn-ghost small" onClick={() => navigate("/settings")}>
              Ändern
            </button>
          </div>
          {hasPayment ? (
            <ul className="plain small">
              {settings.payment.paypal && <li>💙 PayPal: paypal.me/{settings.payment.paypal}</li>}
              {settings.payment.iban && <li>🏦 Überweisung an {settings.payment.accountHolder || "dein Konto"}</li>}
              {settings.payment.cash && <li>💶 Bar</li>}
            </ul>
          ) : (
            <p className={showErrors ? "error small" : "warning small"}>Bitte hinterlege zuerst mindestens eine Zahlungsmethode.</p>
          )}
        </div>

        {showErrors && items.some((i) => i === null) && <div className="alert">Bitte vervollständige die rot markierten Positionen.</div>}

        <div className="sticky-footer">
          <button className="btn btn-primary btn-large" onClick={create} disabled={Boolean(busy)}>
            QR-Code erstellen
          </button>
        </div>
      </main>
    </div>
  );
}
