import { useEffect, useState } from "react";
import { billIdFromUrl } from "../lib/bill";
import { finishHandoff, handoffPending, isStandalone } from "../lib/handoff";
import { navigate } from "../lib/router";

/**
 * Home-screen app: shown only after the user came over from Safari ("In der App öffnen"),
 * opens the link they copied there.
 */
export default function HandoffPrompt() {
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isStandalone()) return;
    const check = () => {
      if (document.visibilityState === "visible") void handoffPending().then(setShow);
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  if (!show) return null;

  function close() {
    finishHandoff();
    setShow(false);
    setError(null);
  }

  async function openCopied() {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setError("Die Zwischenablage konnte nicht gelesen werden. Tippe nochmal und wähle „Einfügen“.");
      return;
    }
    const id = billIdFromUrl(text);
    if (!id) {
      setError("In der Zwischenablage ist kein billsplit-Link. Tippe in Safari nochmal auf „In der App öffnen“.");
      return;
    }
    close();
    navigate(`/b/${id}`);
  }

  return (
    <div className="handoff" role="dialog" aria-label="Rechnung aus Safari öffnen">
      <button type="button" className="handoff-close" aria-label="Schließen" onClick={close}>
        ✕
      </button>
      <p className="handoff-title">Aus Safari weitergeleitet</p>
      <p className="muted small">Die Rechnung, die Du in Safari geöffnet hast, liegt in Deiner Zwischenablage.</p>
      {error && <p className="handoff-error">{error}</p>}
      <button type="button" className="btn btn-primary btn-large" onClick={openCopied}>
        Kopierten Link öffnen
      </button>
    </div>
  );
}
