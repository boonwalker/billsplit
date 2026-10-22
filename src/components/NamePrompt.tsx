import { useState, type ReactNode } from "react";
import { accountsAvailable, type SignInResult } from "../lib/account";
import { rich, t } from "../lib/i18n";
import { loadAccountEmail } from "../lib/storage";
import AccountForm from "./AccountForm";
import { Wordmark } from "./Logo";

interface Props {
  ownerName: string;
  initialName?: string;
  onSubmit: (name: string) => void;
  /** Signed in instead ("Schon ein Konto?"); `name` is what had been typed so far. */
  onSignedIn: (result: SignInResult, name: string) => void;
  /** Shown below the button, e.g. the offer to open the bill in the home-screen app. */
  extra?: ReactNode;
}

/**
 * Asks friends for their profile name before they join a bill – or lets them sign in to their
 * account first, so whoever was here before joins as themselves (not as a second person).
 */
export default function NamePrompt({ ownerName, initialName = "", onSubmit, onSignedIn, extra }: Props) {
  const [name, setName] = useState(initialName);
  const [signingIn, setSigningIn] = useState(false);
  if (signingIn) {
    return (
      <div className="sheet-backdrop">
        <div className="sheet" role="dialog" aria-label={t("Deine E-Mail-Adresse")}>
          <AccountForm onDone={(result) => onSignedIn(result, name.trim())} onSkip={() => setSigningIn(false)} skipLabel={t("Zurück")} />
        </div>
      </div>
    );
  }
  return (
    <div className="sheet-backdrop">
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <div className="sheet-logo" aria-hidden="true">
          <Wordmark size={52} />
        </div>
        <h2>{t("Wie heißt Du?")}</h2>
        <p className="muted">
          {t("{name} hat die Rechnung bezahlt. Mit Deinem Namen sehen alle, welche Positionen Du übernimmst.", { name: ownerName || t("Jemand") })}
        </p>
        <input autoFocus={!initialName} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Dein Name")} maxLength={40} autoComplete="given-name" />
        <button className="btn btn-primary btn-large" disabled={!name.trim()}>
          {t("Zur Rechnung")}
        </button>
        {accountsAvailable && !loadAccountEmail() && (
          <button type="button" className="btn btn-ghost signin-link" onClick={() => setSigningIn(true)}>
            {rich(t("Schon ein Konto? <b>Anmelden</b>"))}
          </button>
        )}
        {extra}
      </form>
    </div>
  );
}
