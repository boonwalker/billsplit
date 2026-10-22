import { useState, type FormEvent } from "react";
import { formatIban, isValidEmail, isValidIban, isValidWero, normalizeIban, normalizePaypalMe } from "../lib/payment";
import { accountsAvailable, saveProfileEverywhere } from "../lib/account";
import { rich, t } from "../lib/i18n";
import { hasPaymentMethod, loadAccountEmail, loadOwnProfile, markAsked } from "../lib/storage";
import AccountForm from "./AccountForm";
import { Wordmark } from "./Logo";

type Method = "paypal" | "bank" | "wero";

const methods = (): { id: Method; label: string; hint: string }[] => [
  { id: "paypal", label: "PayPal", hint: t("PayPal.Me-Name oder E-Mail") },
  { id: "bank", label: t("Überweisung"), hint: t("IBAN – jede Bank") },
  { id: "wero", label: "Wero", hint: t("Handynummer oder E-Mail") },
];

/**
 * Creating the profile like an assistant, one question at a time: the name (if not known
 * yet), the e-mail address for the optional account (skippable), then "Wie willst Du bezahlt
 * werden?" – and only the way chosen needs its details. Signing in to an existing account may
 * already bring the payment details along; then the assistant ends there.
 * - payer: pops up while the first receipt is being read, so the waiting time is used.
 * - guest: after paying their share, for the day they pay a bill themselves ("Später" skips it).
 */
export default function ProfileWizard({
  role,
  hint = t("Während klicksplit Deinen Beleg liest …"),
  onDone,
}: {
  role: "payer" | "guest";
  /** The payer's line above the first question (while the receipt is read, by default). */
  hint?: string;
  /** switched: this device signed in to an existing account (it has another identity now). */
  onDone: (saved: boolean, switched?: boolean) => void;
}) {
  const initial = loadOwnProfile();
  const askEmail = accountsAvailable && !loadAccountEmail();
  const [first] = useState<"name" | "email" | "method">(initial.name.trim() ? (askEmail ? "email" : "method") : "name");
  const [step, setStep] = useState<"name" | "email" | "method" | "details">(first);
  const [switched, setSwitched] = useState(false);
  /** Signed in (or created the account) along the way: the e-mail step is done. */
  const [hasAccount, setHasAccount] = useState(false);
  /** "Schon ein Konto?" on the name step: the e-mail step came first, "Zurück" returns to the name. */
  const [fromName, setFromName] = useState(false);
  const emailNext = askEmail && !hasAccount;
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
    saveProfileEverywhere(profile);
    onDone(true, switched);
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
            saveProfileEverywhere({ ...loadOwnProfile(), name: name.trim() });
            setStep(emailNext ? "email" : "method");
          }}
        >
          <div className="sheet-logo" aria-hidden="true">
            <Wordmark size={44} />
          </div>
          {role === "payer" && <p className="wizard-step">{hint}</p>}
          <h2>{t("Wie heißt Du?")}</h2>
          <p className="muted">{t("So sehen Dich Deine Freunde auf der Rechnung.")}</p>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Dein Name")} maxLength={40} autoComplete="given-name" />
          <button className="btn btn-primary btn-large" disabled={!name.trim()}>
            {t("Weiter")}
          </button>
          {emailNext && (
            <button
              type="button"
              className="btn btn-ghost signin-link"
              onClick={() => {
                setFromName(true);
                setStep("email");
              }}
            >
              {rich(t("Schon ein Konto? <b>Anmelden</b>"))}
            </button>
          )}
        </form>
      ) : step === "email" ? (
        <div className="sheet wizard" key="email" role="dialog" aria-label={t("Deine E-Mail-Adresse")}>
          <AccountForm
            lead={role === "guest" && first === "email" ? <p className="wizard-step">{t("✓ Erledigt. Damit Du Deine Rechnungen überall wiederfindest:")}</p> : undefined}
            onDone={(result) => {
              const login = result === "login";
              if (login) setSwitched(true);
              setHasAccount(true);
              const profile = loadOwnProfile();
              // Signed in before giving a name: the account's name, or the question once more.
              if (!profile.name.trim()) {
                setStep("name");
                return;
              }
              setName(profile.name);
              // An existing account may already know how its owner gets paid.
              if (hasPaymentMethod(profile)) onDone(true, login);
              else setStep("method");
            }}
            onSkip={() => setStep(fromName ? "name" : "method")}
            skipLabel={fromName ? t("Zurück") : undefined}
          />
        </div>
      ) : step === "method" ? (
        <div className="sheet wizard" key="method" role="dialog" aria-label={t("Wie willst Du bezahlt werden?")}>
          {role === "guest" && <p className="wizard-step">
              {first === "method" ? t("✓ Erledigt. Und wenn Du mal eine Rechnung zahlst:") : t("Und wenn Du mal eine Rechnung zahlst:")}
            </p>}
          <h2>{t("Wie willst Du bezahlt werden?")}</h2>
          <p className="muted">
            {role === "payer" ? t("Deine Freunde bezahlen Dich damit mit einem Tipp.") : t("Dann bezahlen Dich Deine Freunde mit einem Tipp.")}{" "}
            {t("Weitere Wege kannst Du später im Profil ergänzen.")}
          </p>
          <div className="wizard-methods">
            {methods().map((m) => (
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
          {/* Never a dead end: without a way to get paid, friends mark their share as paid. */}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (role === "payer") markAsked("payment");
              onDone(false, switched);
            }}
          >
            {role === "guest" ? t("Später") : t("Überspringen")}
          </button>
        </div>
      ) : (
        <form className="sheet wizard" key="details" onSubmit={save}>
          <h2>{method === "paypal" ? "PayPal" : method === "bank" ? t("Überweisung") : "Wero"}</h2>
          <label className="field">
            <span>{method === "paypal" ? t("PayPal.Me-Name oder E-Mail-Adresse") : method === "bank" ? "IBAN" : t("Handynummer oder E-Mail für Wero")}</span>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => method === "bank" && isValidIban(value) && setValue(formatIban(value))}
              placeholder={method === "paypal" ? t("z.B. niklas oder du@beispiel.de") : method === "bank" ? "DE00 0000 0000 0000 0000 00" : "+49 170 1234567"}
              inputMode={method === "wero" || method === "paypal" ? "email" : "text"}
              autoCapitalize={method === "bank" ? "characters" : "off"}
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={touched && invalid}
            />
            {touched && invalid ? (
              <small className="error">
                {method === "paypal"
                  ? t("Bitte gib Deinen PayPal.Me-Namen oder Deine PayPal-E-Mail-Adresse ein.")
                  : method === "bank"
                    ? t("Diese IBAN stimmt nicht – bitte prüfe sie.")
                    : t("Bitte gib eine Handynummer oder E-Mail-Adresse ein.")}
              </small>
            ) : (
              <small className="muted">
                {method === "paypal"
                  ? t("Mit PayPal.Me landen Deine Freunde direkt im ausgefüllten Bezahlschritt (Empfänger und Betrag).")
                  : method === "bank"
                    ? t("Deine Freunde kopieren IBAN und Betrag in ihre Banking-App.")
                    : t("Mit Wero in der Banking-App (z.B. Sparkasse, Volksbank, ING) senden Dir Deine Freunde Geld.")}
              </small>
            )}
          </label>
          <button className="btn btn-primary btn-large">{t("Profil speichern")}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep("method")}>
            {t("Andere Zahlungsart")}
          </button>
        </form>
      )}
    </div>
  );
}
