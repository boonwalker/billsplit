import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import { billId, claimAmount, computeShare, decodeBill, type BillItem, type Claim, type Claims } from "../lib/bill";
import { formatMoney } from "../lib/money";
import { formatIban, paypalLink } from "../lib/payment";
import { navigate } from "../lib/router";
import { loadClaims, loadMyBills, loadPaid, saveClaims, savePaid, type PaidInfo } from "../lib/storage";

const SHARE_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

function ItemRow({
  item,
  claim,
  currency,
  onChange,
}: {
  item: BillItem;
  claim: Claim | undefined;
  currency: string;
  onChange: (claim: Claim) => void;
}) {
  const units = claim?.units ?? 0;
  const shareCount = claim?.shareCount ?? 1;
  const selected = units > 0;
  const amount = claimAmount(item, claim);
  const set = (u: number, s = shareCount) => onChange({ units: Math.max(0, Math.min(item.qty, u)), shareCount: s });

  return (
    <li className={`claim-row${selected ? " selected" : ""}`}>
      <button
        className="claim-main"
        aria-pressed={selected}
        onClick={() => (item.qty === 1 ? set(selected ? 0 : 1) : set(units < item.qty ? units + 1 : 0))}
      >
        <span className="checkbox" aria-hidden="true">
          {selected ? "✓" : ""}
        </span>
        <span className="claim-text">
          <span className="claim-name">
            {item.qty > 1 && <span className="qty-badge">{item.qty}×</span>}
            {item.name}
          </span>
          <span className="muted small">
            {item.qty > 1 ? `${formatMoney(Math.round(item.total / item.qty), currency)} pro Stück · ` : ""}
            {formatMoney(item.total, currency)}
          </span>
        </span>
        {selected && <span className="claim-amount">{formatMoney(amount, currency)}</span>}
      </button>
      {(item.qty > 1 || selected) && (
        <div className="claim-controls">
          {item.qty > 1 && (
            <div className="stepper" aria-label="Anzahl">
              <button onClick={() => set(units - 1)} disabled={units === 0} aria-label="Weniger">
                −
              </button>
              <span>
                {units} von {item.qty}
              </span>
              <button onClick={() => set(units + 1)} disabled={units === item.qty} aria-label="Mehr">
                +
              </button>
            </div>
          )}
          {selected && (
            <label className="share-select">
              <span>geteilt mit</span>
              <select value={shareCount} onChange={(e) => set(units, Number(e.target.value))}>
                {SHARE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "niemandem" : `${n} Pers.`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </li>
  );
}

export default function ViewBill({ data }: { data: string }) {
  const bill = useMemo(() => decodeBill(data), [data]);
  const id = useMemo(() => billId(data), [data]);
  const [claims, setClaims] = useState<Claims>(() => loadClaims(id));
  const [paid, setPaid] = useState<PaidInfo | null>(() => loadPaid(id));
  const [showOther, setShowOther] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const isOwnBill = useMemo(() => loadMyBills().some((b) => b.encoded === data), [data]);

  useEffect(() => saveClaims(id, claims), [id, claims]);

  if (!bill) {
    return (
      <div className="page">
        <Header title="Rechnung" back="/" />
        <main className="content">
          <div className="alert">Diese Rechnung konnte nicht gelesen werden. Ist der Link vollständig?</div>
        </main>
      </div>
    );
  }

  const share = computeShare(bill, claims);
  const currency = bill.currency;
  const { paypal, iban, accountHolder, cash } = bill.payment;
  const reference = `${bill.title}${bill.date ? ` ${new Date(bill.date).toLocaleDateString("de-DE")}` : ""}`;

  function markPaid(method: PaidInfo["method"]) {
    const info: PaidInfo = { amount: share.total, method, at: new Date().toISOString() };
    savePaid(id, info);
    setPaid(info);
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Kopieren:", text);
    }
  }

  const nothingSelected = share.total <= 0;
  const hasOther = Boolean(iban || cash);

  return (
    <div className="page">
      <Header title={bill.title || "Rechnung"} back="/" />
      <main className="content with-paybar">
        <div className="bill-meta">
          <p>
            <strong>{bill.payerName || "Jemand"}</strong> hat bezahlt
            {bill.date && <> am {new Date(bill.date).toLocaleDateString("de-DE")}</>}.
          </p>
          <p className="muted small">Tippe an, was du hattest. Bei mehreren Stück wähl die Anzahl, geteilte Sachen kannst du aufteilen.</p>
          {isOwnBill && (
            <p className="small">
              Das ist deine eigene Rechnung – so sehen sie deine Freunde.{" "}
              <button className="link" onClick={() => navigate(`/share/${data}`)}>
                Zum QR-Code
              </button>
            </p>
          )}
        </div>

        {paid && (
          <div className="paid-banner">
            ✓ Du hast {formatMoney(paid.amount, currency)} als bezahlt markiert ({new Date(paid.at).toLocaleDateString("de-DE")}).{" "}
            <button
              className="link"
              onClick={() => {
                savePaid(id, null);
                setPaid(null);
              }}
            >
              Rückgängig
            </button>
          </div>
        )}

        <ul className="claim-list">
          {bill.items.map((item, idx) => (
            <ItemRow
              key={idx}
              item={item}
              claim={claims[idx]}
              currency={currency}
              onChange={(c) =>
                setClaims((prev) => {
                  const next = { ...prev };
                  if (c.units > 0) next[idx] = c;
                  else delete next[idx];
                  return next;
                })
              }
            />
          ))}
        </ul>

        {showOther && hasOther && (
          <div className="card">
            <h3 className="section-title flush">Andere Zahlungsarten</h3>
            {iban && (
              <div className="transfer">
                <p className="small muted">Überweisung</p>
                <dl>
                  <dt>Empfänger</dt>
                  <dd>{accountHolder || bill.payerName}</dd>
                  <dt>IBAN</dt>
                  <dd>
                    <code>{formatIban(iban)}</code>{" "}
                    <button className="link" onClick={() => copy("iban", iban)}>
                      {copied === "iban" ? "✓" : "kopieren"}
                    </button>
                  </dd>
                  <dt>Betrag</dt>
                  <dd>
                    {formatMoney(share.total, currency)}{" "}
                    <button className="link" onClick={() => copy("amount", (share.total / 100).toFixed(2).replace(".", ","))}>
                      {copied === "amount" ? "✓" : "kopieren"}
                    </button>
                  </dd>
                  <dt>Verwendungszweck</dt>
                  <dd>
                    {reference}{" "}
                    <button className="link" onClick={() => copy("ref", reference)}>
                      {copied === "ref" ? "✓" : "kopieren"}
                    </button>
                  </dd>
                </dl>
                <button className="btn btn-secondary" disabled={nothingSelected} onClick={() => markPaid("transfer")}>
                  Als überwiesen markieren
                </button>
              </div>
            )}
            {cash && (
              <div className="transfer">
                <p className="small muted">Bar</p>
                <p>
                  Gib {bill.payerName || "der Person"} einfach {formatMoney(share.total, currency)} in bar.
                </p>
                <button className="btn btn-secondary" disabled={nothingSelected} onClick={() => markPaid("cash")}>
                  Als bar bezahlt markieren
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <div className="paybar">
        <div className="paybar-sum">
          <span className="muted small">
            Dein Anteil{share.tip > 0 ? ` inkl. ${bill.tipPercent} % Trinkgeld (${formatMoney(share.tip, currency)})` : ""}
          </span>
          <strong className="paybar-total">{formatMoney(share.total, currency)}</strong>
        </div>
        <div className="paybar-actions">
          {paypal ? (
            <a
              className={`btn btn-paypal btn-large${nothingSelected ? " disabled" : ""}`}
              href={nothingSelected ? undefined : paypalLink(paypal, share.total, currency)}
              aria-disabled={nothingSelected}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => (nothingSelected ? e.preventDefault() : markPaid("paypal"))}
            >
              Mit PayPal bezahlen
            </a>
          ) : (
            !hasOther && <p className="small muted">Keine Zahlungsmethode hinterlegt.</p>
          )}
          {hasOther && (
            <button className={`btn ${paypal ? "btn-ghost" : "btn-primary btn-large"}`} onClick={() => setShowOther((v) => !v)} disabled={nothingSelected}>
              {paypal ? (showOther ? "Weniger Optionen" : "Andere Zahlungsart") : "Bezahlen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
