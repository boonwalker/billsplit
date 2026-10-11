import { useEffect, useState } from "react";
import { deleteAccount, refreshAccount, signOut } from "../lib/account";
import { navigate } from "../lib/router";
import { loadAccountEmail } from "../lib/storage";
import AccountForm from "./AccountForm";

/** The optional e-mail account on the profile page: sign in or create it, sign out, delete it. */
export default function AccountSection() {
  const [email, setEmail] = useState(loadAccountEmail);
  const [ask, setAsk] = useState<"signout" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  // The server knows best (the account may have been deleted or joined on another device).
  useEffect(() => {
    void refreshAccount().then(setEmail);
  }, []);

  if (!email) {
    return (
      <div className="card account-card">
        <AccountForm
          heading={false}
          onDone={(result) => {
            // Signed in to an existing account: this device has its bills now.
            if (result === "login") navigate("/", { replace: true });
            else {
              setCreated(true);
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
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card account-card">
      {created && <p className="settle-done">✓ Konto angelegt</p>}
      <p>
        Angemeldet als <b>{email}</b>
      </p>
      <p className="muted small">
        Deine Rechnungen, Dein Profil und Deine Bilanz hängen an diesem Konto. Auf einem anderen Gerät meldest Du Dich mit
        derselben Adresse an – dann ist dort alles da.
      </p>
      {error && <p className="alert">{error}</p>}
      {ask === "signout" ? (
        <div className="account-ask">
          <p className="small">Auf diesem Gerät abmelden? Deine Rechnungen bleiben im Konto; das Gerät startet danach leer.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await signOut();
              navigate("/", { replace: true });
            }}
          >
            Ja, abmelden
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
            Abbrechen
          </button>
        </div>
      ) : ask === "delete" ? (
        <div className="account-ask">
          <p className="small">
            Konto löschen? Die E-Mail-Adresse wird gelöscht. Deine Rechnungen bleiben auf diesem Gerät, auf anderen Geräten
            kannst Du Dich dann aber nicht mehr damit anmelden.
          </p>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>
            {busy ? "Wird gelöscht …" : "Ja, Konto löschen"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <div className="account-links">
          <button type="button" className="btn btn-ghost" onClick={() => setAsk("signout")}>
            Abmelden
          </button>
          <button type="button" className="btn btn-ghost danger-text" onClick={() => setAsk("delete")}>
            Konto löschen
          </button>
        </div>
      )}
    </div>
  );
}
