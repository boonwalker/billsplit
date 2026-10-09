import { useState, type FormEvent } from "react";
import Header from "../components/Header";
import { isValidEmail, normalizePaypalMe } from "../lib/payment";
import { navigate } from "../lib/router";
import { createSampleBill } from "../lib/sampleBill";
import { loadProfile, saveProfile } from "../lib/storage";

export default function Profile({ next }: { next?: string }) {
  const initial = loadProfile();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.paypalEmail);
  const [paypalMe, setPaypalMe] = useState(initial.paypalMe);
  const [touched, setTouched] = useState(false);
  const [notStored, setNotStored] = useState(false);

  const meName = normalizePaypalMe(paypalMe);
  const emailInvalid = email.trim() !== "" && !isValidEmail(email);
  const needsPaypal = (next === "new" || next === "sample") && !meName && !email.trim();
  const invalid = !name.trim() || emailInvalid || needsPaypal;

  function save(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    const stored = saveProfile({ name: name.trim(), paypalEmail: email.trim(), paypalMe: meName });
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
            Dein Profil bleibt auf diesem Gerät. Beim Erstellen einer Rechnung werden Name und PayPal-Daten in den QR-Code
            übernommen, damit deine Freunde dich bezahlen können.
          </p>

          <div className="card">
            <label className="field">
              <span>Profilname</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Niklas" maxLength={40} autoComplete="given-name" aria-invalid={touched && !name.trim()} />
              <small className="muted">So sehen dich deine Freunde auf der Rechnung.</small>
            </label>
          </div>

          <h3 className="section-title">PayPal – damit du dein Geld bekommst</h3>
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

          {touched && needsPaypal && <div className="alert">Bitte hinterlege eine PayPal-E-Mail-Adresse oder deinen PayPal.Me-Namen.</div>}

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
      </main>
    </div>
  );
}
