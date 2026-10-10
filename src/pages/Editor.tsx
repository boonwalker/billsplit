import { useEffect, useRef, useState, type CSSProperties } from "react";
import Header from "../components/Header";
import SupermarketSheet from "../components/SupermarketSheet";
import { looksPersonal } from "../lib/personal";
import TipControl, { tipCents, tipPersons, type TipValue } from "../components/TipControl";
import { api } from "../lib/api";
import { newItemId, subtotal, type BillData, type BillFee, type BillItem } from "../lib/bill";
import { prepareImage } from "../lib/image";
import { centsToInput, formatMoney, parseMoney } from "../lib/money";
import { receiptSum, type ParsedReceipt, type ReceiptItem } from "../lib/receipt";
import { recognizeReceipt } from "../lib/recognize";
import { navigate } from "../lib/router";
import { clearDraft, loadDraft, loadProfile, profileReady, rememberBill, saveDraft } from "../lib/storage";
import { paymentFromProfile } from "../lib/payment";

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
  /** Kept from the bill: crossed out by the payer (completely or some units). */
  excluded?: boolean;
  struck?: number;
}

interface FeeRow {
  id: string;
  name: string;
  amount: string;
  /** Kept from the bill: crossed out by the payer. */
  excluded?: boolean;
}

interface Draft {
  title: string;
  date: string;
  currency: string;
  tip: TipValue;
  /** The tip was read from the receipt, so the payer is not asked again. */
  tipOnReceipt: boolean;
  rows: Row[];
  /** Delivery, service and similar fees – shared per person like the tip. */
  fees: FeeRow[];
  /** A delivery/takeaway order: ask how many people ordered together. */
  delivery: boolean;
  receiptTotal: number | null;
  engine: "ai" | "ocr" | null;
  /** Kept from the bill when it is edited (set on the bill page). */
  equalSplit?: boolean;
  /** A supermarket receipt: ask which items are not or only partly billed. */
  supermarket?: boolean;
  /** Kept from the bill when it is edited: the payer bills some items not or only partly. */
  partial?: boolean;
  /** Kept from the bill when it is edited: the payer crossed the tip out. */
  tipExcluded?: boolean;
}

const newFeeRow = (fee?: { id?: string; name: string; amount: number; excluded?: boolean }): FeeRow => ({
  id: fee?.id ?? newItemId(),
  name: fee?.name ?? "",
  amount: fee ? centsToInput(fee.amount) : "",
  excluded: fee?.excluded,
});

function feeRowToFee(row: FeeRow): BillFee | null {
  const amount = parseMoney(row.amount);
  if (!row.name.trim() || amount === null || amount === 0) return null;
  return { id: row.id, name: row.name.trim(), amount, ...(row.excluded ? { excluded: true } : {}) };
}

const draftFees = (draft: Draft): BillFee[] => draft.fees.map(feeRowToFee).filter((f): f is BillFee => f !== null);

const newRow = (item?: ReceiptItem & { id?: string }): Row => ({
  id: item?.id ?? newItemId(),
  name: item?.name ?? "",
  qty: String(item?.qty ?? 1),
  total: item ? centsToInput(item.total) : "",
  excluded: item?.excluded,
  struck: item?.struck,
});

function emptyDraft(): Draft {
  return {
    title: "",
    date: new Date().toISOString().slice(0, 10),
    currency: "EUR",
    tip: { mode: "percent", percent: "0", total: "", persons: "" },
    tipOnReceipt: false,
    rows: [newRow()],
    fees: [],
    delivery: false,
    receiptTotal: null,
    engine: null,
  };
}

function draftFromData(data: BillData): Draft {
  return {
    title: data.title,
    date: data.date,
    currency: data.currency,
    tip: {
      ...(data.tipAmount
        ? { mode: "amount" as const, percent: "0", total: "", amount: centsToInput(data.tipAmount) }
        : { mode: "percent" as const, percent: String(data.tipPercent), total: "" }),
      persons: data.tipSplitCount ? String(data.tipSplitCount) : "",
    },
    tipOnReceipt: false,
    equalSplit: data.equalSplit,
    supermarket: data.supermarket,
    partial: data.partial,
    tipExcluded: data.tipExcluded,
    rows: data.items.map(newRow),
    fees: (data.fees ?? []).map(newFeeRow),
    delivery: (data.fees ?? []).length > 0,
    receiptTotal: null,
    engine: null,
  };
}

