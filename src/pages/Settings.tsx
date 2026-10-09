import { useState } from "react";
import Header from "../components/Header";
import { formatIban, isValidIban, normalizeIban, normalizePaypalUser } from "../lib/payment";
import { navigate } from "../lib/router";
import { loadSettings, saveSettings } from "../lib/storage";

export default function Settings() {
  const initial = loadSettings();
  const [name, setName] = useState(initial.name);
  const [paypal, setPaypal] = useState(initial.payment.paypal ?? "");
  const [iban, setIban] = useState(initial.payment.iban ? formatIban(initial.payment.iban) : "");
  const [holder, setHolder] = useState(initial.payment.accountHolder ?? "");
  const [cash, setCash] = useState(Boolean(initial.payment.cash));

  const paypalUser = normalizePaypalUser(paypal);
  const ibanInvalid = iban.trim() !== "" && !isValidIban(iban);

  function save() {
    if (ibanInvalid) return;
    saveSettings({
      name: name.trim(),
      payment: {
        paypal: paypalUser || undefined,
        iban: iban.trim() ? normalizeIban(iban) : undefined,
        accountHolder: holder.trim() || undefined,
        cash,
      },
    });
    navigate("/");
  }

  return (
    <div className="page">
      <Header title="Einstellungen" back="/" />
      <main className="content">
        <p className="muted">
          Diese Angaben werden nur auf deinem Gerät gespeichert und beim Erstellen einer Rechnung in den QR-Code
          übernommen.
        </p>

        <div className="card">
          <label className="field">
            <span>Dein Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Niklas" autoComplete="given-name" />
          </label>
        </div>

        <h3 className="section-title">Bevorzugte Zahlungsmethoden</h3>
        <div className="card">
          <label className="field">
            <span>PayPal.me-Name</span>
            <div className="input-prefix">
              <span>paypal.me/</span>
              <input
                value={paypal}
                onChange={(e) => setPaypal(e.target.value)}
                placeholder="deinname"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <small className="muted">
              Deinen Link findest du in der PayPal-App unter „PayPal.me“. Du kannst auch den kompletten Link einfügen.
            </small>
          </label>
          {paypalUser && (
            <a className="small" href={`https://www.paypal.com/paypalme/${paypalUser}`} target="_blank" rel="noreferrer">
              Link testen: paypal.me/{paypalUser} ↗
            </a>
          )}
        </div>

        <div className="card">
          <label className="field">
            <span>IBAN für Überweisung (optional)</span>
            <input
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              onBlur={() => !ibanInvalid && iban && setIban(formatIban(iban))}
              placeholder="DE00 0000 0000 0000 0000 00"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={ibanInvalid}
            />
            {ibanInvalid && <small className="error">Diese IBAN scheint nicht gültig zu sein.</small>}
          </label>
          <label className="field">
            <span>Kontoinhaber</span>
            <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Vor- und Nachname" />
          </label>
        </div>

        <div className="card">
          <label className="toggle">
            <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} />
            <span>Barzahlung ist auch okay</span>
          </label>
        </div>

        <button className="btn btn-primary btn-large" onClick={save} disabled={ibanInvalid}>
          Speichern
        </button>
      </main>
    </div>
  );
}
