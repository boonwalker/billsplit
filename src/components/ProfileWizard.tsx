import { useState, type FormEvent } from "react";
import { formatIban, isValidEmail, isValidIban, isValidWero, normalizeIban, normalizePaypalMe } from "../lib/payment";
import { loadOwnProfile, saveProfile } from "../lib/storage";
import { Wordmark } from "./Logo";

type Method = "paypal" | "bank" | "wero";

const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: "paypal", label: "PayPal", hint: "PayPal.Me-Name oder E-Mail" },
  { id: "bank", label: "Überweisung", hint: "IBAN – jede Bank" },
  { id: "wero", label: "Wero", hint: "Handynummer oder E-Mail" },
];

/**
 * Creating the profile like an assistant, one question at a time: the name (if not known
 * yet), then "Wie willst Du bezahlt werden?" – and only the way chosen needs its details.
 * - payer: pops up while the first receipt is being read, so the waiting time is used.
 * - guest: after paying their share, for the day they pay a bill themselves ("Später" skips it).
 */
export default function ProfileWizard({ role, onDone }: { role: "payer" | "guest"; onDone: (saved: boolean) => void }) {
  const initial = loadOwnProfile();
  const [step, setStep] = useState<"name" | "method" | "details">(initial.name.trim() ? "method" : "name");
  const [name, setName] = useState(initial.name);
  const [method, setMethod] = useState<Method | null>(null);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const invalid =
    method === "paypal"
      ? value.includes("@")
        ? !isValidEmail(value)
        : !normalizePaypalMe(value)
      : method === "bank"
        ? !isValidIban(value)
        : method === "wero"
          ? !isValidWero(value)
          : true;

  function save(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid || !method) return;
    const profile = { ...loadOwnProfile(), name: name.trim() };
    if (method === "paypal") {
      if (value.includes("@")) profile.paypalEmail = value.trim();
      else profile.paypalMe = normalizePaypalMe(value);
    } else if (method === "bank") {
      profile.iban = normalizeIban(value);
    } else {
      profile.wero = value.trim();
    }
    saveProfile(profile);
    onDone(true);
  }

  return (
    <div className="sheet-backdrop wizard-backdrop">
      {step === "name" ? (
        <form
          className="sheet wizard"
          key="name"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            saveProfile({ ...loadOwnProfile(), name: name.trim() });
            setStep("method");
          }}
        >
          <div className="sheet-logo" aria-hidden="true">
            <Wordmark size={44} />
          </div>
          {role === "payer" && <p className="wizard-step">Während billsplit Deinen Beleg liest …</p>}
          <h2>Wie heißt Du?</h2>
          <p className="muted">So sehen Dich Deine Freunde auf der Rechnung.</p>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" maxLength={40} autoComplete="given-name" />
          <button className="btn btn-primary btn-large" disabled={!name.trim()}>
            Weiter
          </button>
        </form>
      ) : step === "method" ? (
        <div className="sheet wizard" key="method" role="dialog" aria-label="Wie willst Du bezahlt werden?">
          {role === "guest" && <p className="wizard-step">✓ Erledigt. Und wenn Du mal eine Rechnung zahlst:</p>}
          <h2>Wie willst Du bezahlt werden?</h2>
          <p className="muted">
            {role === "payer" ? "Deine Freunde bezahlen Dich damit mit einem Tipp." : "Dann bezahlen Dich Deine Freunde mit einem Tipp."} Weitere Wege
            kannst Du später im Profil ergänzen.
          </p>
          <div className="wizard-methods">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className="btn btn-secondary btn-large wizard-method"
                onClick={() => {
                  setMethod(m.id);
                  setValue("");
                  setTouched(false);
                  setStep("details");
                }}
              >
                {m.label}
                <small>{m.hint}</small>
              </button>
            ))}
          </div>
          {role === "guest" && (
            <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>
              Später
            </button>
          )}
        </div>
      ) : (
        <form className="sheet wizard" key="details" onSubmit={save}>
          <h2>{method === "paypal" ? "PayPal" : method === "bank" ? "Überweisung" : "Wero"}</h2>
          <label className="field">
            <span>{method === "paypal" ? "PayPal.Me-Name oder E-Mail-Adresse" : method === "bank" ? "IBAN" : "Handynummer oder E-Mail für Wero"}</span>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => method === "bank" && isValidIban(value) && setValue(formatIban(value))}
              placeholder={method === "paypal" ? "z. B. niklas oder du@beispiel.de" : method === "bank" ? "DE00 0000 0000 0000 0000 00" : "+49 170 1234567"}
              inputMode={method === "wero" || method === "paypal" ? "email" : "text"}
              autoCapitalize={method === "bank" ? "characters" : "off"}
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={touched && invalid}
            />
            {touched && invalid ? (
              <small className="error">
                {method === "paypal"
                  ? "Bitte gib Deinen PayPal.Me-Namen oder Deine PayPal-E-Mail-Adresse ein."
                  : method === "bank"
                    ? "Diese IBAN stimmt nicht – bitte prüfe sie."
                    : "Bitte gib eine Handynummer oder E-Mail-Adresse ein."}
              </small>
            ) : (
              <small className="muted">
                {method === "paypal"
                  ? "Mit PayPal.Me landen Deine Freunde direkt im ausgefüllten Bezahlschritt (Empfänger und Betrag)."
                  : method === "bank"
                    ? "Deine Freunde kopieren IBAN und Betrag in ihre Banking-App."
                    : "Mit Wero in der Banking-App (z. B. Sparkasse, Volksbank, ING) senden Dir Deine Freunde Geld."}
              </small>
            )}
          </label>
          <button className="btn btn-primary btn-large">Profil speichern</button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep("method")}>
            Andere Zahlungsart
          </button>
        </form>
      )}
    </div>
  );
}