function rowToItem(row: Row): BillItem | null {
  const total = parseMoney(row.total);
  const qty = parseInt(row.qty, 10);
  if (!row.name.trim() || total === null || !(qty >= 1)) return null;
  return {
    id: row.id,
    name: row.name.trim(),
    qty,
    total,
    ...(row.excluded ? { excluded: true } : {}),
    // A changed quantity may leave nothing to cross out partly any more.
    ...(row.struck && row.struck < qty ? { struck: row.struck } : {}),
  };
}


function toBillData(draft: Draft, items: BillItem[]): BillData {
  const base = {
    title: draft.title.trim() || "Rechnung",
    date: draft.date,
    currency: draft.currency,
    items,
    payment: paymentFromProfile(loadProfile()),
    tipSplitCount: tipPersons(draft.tip),
    equalSplit: draft.equalSplit || undefined,
    supermarket: draft.supermarket || undefined,
    partial: draft.partial || undefined,
    tipExcluded: draft.tipExcluded || undefined,
    fees: draftFees(draft).length ? draftFees(draft) : undefined,
  };
  if (draft.tip.mode === "total" || draft.tip.mode === "amount") {
    const amount = tipCents(draft.tip, subtotal(items), (base.fees ?? []).reduce((s, f) => s + f.amount, 0));
    return { ...base, tipPercent: 0, tipAmount: amount > 0 ? amount : undefined };
  }
  return { ...base, tipPercent: Math.min(100, Math.max(0, Number(draft.tip.percent.replace(",", ".")) || 0)) };
}

/** Restores a saved draft; drafts from older versions lack the tip fields. */
function restoreDraft(): Draft {
  const saved = loadDraft<Partial<Draft>>();
  if (!saved?.rows) return emptyDraft();
  const empty = emptyDraft();
  return {
    ...empty,
    ...saved,
    // Drafts from older versions may carry a tip mode that no longer exists.
    tip: saved.tip?.mode === "percent" || saved.tip?.mode === "total" || saved.tip?.mode === "amount" ? { ...empty.tip, ...saved.tip } : empty.tip,
    tipOnReceipt: saved.tipOnReceipt ?? false,
    fees: saved.fees ?? [],
    delivery: saved.delivery ?? false,
  } as Draft;
}

/** Recognition is trusted enough to skip the review when the AI read it and the sum matches the printed total. */
function isConfident(r: ParsedReceipt): boolean {
  const sum = r.items.reduce((s, i) => s + i.total, 0) + r.fees.reduce((s, f) => s + f.amount, 0);
  return r.engine === "ai" && r.items.length > 0 && (r.total === null || r.total === sum);
}

