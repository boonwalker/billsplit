import { useState, type FormEvent } from "react";
import DeviceTransfer from "../components/DeviceTransfer";
import Header from "../components/Header";
import { DEMO } from "../lib/demo";
import { formatIban, isValidEmail, isValidIban, isValidWero, normalizeIban, normalizePaypalMe } from "../lib/payment";
import { navigate } from "../lib/router";
import { createSampleBill } from "../lib/sampleBill";
import { loadProfile, saveProfile } from "../lib/storage";

export default function Profile({ next }: { next?: string }) {
  const initial = loadProfile();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.paypalEmail);
  const [paypalMe, setPaypalMe] = useState(initial.paypalMe);
  const [iban, setIban] = useState(initial.iban ? formatIban(initial.iban) : "");
  const [holder, setHolder] = useState(initial.holder ?? "");
  const [wero, setWero] = useState(initial.wero ?? "");
  const [touched, setTouched] = useState(false);
  const [notStored, setNotStored] = useState(false);

  const meName = normalizePaypalMe(paypalMe);
  const emailInvalid = email.trim() !== "" && !isValidEmail(email);
  const ibanInvalid = iban.trim() !== "" && !isValidIban(iban);
  const weroInvalid = wero.trim() !== "" && !isValidWero(wero);
  const needsPayment = (next === "new" || next === "sample") && !meName && !email.trim() && !iban.trim() && !wero.trim();
  const invalid = !name.trim() || emailInvalid || ibanInvalid || weroInvalid || needsPayment;

  function save(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    const stored = saveProfile({
      name: name.trim(),
      paypalEmail: email.trim(),
      paypalMe: meName,
      iban: iban.trim() ? normalizeIban(iban) : "",
      holder: holder.trim(),
      wero: wero.trim(),
    });
    if (!stored && !notStored) {
      // Tell the user once; a second tap on the button continues anyway.
      setNotStored(true);
      return;
    }
    goNext();
  }

  function goNext() {
    if (next === "sample") navigate(`/b/${createSampleBill()}`);
    else navigate(next === "new" ? "/new" : "/");
  }

  return (
    <div className="page">
      <Header back="/" title="Profil" />
      <main className="content">
        <form className="stack" onSubmit={save}>
          <p className="muted">
            Dein Profil bleibt auf diesem Gerät. Beim Erstellen einer Rechnung werden Name und Zahlungsdaten in den QR-Code
            übernommen, damit deine Freunde dich bezahlen können. Ein Zahlungsweg reicht, mehrere geben deinen Freunden die
            Wahl.
          </p>

          <div className="card">
            <label className="field">
              <span>Profilname</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Niklas" maxLength={40} autoComplete="given-name" aria-invalid={touched && !name.trim()} />
              <small className="muted">So sehen dich deine Freunde auf der Rechnung.</small>
            </label>
          </div>

          <h3 className="section-title">PayPal</h3>
          <div className="card">
            <label className="field">
              <span>PayPal-E-Mail-Adresse</span>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@beispiel.de"
                autoCapitalize="off"
                autoComplete="email"
                aria-invalid={emailInvalid}
              />
              {emailInvalid && <small className="error">Bitte prüfe die E-Mail-Adresse.</small>}
            </label>

            <label className="field">
              <span>
                PayPal.Me-Name <em className="badge">empfohlen</em>
              </span>
              <div className="input-prefix">
                <span>paypal.me/</span>
                <input value={paypalMe} onChange={(e) => setPaypalMe(e.target.value)} placeholder="deinname" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              </div>
              <small className="muted">
                Nur mit PayPal.Me landen deine Freunde nach dem Login direkt im fertig ausgefüllten Bezahlschritt (Empfänger und
                Betrag). Mit reiner E-Mail-Adresse müssen sie den Betrag selbst eintragen. Deinen Namen findest du in der
                PayPal-App unter „PayPal.Me“.
              </small>
            </label>
            {meName && (
              <a className="small" href={`https://www.paypal.com/paypalme/${meName}`} target="_blank" rel="noreferrer">
                Link testen: paypal.me/{meName} ↗
              </a>
            )}
          </div>

          <h3 className="section-title">Überweisung</h3>
          <div className="card">
            <label className="field">
              <span>IBAN</span>
              <input
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                onBlur={() => isValidIban(iban) && setIban(formatIban(iban))}
                placeholder="DE00 0000 0000 0000 0000 00"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                aria-invalid={ibanInvalid}
              />
              {ibanInvalid ? (
                <small className="error">Diese IBAN stimmt nicht – bitte prüfe sie.</small>
              ) : (
                <small className="muted">Jede Bank, auch Trade Republic, N26 oder Revolut. Deine Freunde kopieren IBAN und Betrag in ihre Banking-App.</small>
              )}
            </label>
            {iban.trim() && (
              <label className="field">
                <span>Kontoinhaber</span>
                <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder={name.trim() || "Vor- und Nachname"} maxLength={70} autoComplete="name" />
                <small className="muted">Leer lassen, wenn es dein Profilname ist.</small>
              </label>
            )}
          </div>

          <h3 className="section-title">Wero</h3>
          <div className="card">
            <label className="field">
              <span>Handynummer oder E-Mail für Wero</span>
              <input
                value={wero}
                onChange={(e) => setWero(e.target.value)}
                placeholder="+49 170 1234567"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={weroInvalid}
              />
              {weroInvalid ? (
                <small className="error">Bitte gib eine Handynummer oder E-Mail-Adresse ein.</small>
              ) : (
                <small className="muted">Mit Wero in der Banking-App (z. B. Sparkasse, Volksbank, ING, Postbank) senden dir deine Freunde Geld an diese Nummer.</small>
              )}
            </label>
          </div>

          {touched && needsPayment && <div className="alert">Bitte hinterlege mindestens einen Zahlungsweg: PayPal, IBAN oder Wero.</div>}

          {notStored && (
            <div className="alert">
              Dein Browser lässt diese Seite gerade nichts dauerhaft speichern. Dein Profil gilt deshalb nur, bis du den Tab
              schließt. Das passiert z. B. in einem privaten Tab, im eingebauten Browser anderer Apps oder wenn Cookies
              blockiert sind. Öffne billsplit am besten direkt in Safari bzw. Chrome. Tippe erneut auf den Knopf, um
              trotzdem fortzufahren.
            </div>
          )}

          <button className="btn btn-primary btn-large">{next === "new" ? "Weiter zur Kamera" : next === "sample" ? "Weiter zur Beispielrechnung" : "Speichern"}</button>
        </form>

        {/* Not while setting up the profile for a first bill, and not in the demo (no server). */}
        {!next && !DEMO && (
          <section className="stack device-section">
            <h3 className="section-title">Gerät wechseln &amp; sichern</h3>
            <DeviceTransfer />
          </section>
        )}
      </main>
    </div>
  );
}
