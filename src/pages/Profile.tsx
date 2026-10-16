import { CURRENCIES, chosenCurrency, deviceCurrency, setHomeCurrency } from "../lib/currency";
import { useState, type FormEvent } from "react";
import AccountSection from "../components/AccountSection";
import DeviceTransfer from "../components/DeviceTransfer";
import Header from "../components/Header";
import PushSetting from "../components/PushSetting";
import { LANG_NAMES, LANGS, type Lang } from "../i18n";
import { DEMO } from "../lib/demo";
import { chosenLang, setLang, t } from "../lib/i18n";
import { formatIban, isValidEmail, isValidIban, isValidWero, normalizeIban, normalizePaypalMe } from "../lib/payment";
import { navigate } from "../lib/router";
import { createSampleBill } from "../lib/sampleBill";
import { accountsAvailable, saveProfileEverywhere } from "../lib/account";
import { loadAccountEmail, loadProfile } from "../lib/storage";

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
    const stored = saveProfileEverywhere({
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
      <Header back="/" title={t("Profil")} />
      <main className="content">
        {/* At the top: whether this device is signed in, and signing out. Not while setting up the first bill, not in the demo. */}
        {!next && accountsAvailable && (
          <section className="stack account-section" id="konto">
            <h3 className="section-title">{t("Konto")}</h3>
            <AccountSection />
          </section>
        )}
        <form className="stack" onSubmit={save}>
          <p className="muted">
            {loadAccountEmail() ? t("Dein Profil ist in Deinem Konto gesichert.") : t("Dein Profil bleibt auf diesem Gerät.")}{" "}
            {t("Beim Erstellen einer Rechnung werden Name und Zahlungsdaten in den QR-Code übernommen, damit Deine Freunde Dich bezahlen können. Ein Zahlungsweg reicht, mehrere geben Deinen Freunden die Wahl.")}
          </p>

          <div className="card">
            <label className="field">
              <span>{t("Profilname")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("z. B. Niklas")} maxLength={40} autoComplete="given-name" aria-invalid={touched && !name.trim()} />
              <small className="muted">{t("So sehen Dich Deine Freunde auf der Rechnung.")}</small>
            </label>
          </div>

          <h3 className="section-title">PayPal</h3>
          <div className="card">
            <label className="field">
              <span>{t("PayPal-E-Mail-Adresse")}</span>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("du@beispiel.de")}
                autoCapitalize="off"
                autoComplete="email"
                aria-invalid={emailInvalid}
              />
              {emailInvalid && <small className="error">{t("Bitte prüfe die E-Mail-Adresse.")}</small>}
            </label>

            <label className="field">
              <span>
                {t("PayPal.Me-Name")} <em className="badge">{t("empfohlen")}</em>
              </span>
              <div className="input-prefix">
                <span>paypal.me/</span>
                <input value={paypalMe} onChange={(e) => setPaypalMe(e.target.value)} placeholder={t("deinname")} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              </div>
              <small className="muted">
                {t(
                  "Nur mit PayPal.Me landen Deine Freunde nach dem Login direkt im fertig ausgefüllten Bezahlschritt (Empfänger und Betrag). Mit reiner E-Mail-Adresse müssen sie den Betrag selbst eintragen. Deinen Namen findest Du in der PayPal-App unter „PayPal.Me“.",
                )}
              </small>
            </label>
            {meName && (
              <a className="small" href={`https://www.paypal.com/paypalme/${meName}`} target="_blank" rel="noreferrer">
                {t("Link testen: paypal.me/{name} ↗", { name: meName })}
              </a>
            )}
          </div>

          <h3 className="section-title">{t("Überweisung")}</h3>
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
                <small className="error">{t("Diese IBAN stimmt nicht – bitte prüfe sie.")}</small>
              ) : (
                <small className="muted">{t("Jede Bank, auch Trade Republic, N26 oder Revolut. Deine Freunde kopieren IBAN und Betrag in ihre Banking-App.")}</small>
              )}
            </label>
            {iban.trim() && (
              <label className="field">
                <span>{t("Kontoinhaber")}</span>
                <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder={name.trim() || t("Vor- und Nachname")} maxLength={70} autoComplete="name" />
                <small className="muted">{t("Leer lassen, wenn es Dein Profilname ist.")}</small>
              </label>
            )}
          </div>

          <h3 className="section-title">Wero</h3>
          <div className="card">
            <label className="field">
              <span>{t("Handynummer oder E-Mail für Wero")}</span>
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
                <small className="error">{t("Bitte gib eine Handynummer oder E-Mail-Adresse ein.")}</small>
              ) : (
                <small className="muted">{t("Mit Wero in der Banking-App (z. B. Sparkasse, Volksbank, ING, Postbank) senden Dir Deine Freunde Geld an diese Nummer.")}</small>
              )}
            </label>
          </div>

          {touched && needsPayment && <div className="alert">{t("Bitte hinterlege mindestens einen Zahlungsweg: PayPal, IBAN oder Wero.")}</div>}

          {notStored && (
            <div className="alert">
              {t(
                "Dein Browser lässt diese Seite gerade nichts dauerhaft speichern. Dein Profil gilt deshalb nur, bis Du den Tab schließt. Das passiert z. B. in einem privaten Tab, im eingebauten Browser anderer Apps oder wenn Cookies blockiert sind. Öffne klicksplit am besten direkt in Safari bzw. Chrome. Tippe erneut auf den Knopf, um trotzdem fortzufahren.",
              )}
            </div>
          )}

          <button className="btn btn-primary btn-large">{next === "new" ? t("Weiter zur Kamera") : next === "sample" ? t("Weiter zur Beispielrechnung") : t("Speichern")}</button>
        </form>

        {/* Not while setting up the profile for a first bill, and not in the demo (no server). */}
        {!next && !DEMO && (
          <section className="stack push-section">
            <PushSetting variant="setting" />
          </section>
        )}

        {/* The app's language: the device's, or one chosen here (reloads the app). */}
        {!next && (
          <section className="stack language-section">
            <h3 className="section-title">{t("Sprache")}</h3>
            <LanguageSetting />
          </section>
        )}

        {/* Balances in several currencies are added up in this one (ECB rates of the day). */}
        {!next && (
          <section className="stack currency-section">
            <h3 className="section-title">{t("Heimwährung")}</h3>
            <CurrencySetting />
          </section>
        )}
        {!next && !DEMO && (
          <section className="stack device-section">
            <h3 className="section-title">{t("Gerät wechseln & sichern")}</h3>
            <DeviceTransfer />
          </section>
        )}
      </main>
    </div>
  );
}