export default function Editor({ billId }: { billId?: string }) {
  const editing = Boolean(billId);
  const [draft, setDraft] = useState<Draft>(() => (editing ? emptyDraft() : restoreDraft()));
  /** Items of a supermarket receipt waiting for "anything not or only partly billed?". */
  const [askShop, setAskShop] = useState<BillItem[] | null>(null);
  /** Names of lines the AI considers not a shared expense (listed first on supermarket receipts). */
  const [personalNames, setPersonalNames] = useState<Set<string>>(new Set());
  /** Items waiting for the tip / head count questions before the QR code is created. */
  const [askTip, setAskTip] = useState<BillItem[] | null>(null);
  const [loaded, setLoaded] = useState(!editing);
  /** scan: reading the receipt (with the photo) · create: making or saving the bill (just dots). */
  const [busy, setBusy] = useState<{ message: string; progress?: number; create?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  /** Width / height of the photo, so its preview can be as large as possible without bars. */
  const [previewRatio, setPreviewRatio] = useState(3 / 4);
  const [showErrors, setShowErrors] = useState(false);
  const started = useRef(false);
  /** The prepared photo or screenshot of the last scan; stored with the bill. */
  const photo = useRef<Blob | null>(null);

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
    setBusy({ message: "billsplit generiert die interaktive Rechnung", create: true });
    try {
      const snap = await api.createBill(data, loadProfile().name.trim() || "Ich");
      // Keep the photo the bill was read from, so everyone can check it later.
      if (photo.current) await api.uploadReceiptImage(snap.id, photo.current).catch(() => null);
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
      photo.current = image.blob;
      setPreviewRatio(image.canvas.width / image.canvas.height);
      setPreview(image.previewUrl);
      const receipt = await recognizeReceipt(image, (message, progress) => setBusy({ message, progress }));
      setPersonalNames(new Set(receipt.items.filter((i) => i.personal).map((i) => i.name)));
      const next: Draft = {
        ...draft,
        title: receipt.merchant || draft.title,
        date: receipt.date || draft.date,
        currency: receipt.currency || draft.currency,
        receiptTotal: receipt.total,
        engine: receipt.engine,
        tip: receipt.tip ? { ...draft.tip, mode: "total", total: centsToInput(receiptSum(receipt) + receipt.tip) } : draft.tip,
        tipOnReceipt: receipt.tip != null && receipt.tip > 0,
        rows: receipt.items.length ? receipt.items.map((i) => newRow(i)) : draft.rows,
        fees: receipt.fees.map((f) => newFeeRow(f)),
        delivery: receipt.delivery || receipt.fees.length > 0,
        supermarket: receipt.supermarket,
      };
      setDraft(next);
      if (receipt.items.length === 0) {
        setError("Auf dem Foto wurden keine Positionen erkannt. Versuch es mit einem schärferen Foto oder trag sie unten ein.");
      } else if (isConfident(receipt)) {
        // Straight to the QR code – the payer can still correct lines from there.
        // Without a tip on the receipt, or for a delivery order, ask first.
        const recognized = next.rows.map(rowToItem).filter((i): i is BillItem => i !== null);
        if (next.supermarket) {
          setAskShop(recognized);
          setBusy(null);
          return;
        }
        if (next.tipOnReceipt && !next.delivery) {
          await publish(toBillData(next, recognized));
          return;
        }
        setAskTip(recognized);
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
  const fees = draftFees(draft);
  const feeSum = fees.reduce((s, f) => s + f.amount, 0);
  const mismatch = draft.receiptTotal !== null && validItems.length > 0 && draft.receiptTotal !== sum + feeSum;
  const updateFee = (id: string, patch: Partial<FeeRow>) => setDraft((d) => ({ ...d, fees: d.fees.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const removeFee = (id: string) => setDraft((d) => ({ ...d, fees: d.fees.filter((f) => f.id !== id) }));
  const addFee = () => setDraft((d) => ({ ...d, fees: [...d.fees, newFeeRow()] }));
  const persons = tipPersons(draft.tip);
  const setPersons = (n: number | undefined) => update({ tip: { ...draft.tip, persons: n ? String(Math.min(100, Math.max(1, n))) : "" } });

  async function submit() {
    setShowErrors(true);
    if (items.some((i) => i === null) || validItems.length === 0) return;
    if (!billId) {
      if (draft.supermarket) {
        setAskShop(validItems);
        return;
      }
      // Nothing to ask: tip known and not an order shared by several people.
      if (draft.tipOnReceipt && !draft.delivery) return publish(toBillData(draft, validItems));
      setAskTip(validItems);
      return;
    }
    const data = toBillData(draft, validItems);
    setBusy({ message: "Wird gespeichert …", create: true });
    try {
      await api.updateBill(billId, data);
      navigate(`/b/${billId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      setBusy(null);
    }
  }

  // After "Rechnung erstellen": never the scan screen, only the dots and a line of text.
  if (busy?.create) {
    return (
      <div className="page loading-page">
        <Header back="/" />
        <main className="content center-v">
          <div className="scanning creating" role="status">
            <div className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <p className="scan-msg">{busy.message}</p>
          </div>
        </main>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="page loading-page">
        <Header back="/" />
        <main className={`content center-v${preview ? " scan-content" : ""}`}>
          <div className="scanning" role="status">
            {preview && (
              // As large as the screen allows in the photo's own shape, so the payer can already look it over.
              <div className="scan-photo" style={{ "--ar": previewRatio } as CSSProperties}>
                <img className="scan-photo-img" src={preview} alt="Dein Beleg" decoding="async" />
                <div className="scan-beam" aria-hidden="true">
                  <i />
                </div>
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
        {error && <div className="alert">{error}</div>}

        {/* Only needed when nothing was recognised: try another photo or screenshot. */}
        {!editing && validItems.length === 0 && (
          <div className="capture-row">
            <label className="btn btn-primary grow">
              📷 Neues Foto
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
            </label>
            <label className="btn btn-ghost grow">
              Anderer Screenshot
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
            </label>
          </div>
        )}

        {draft.engine && validItems.length > 0 && (
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

            <h3 className="section-title">Gebühren</h3>
            <div className="card items-editor">
              <p className="muted small">
                Liefer-, Service- und ähnliche Gebühren werden wie das Trinkgeld gleichmäßig auf alle Personen verteilt.
              </p>
              {draft.fees.map((fee) => {
                const invalid = showErrors && feeRowToFee(fee) === null && (fee.name.trim() !== "" || fee.amount.trim() !== "");
                return (
                  <div key={fee.id} className={`fee-row${invalid ? " invalid" : ""}`}>
                    <input aria-label="Gebühr" value={fee.name} placeholder="z. B. Liefergebühr" maxLength={80} onChange={(e) => updateFee(fee.id, { name: e.target.value })} />
                    <input
                      className="price-input"
                      inputMode="decimal"
                      aria-label="Betrag der Gebühr"
                      value={fee.amount}
                      placeholder="0,00"
                      onChange={(e) => updateFee(fee.id, { amount: e.target.value })}
                      onBlur={() => {
                        const c = parseMoney(fee.amount);
                        if (c !== null) updateFee(fee.id, { amount: centsToInput(c) });
                      }}
                    />
                    <button className="icon-btn subtle" aria-label="Gebühr entfernen" onClick={() => removeFee(fee.id)}>
                      ✕
                    </button>
                  </div>
                );
              })}
              <button className="btn btn-ghost" onClick={addFee}>
                + Gebühr hinzufügen
              </button>
            </div>

            <div className="card">
              <div className="row between">
                <span>Summe Positionen</span>
                <strong>{formatMoney(sum, draft.currency)}</strong>
              </div>
              {feeSum !== 0 && (
                <div className="row between">
                  <span>Gebühren</span>
                  <strong>{formatMoney(feeSum, draft.currency)}</strong>
                </div>
              )}
              {mismatch && (
                <p className="warning small">
                  Auf dem Beleg steht {formatMoney(draft.receiptTotal!, draft.currency)}. Fehlt eine Position oder ist ein Preis falsch erkannt?
                </p>
              )}
              <div className="field">
                <span>Trinkgeld – wird gleichmäßig auf alle Personen verteilt</span>
                {draft.tipOnReceipt && <small className="muted">Vom Beleg übernommen.</small>}
                <TipControl value={draft.tip} onChange={(tip) => update({ tip })} subtotal={sum} currency={draft.currency} fees={feeSum} />
              </div>
            </div>


            {showErrors && items.some((i) => i === null) && <div className="alert">Bitte vervollständige die rot markierten Positionen.</div>}

            <div className="sticky-footer">
              <button className="btn btn-primary btn-large" onClick={submit}>
                {editing ? "Änderungen speichern" : "Rechnung erstellen"}
              </button>
            </div>
          </>
        )}
      </main>

      {askShop && (
        <SupermarketSheet
          items={askShop}
          currency={draft.currency}
          isPersonal={(item) => personalNames.has(item.name) || looksPersonal(item.name)}
          title={draft.title}
          date={draft.date}
          ownerName={loadProfile().name.trim()}
          fees={draftFees(draft)}
          photoUrl={preview ?? undefined}
          onDone={(items, equalSplit, persons, partial, excludedFees) => {
            setAskShop(null);
            const tip = { ...draft.tip, persons: persons ? String(persons) : "" };
            const data = toBillData({ ...draft, equalSplit, tip }, items);
            // Fees crossed out on the receipt stay on the bill, struck through.
            const fees = data.fees?.map((fee) => (excludedFees.includes(fee.id) ? { ...fee, excluded: true } : fee));
            void publish({ ...data, fees, partial: partial || undefined });
          }}
        />
      )}

      {askTip && (
        <div className="sheet-backdrop">
          <form
            className="sheet"
            onSubmit={(e) => {
              e.preventDefault();
              const items = askTip;
              setAskTip(null);
              void publish(toBillData(draft, items));
            }}
          >
            {!draft.delivery && (
              <div className="sheet-emoji" aria-hidden="true">
                🙌
              </div>
            )}

            {draft.delivery && (
              <>
                <h2>Wie viele haben mitbestellt?</h2>
                <p className="muted">
                  {feeSum !== 0 ? `Gebühren (${formatMoney(feeSum, draft.currency)})` : "Gebühren"}
                  {draft.tipOnReceipt ? " und Trinkgeld" : ""} werden gleichmäßig auf alle verteilt – inklusive Dir. Wer den
                  QR-Code scannt, wird automatisch mitgezählt.
                </p>
                <div className="persons-question" role="group" aria-label="Personen, die mitbestellt haben">
                  <button type="button" onClick={() => setPersons((persons ?? 2) - 1)} disabled={(persons ?? 0) <= 1} aria-label="Eine Person weniger">
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label="Anzahl Personen"
                    value={draft.tip.persons}
                    placeholder="?"
                    onChange={(e) => setPersons(parseInt(e.target.value.replace(/\D/g, ""), 10) || undefined)}
                  />
                  <button type="button" onClick={() => setPersons((persons ?? 1) + 1)} aria-label="Eine Person mehr">
                    +
                  </button>
                </div>
                {persons && feeSum !== 0 && (
                  <p className="muted small center-text">
                    {formatMoney(Math.round((feeSum + (draft.tipOnReceipt ? tipCents(draft.tip, subtotal(askTip), feeSum) : 0)) / persons), draft.currency)} pro
                    Person{draft.tipOnReceipt ? " (Gebühren & Trinkgeld)" : " an Gebühren"}
                  </p>
                )}
              </>
            )}

            {!draft.tipOnReceipt && (
              <>
                <h2 className={draft.delivery ? "sheet-subtitle" : undefined}>Trinkgeld gegeben?</h2>
                <p className="muted">
                  {draft.engine ? "Auf dem Beleg steht kein Trinkgeld. " : ""}Wenn du Trinkgeld gegeben hast, trag es hier ein – es
                  wird gleichmäßig auf alle Personen verteilt.
                </p>
                <TipControl
                  value={draft.tip}
                  onChange={(tip) => update({ tip })}
                  subtotal={subtotal(askTip)}
                  currency={draft.currency}
                  fees={feeSum}
                  showPersons={!draft.delivery}
                />
              </>
            )}

            <button className="btn btn-primary btn-large">Rechnung erstellen</button>
            {!draft.tipOnReceipt && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const items = askTip;
                  const noTip: Draft = { ...draft, tip: { ...draft.tip, mode: "percent", percent: "0", total: "", amount: "" } };
                  setDraft(noTip);
                  setAskTip(null);
                  void publish(toBillData(noTip, items));
                }}
              >
                Ohne Trinkgeld weiter
              </button>
            )}
            <button type="button" className="link sheet-back" onClick={() => setAskTip(null)}>
              Positionen nochmal prüfen
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
