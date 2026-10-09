import { useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { newItemId, type BillData, type BillItem } from "../lib/bill";
import { prepareImage } from "../lib/image";
import { centsToInput, formatMoney, parseMoney } from "../lib/money";
import type { ParsedReceipt, ReceiptItem } from "../lib/receipt";
import { recognizeReceipt } from "../lib/recognize";
import { navigate } from "../lib/router";
import { clearDraft, loadDraft, loadProfile, profileReady, rememberBill, saveDraft } from "../lib/storage";

/** Photo taken on the home screen, handed over to the editor (files can't go through the URL). */
let pendingPhoto: File | null = null;
export function setPendingPhoto(file: File): void {
  pendingPhoto = file;
}

interface Row {
  id: string;
  name: string;
  qty: string;
  total: string;
}

interface Draft {
  title: string;
  date: string;
  currency: string;
  tipPercent: string;
  rows: Row[];
  receiptTotal: number | null;
  engine: "ai" | "ocr" | null;
}

const newRow = (item?: ReceiptItem & { id?: string }): Row => ({
  id: item?.id ?? newItemId(),
  name: item?.name ?? "",
  qty: String(item?.qty ?? 1),
  total: item ? centsToInput(item.total) : "",
});

function emptyDraft(): Draft {
  return {
    title: "",
    date: new Date().toISOString().slice(0, 10),
    currency: "EUR",
    tipPercent: "0",
    rows: [newRow()],
    receiptTotal: null,
    engine: null,
  };
}

function draftFromData(data: BillData): Draft {
  return {
    title: data.title,
    date: data.date,
    currency: data.currency,
    tipPercent: String(data.tipPercent),
    rows: data.items.map(newRow),
    receiptTotal: null,
    engine: null,
  };
}

function rowToItem(row: Row): BillItem | null {
  const total = parseMoney(row.total);
  const qty = parseInt(row.qty, 10);
  if (!row.name.trim() || total === null || !(qty >= 1)) return null;
  return { id: row.id, name: row.name.trim(), qty, total };
}

function paymentFromProfile(): BillData["payment"] {
  const p = loadProfile();
  return { paypalMe: p.paypalMe || undefined, paypalEmail: p.paypalEmail || undefined };
}

function toBillData(draft: Draft, items: BillItem[]): BillData {
  return {
    title: draft.title.trim() || "Rechnung",
    date: draft.date,
    currency: draft.currency,
    tipPercent: Math.min(100, Math.max(0, Number(draft.tipPercent.replace(",", ".")) || 0)),
    items,
    payment: paymentFromProfile(),
  };
}

/** Recognition is trusted enough to skip the review when the AI read it and the sum matches the printed total. */
function isConfident(r: ParsedReceipt): boolean {
  const sum = r.items.reduce((s, i) => s + i.total, 0);
  return r.engine === "ai" && r.items.length > 0 && (r.total === null || r.total === sum);
}

export default function Editor({ billId }: { billId?: string }) {
  const editing = Boolean(billId);
  const [draft, setDraft] = useState<Draft>(() => (editing ? emptyDraft() : (loadDraft<Draft>() ?? emptyDraft())));
  const [loaded, setLoaded] = useState(!editing);
  const [busy, setBusy] = useState<{ message: string; progress?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!billId) return;
    api
      .getBill(billId)
      .then((snap) => {
        if (!snap.isOwner) throw new Error("Nur wer die Rechnung bezahlt hat, kann sie bearbeiten.");
        setDraft(draftFromData(snap.data));
        setLoaded(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Laden fehlgeschlagen."));
  }, [billId]);

  useEffect(() => {
    if (!editing) saveDraft(draft);
  }, [draft, editing]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function publish(data: BillData) {
    setBusy({ message: "QR-Code wird erstellt …" });
    try {
      const snap = await api.createBill(data, loadProfile().name.trim() || "Ich");
      rememberBill({ id: snap.id, title: data.title, role: "owner", createdAt: snap.createdAt });
      clearDraft();
      navigate(`/b/${snap.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Rechnung konnte nicht erstellt werden.");
      setBusy(null);
    }
  }

  async function scan(file: File) {
    setError(null);
    setBusy({ message: "Bild wird vorbereitet …" });
    try {
      const image = await prepareImage(file);
      setPreview(image.previewUrl);
      const receipt = await recognizeReceipt(image, (message, progress) => setBusy({ message, progress }));
      const next: Draft = {
        ...draft,
        title: receipt.merchant || draft.title,
        date: receipt.date || draft.date,
        currency: receipt.currency || draft.currency,
        receiptTotal: receipt.total,
        engine: receipt.engine,
        rows: receipt.items.length ? receipt.items.map((i) => newRow(i)) : draft.rows,
      };
      setDraft(next);
      if (receipt.items.length === 0) {
        setError("Auf dem Foto wurden keine Positionen erkannt. Versuch es mit einem schärferen Foto oder trag sie unten ein.");
      } else if (isConfident(receipt)) {
        // Straight to the QR code – the payer can still correct lines from there.
        await publish(toBillData(next, next.rows.map(rowToItem).filter((i): i is BillItem => i !== null)));
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Erkennung ist fehlgeschlagen.");
    }
    setBusy(null);
  }

  useEffect(() => {
    if (!editing && !profileReady()) navigate("/profile?next=new", { replace: true });
  }, [editing]);

  useEffect(() => {
    if (started.current || !pendingPhoto || editing) return;
    started.current = true;
    const file = pendingPhoto;
    pendingPhoto = null;
    void scan(file);
  }, []);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateRow = (id: string, patch: Partial<Row>) => setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const removeRow = (id: string) => setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));
  const addRow = () => setDraft((d) => ({ ...d, rows: [...d.rows, newRow()] }));

  const items = draft.rows.map(rowToItem);
  const validItems = items.filter((i): i is BillItem => i !== null);
  const sum = validItems.reduce((s, i) => s + i.total, 0);
  const mismatch = draft.receiptTotal !== null && validItems.length > 0 && draft.receiptTotal !== sum;

  async function submit() {
    setShowErrors(true);
    if (items.some((i) => i === null) || validItems.length === 0) return;
    const data = toBillData(draft, validItems);
    if (!billId) return publish(data);
    setBusy({ message: "Wird gespeichert …" });
    try {
      await api.updateBill(billId, data);
      navigate(`/b/${billId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      setBusy(null);
    }
  }

  if (busy) {
    return (
      <div className="page">
        <Header back="/" />
        <main className="content center-v">
          <div className="scanning" role="status">
            {preview && (
              <div className="scan-photo">
                <img src={preview} alt="Dein Beleg" />
                <div className="scan-beam" aria-hidden="true" />
              </div>
            )}
            <p className="scan-msg">{busy.message}</p>
            {busy.progress !== undefined ? <progress max={1} value={busy.progress} /> : <div className="dots" aria-hidden="true"><i /><i /><i /></div>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Header back={billId ? `/b/${billId}` : "/"} title={editing ? "Positionen bearbeiten" : "Rechnung prüfen"} />
      <main className="content">
        {!editing && (
          <div className="capture-row">
            <label className="btn btn-primary grow">
              📷 Foto aufnehmen
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
            </label>
            <label className="btn btn-ghost grow">
              Aus Galerie
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
            </label>
          </div>
        )}

        {error && <div className="alert">{error}</div>}

        {draft.engine && (
          <p className="muted small">
            {draft.engine === "ai" ? "✨ Per KI erkannt" : "🔎 Per Texterkennung auf dem Gerät erkannt"} – bitte kurz prüfen.
          </p>
        )}

        {loaded && (
          <>
            <div className="card">
              <label className="field">
                <span>Restaurant / Titel</span>
                <input value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="z. B. Trattoria Da Mario" maxLength={80} />
              </label>
              <label className="field">
                <span>Datum</span>
                <input type="date" value={draft.date} onChange={(e) => update({ date: e.target.value })} />
              </label>
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
                const item = items[idx];
                return (
                  <div key={row.id} className={`item-row${showErrors && !item ? " invalid" : ""}`}>
                    <input className="qty-input" inputMode="numeric" aria-label="Anzahl" value={row.qty} onChange={(e) => updateRow(row.id, { qty: e.target.value.replace(/\D/g, "") })} />
                    <input aria-label="Bezeichnung" value={row.name} placeholder="Bezeichnung" maxLength={120} onChange={(e) => updateRow(row.id, { name: e.target.value })} />
                    <div className="price-cell">
                      <input
                        className="price-input"
                        inputMode="decimal"
                        aria-label="Preis gesamt"
                        value={row.total}
                        placeholder="0,00"
                        onChange={(e) => updateRow(row.id, { total: e.target.value })}
                        onBlur={() => {
                          const c = parseMoney(row.total);
                          if (c !== null) updateRow(row.id, { total: centsToInput(c) });
                        }}
                      />
                      {item && item.qty > 1 && <small className="muted">à {formatMoney(Math.round(item.total / item.qty), draft.currency)}</small>}
                    </div>
                    <button className="icon-btn subtle" aria-label="Position entfernen" onClick={() => removeRow(row.id)}>
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
              <div className="field">
                <span>Trinkgeld – wird anteilig auf alle aufgeschlagen</span>
                <div className="chips">
                  {["0", "5", "10", "15"].map((p) => (
                    <button key={p} type="button" className={`chip${draft.tipPercent === p ? " active" : ""}`} onClick={() => update({ tipPercent: p })}>
                      {p} %
                    </button>
                  ))}
                  <input className="tip-input" inputMode="decimal" aria-label="Trinkgeld in Prozent" value={draft.tipPercent} onChange={(e) => update({ tipPercent: e.target.value.replace(/[^\d.,]/g, "") })} />
                  <span>%</span>
                </div>
              </div>
            </div>

            {showErrors && items.some((i) => i === null) && <div className="alert">Bitte vervollständige die rot markierten Positionen.</div>}

            <div className="sticky-footer">
              <button className="btn btn-primary btn-large" onClick={submit}>
                {editing ? "Änderungen speichern" : "QR-Code erstellen"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