/** The currency the dashboard adds everything up in; "automatisch" follows the device's region. */
function CurrencySetting() {
  const [chosen, setChosen] = useState(chosenCurrency);
  return (
    <label className="field">
      <select
        aria-label={t("Heimwährung")}
        value={chosen ?? ""}
        onChange={(e) => {
          const value = e.target.value || null;
          setHomeCurrency(value);
          setChosen(value);
        }}
      >
        <option value="">{t("Automatisch ({currency})", { currency: deviceCurrency() })}</option>
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <small className="muted">{t("Rechnungen in anderen Währungen rechnet das Dashboard mit den Tageskursen der Europäischen Zentralbank in diese Währung um.")}</small>
    </label>
  );
}

/** "Wie Gerät" follows the device's language; the names of the languages stay in their own language. */
function LanguageSetting() {
  const current = chosenLang();
  const options: { value: Lang | null; label: string }[] = [{ value: null, label: t("Wie Gerät") }, ...LANGS.map((value) => ({ value, label: LANG_NAMES[value] }))];
  return (
    <div className="seg lang-seg" role="radiogroup" aria-label={t("Sprache")}>
      {options.map((o) => (
        <button
          key={o.value ?? "device"}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          className={current === o.value ? "on" : ""}
          lang={o.value ?? undefined}
          onClick={() => current !== o.value && setLang(o.value)}
        >
          <b>{o.label}</b>
        </button>
      ))}
    </div>
  );
}
