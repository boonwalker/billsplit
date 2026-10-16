import { useState, type FormEvent, type ReactNode } from "react";
import { confirmCode, type SignInResult } from "../lib/account";
import { api } from "../lib/api";
import { rich, t } from "../lib/i18n";
import { isValidEmail } from "../lib/payment";
import { loadAccountLost, loadOwnProfile } from "../lib/storage";

/**
 * E-mail and code, the two steps of the optional account. Used in the profile assistant
 * (with "Überspringen") and on the profile page.
 */
export default function AccountForm({
  onDone,
  onSkip,
  skipLabel = t("Überspringen"),
  lead,
  heading = true,
}: {
  onDone: (result: SignInResult) => void;
  onSkip?: () => void;
  skipLabel?: string;
  /** A line above the heading (e.g. "✓ Erledigt."). */
  lead?: ReactNode;
  /** Without it the step titles are left out (the page has its own). */
  heading?: boolean;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  // Signed out because the server lost the account: the address is already filled in.
  const [email, setEmail] = useState(() => loadAccountLost() ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!isValidEmail(email)) {
      setError(t("Bitte prüfe die E-Mail-Adresse."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.requestCode(email.trim(), loadOwnProfile().name.trim() || undefined);
      setStep("code");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Das hat nicht geklappt."));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await confirmCode(email.trim(), value));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Das hat nicht geklappt."));
      setBusy(false);
    }
  }

  if (step === "email") {
    return (
      <form className="account-form" onSubmit={send}>
        {lead}
        {heading && <h2>{t("Deine E-Mail-Adresse")}</h2>}
        <p className="muted">
          {t("Damit findest Du Deine Rechnungen auf jedem Gerät wieder – auch auf einem neuen Handy. Kein Passwort: Du bekommst einen Code per Mail.")}
        </p>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("Deine E-Mail-Adresse")}
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={t("E-Mail-Adresse")}
        />
        {error && <p className="alert">{error}</p>}
        <button className="btn btn-primary btn-large" disabled={busy || !email.trim()}>
          {busy ? t("Wird gesendet …") : t("Code senden")}
        </button>
        <small className="muted account-privacy">{t("Nur für die Anmeldung, keine Werbung. Löschen kannst Du das Konto jederzeit im Profil.")}</small>
        {onSkip && (
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            {skipLabel}
          </button>
        )}
      </form>
    );
  }

  return (
    <form
      className="account-form"
      onSubmit={(e) => {
        e.preventDefault();
        void confirm();
      }}
    >
      {heading && <h2>{t("Code eingeben")}</h2>}
      <p className="muted">
        {rich(t("Wir haben Dir einen 6-stelligen Code an <b>{email}</b> geschickt. Schau auch im Spam-Ordner nach.", { email: email.trim() }))}
      </p>
      <input
        className="code-input"
        value={code}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(digits);
          // Pasted or filled in from the mail: confirm right away.
          if (digits.length === 6) void confirm(digits);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-label={t("Code aus der Mail")}
        autoFocus
      />
      {error && <p className="alert">{error}</p>}
      <button className="btn btn-primary btn-large" disabled={busy || code.length !== 6}>
        {busy ? t("Wird geprüft …") : t("Bestätigen")}
      </button>
      <div className="account-links">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void send()}
        >
          {t("Neuer Code")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
        >
          {t("Andere Adresse")}
        </button>
      </div>
      {onSkip && (
        <button type="button" className="btn btn-ghost" onClick={onSkip}>
          {skipLabel}
        </button>
      )}
    </form>
  );
}
