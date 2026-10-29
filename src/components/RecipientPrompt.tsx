import { useState } from "react";
import { accountsAvailable, type SignInResult } from "../lib/account";
import { rich, t } from "../lib/i18n";
import { loadAccountEmail } from "../lib/storage";
import AccountForm from "./AccountForm";
import { Wordmark } from "./Logo";
import OpenInApp from "./OpenInApp";

/**
 * Safari on the iPhone, opened from a reminder ("?fuer="): the person it is for is in the bill
 * already – in their home-screen app (or on another device). Instead of asking a name (a second
 * them in the bill), offer the app first, then the account, then going on here in the browser.
 */
export default function RecipientPrompt({
  name,
  usesApp,
  url,
  onSignedIn,
  onBrowser,
}: {
  name: string;
  usesApp: boolean;
  url: string;
  onSignedIn: (result: SignInResult) => void;
  onBrowser: () => void;
}) {
  const [signingIn, setSigningIn] = useState(false);
  if (signingIn) {
    return (
      <div className="sheet-backdrop">
        <div className="sheet" role="dialog" aria-label={t("Deine E-Mail-Adresse")}>
          <AccountForm onDone={onSignedIn} onSkip={() => setSigningIn(false)} skipLabel={t("Zurück")} />
        </div>
      </div>
    );
  }
  return (
    <div className="sheet-backdrop">
      <div className="sheet recipient-prompt" role="dialog" aria-label={t("Hi {name}!", { name })}>
        <div className="sheet-logo" aria-hidden="true">
          <Wordmark size={52} />
        </div>
        <h2>{t("Hi {name}!", { name })}</h2>
        <p className="muted">
          {usesApp
            ? t("Du bist schon in dieser Rechnung. Öffne sie in Deiner klicksplit-App – dort ist alles gespeichert.")
            : t("Du bist schon in dieser Rechnung – auf dem Gerät, mit dem Du beigetreten bist. Hast Du klicksplit dort als App, öffne sie dort.")}
        </p>
        <OpenInApp url={url} compact direct />
        {accountsAvailable && !loadAccountEmail() && (
          <button type="button" className="btn btn-ghost signin-link" onClick={() => setSigningIn(true)}>
            {rich(t("Schon ein Konto? <b>Anmelden</b>"))}
          </button>
        )}
        <button type="button" className="link recipient-browser" onClick={onBrowser}>
          {t("Hier im Browser weiter")}
        </button>
      </div>
    </div>
  );
}
