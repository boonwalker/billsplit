import { useEffect, useState } from "react";
import { disablePush, enablePush, pushState, type PushState } from "../lib/push";

const ASKED_KEY = "billsplit.pushAsked";

function asked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Notifications when money arrives or a payment waits for me.
 * - "prompt": a card in the dashboard while they are off, until turned on or "Nicht jetzt".
 * - "setting": the switch in the profile, always with the current state.
 */
export default function PushSetting({ variant }: { variant: "prompt" | "setting" }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(asked);

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  async function change(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      setState(await (on ? enablePush() : disablePush()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      // only for this visit then
    }
    setDismissed(true);
  }

  if (variant === "prompt") {
    if (state !== "off" || dismissed) return null;
    return (
      <div className="card push-prompt">
        <h4>Benachrichtigen, wenn Geld eingeht?</h4>
        <p className="muted small">billsplit sagt Dir Bescheid, wenn Dir jemand etwas sendet, eine Zahlung Deine Bestätigung braucht oder Deine Zahlung bestätigt wurde.</p>
        {error && <p className="alert">{error}</p>}
        <div className="inbox-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void change(true)}
          >
            Einschalten
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={dismiss}>
            Nicht jetzt
          </button>
        </div>
      </div>
    );
  }

  if (state === null || state === "unsupported") return null;
  return (
    <div className="card push-setting">
      {state === "needs-app" ? (
        <p className="muted small">
          Benachrichtigungen gibt es auf dem iPhone nur in der billsplit-App vom Home-Bildschirm: In Safari auf „Teilen“ → „Zum
          Home-Bildschirm“ tippen und billsplit dort öffnen.
        </p>
      ) : state === "denied" ? (
        <p className="muted small">Benachrichtigungen sind für billsplit blockiert. Du kannst sie in den Einstellungen Deines Geräts wieder erlauben.</p>
      ) : (
        <>
          <label className="push-switch">
            <span>
              <b>Benachrichtigungen</b>
              <small className="muted">Wenn Dir jemand etwas sendet, bezahlt oder Deine Zahlung bestätigt.</small>
            </span>
            {/* Safari draws it as an iOS switch with the "switch" attribute (React does not know it yet). */}
            <input ref={(el) => el?.setAttribute("switch", "")} type="checkbox" role="switch" checked={state === "on"} disabled={busy} onChange={(e) => void change(e.target.checked)} />
          </label>
          {error && <p className="alert">{error}</p>}
        </>
      )}
    </div>
  );
}
