import { useEffect, useState } from "react";
import { deleteAccount, refreshAccount, signOut } from "../lib/account";
import { t } from "../lib/i18n";
import { navigate } from "../lib/router";
import { loadAccountEmail, loadOwnProfile } from "../lib/storage";
import AccountForm from "./AccountForm";

/**
 * The optional e-mail account, at the top of the profile page: who is signed in (and signing
 * out, deleting) – or an invitation to sign in or create one.
 */
export default function AccountSection() {
  const [email, setEmail] = useState(loadAccountEmail);
  const [ask, setAsk] = useState<"signout" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // The server knows best (the account may have been deleted or joined on another device).
  useEffect(() => {
    void refreshAccount().then(setEmail);
  }, []);

  if (!email && !signingIn) {
    return (
      <div className="card account-card">
        <p className="account-status">
          <span className="account-dot off" aria-hidden="true" />
          {t("Nicht angemeldet")}
        </p>
        <p className="muted small">{t("Mit Deiner E-Mail-Adresse sind Deine Rechnungen auf jedem Gerät da – ohne Passwort, mit einem Code per Mail.")}</p>
        <button type="button" className="btn btn-secondary" onClick={() => setSigningIn(true)}>
          {t("Anmelden oder Konto anlegen")}
        </button>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="card account-card">
        <AccountForm
          onSkip={() => setSigningIn(false)}
          skipLabel={t("Abbrechen")}
          heading={false}
          onDone={(result) => {
            // Signed in to an existing account: this device has its bills now.
            if (result === "login") navigate("/", { replace: true });
            else {
              setCreated(true);
              setSigningIn(false);
              setEmail(loadAccountEmail());
            }
          }}
        />
      </div>
    );
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      setEmail(null);
      setAsk(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Das hat nicht geklappt."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card account-card">
      {created && <p className="settle-done">{t("✓ Konto angelegt")}</p>}
      <div className="account-who">
        <span className="account-avatar" aria-hidden="true">
          {(loadOwnProfile().name.trim() || email).slice(0, 1).toUpperCase()}
        </span>
        <span>
          <span className="account-status">
            <span className="account-dot" aria-hidden="true" />
            {t("Angemeldet")}
          </span>
          <b className="account-email">{email}</b>
        </span>
      </div>
      <p className="muted small">
        {t("Deine Rechnungen, Dein Profil und Deine Bilanz hängen an diesem Konto. Auf einem anderen Gerät meldest Du Dich mit derselben Adresse an – dann ist dort alles da.")}
      </p>
      {error && <p className="alert">{error}</p>}
      {ask === "signout" ? (
        <div className="account-ask">
          <p className="small">{t("Auf diesem Gerät abmelden? Deine Rechnungen bleiben im Konto; das Gerät startet danach leer.")}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await signOut();
              navigate("/", { replace: true });
            }}
          >
            {t("Ja, abmelden")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
            {t("Abbrechen")}
          </button>
        </div>
      ) : ask === "delete" ? (
        <div className="account-ask">
          <p className="small">
            {t("Konto löschen? Die E-Mail-Adresse wird gelöscht. Deine Rechnungen bleiben auf diesem Gerät, auf anderen Geräten kannst Du Dich dann aber nicht mehr damit anmelden.")}
          </p>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>
            {busy ? t("Wird gelöscht …") : t("Ja, Konto löschen")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
            {t("Abbrechen")}
          </button>
        </div>
      ) : (
        <div className="account-links">
          <button type="button" className="btn btn-ghost" onClick={() => setAsk("signout")}>
            {t("Abmelden")}
          </button>
          <button type="button" className="btn btn-ghost danger-text" onClick={() => setAsk("delete")}>
            {t("Konto löschen")}
          </button>
        </div>
      )}
    </div>
  );
}
