import { useState } from "react";
import Header from "../components/Header";
import { formatMoney } from "../lib/money";
import { navigate } from "../lib/router";
import { clearDraft, loadMyBills, loadSettings, removeMyBill, type SavedBill } from "../lib/storage";
import { setPendingPhoto } from "./Editor";

export default function Home() {
  const [bills, setBills] = useState<SavedBill[]>(loadMyBills);
  const settings = loadSettings();
  const hasPayment = Boolean(settings.payment.paypal || settings.payment.iban || settings.payment.cash);

  function onPhoto(file: File | undefined) {
    if (!file) return;
    clearDraft();
    setPendingPhoto(file);
    navigate("/new");
  }

  function startManual() {
    clearDraft();
    navigate("/new");
  }

  function remove(encoded: string) {
    removeMyBill(encoded);
    setBills(loadMyBills());
  }

  return (
    <div className="page">
      <Header
        title="billsplit"
        action={
          <button className="icon-btn" aria-label="Einstellungen" onClick={() => navigate("/settings")}>
            ⚙︎
          </button>
        }
      />
      <main className="content">
        <section className="hero">
          <h2>Rechnung bezahlt? Teil sie in Sekunden.</h2>
          <p className="muted">
            Fotografiere den Beleg, zeig deinen Freunden den QR-Code – jeder hakt ab, was er hatte, und zahlt dir den
            Betrag direkt per PayPal.
          </p>
          <label className="btn btn-primary btn-large">
            📷 Rechnung fotografieren
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => onPhoto(e.target.files?.[0])}
            />
          </label>
          <div className="row gap">
            <label className="btn btn-secondary grow">
              🖼️ Foto auswählen
              <input type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
            <button className="btn btn-secondary grow" onClick={startManual}>
              ✏️ Manuell erfassen
            </button>
          </div>
        </section>

        {!hasPayment && (
          <button className="notice" onClick={() => navigate("/settings")}>
            <strong>Zahlungsmethode hinterlegen</strong>
            <span>Damit deine Freunde dich bezahlen können, trag deinen PayPal.me-Namen oder deine IBAN ein. →</span>
          </button>
        )}

        <section>
          <h3 className="section-title">So funktioniert's</h3>
          <ol className="steps">
            <li>
              <strong>Foto machen</strong> – alle Positionen inkl. Mengen werden automatisch erkannt.
            </li>
            <li>
              <strong>Prüfen &amp; QR-Code zeigen</strong> – deine Zahlungsmethode steckt mit drin.
            </li>
            <li>
              <strong>Freunde scannen</strong>, haken ihre Posten ab und zahlen mit einem Klick.
            </li>
          </ol>
        </section>

        {bills.length > 0 && (
          <section>
            <h3 className="section-title">Meine Rechnungen</h3>
            <ul className="list">
              {bills.map((b) => (
                <li key={b.encoded} className="list-item">
                  <button className="list-main" onClick={() => navigate(`/share/${b.encoded}`)}>
                    <span className="list-title">{b.title || "Rechnung"}</span>
                    <span className="muted small">
                      {new Date(b.createdAt).toLocaleDateString("de-DE")} · {formatMoney(b.total, b.currency)}
                    </span>
                  </button>
                  <button className="icon-btn" aria-label="Entfernen" onClick={() => remove(b.encoded)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
