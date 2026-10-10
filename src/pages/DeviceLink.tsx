import { useState } from "react";
import Header from "../components/Header";
import OpenInApp from "../components/OpenInApp";
import { api } from "../lib/api";
import { deviceLinkUrl, takeOverDevice } from "../lib/deviceTransfer";
import { isIosBrowser } from "../lib/handoff";
import { navigate } from "../lib/router";
import { loadRecent } from "../lib/storage";

/** The new device opened (or scanned) the link from "Auf neues Gerät übertragen". */
export default function DeviceLink({ code }: { code: string }) {
  const [stage, setStage] = useState<"ask" | "busy" | "done">("ask");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const here = loadRecent().length;

  async function takeOver() {
    setStage("busy");
    setError(null);
    try {
      const { key, profile } = await api.claimDeviceLink(code);
      setCount(await takeOverDevice(key, profile));
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setStage("ask");
    }
  }

  return (
    <div className="page">
      <Header back="/" title="Gerät übernehmen" />
      <main className="content">
        {stage === "done" ? (
          <div className="card device-card">
            <p className="settle-done">✓ Übernommen</p>
            <p className="muted">
              {count === 0
                ? "Profil und Gerätekennung sind jetzt auf diesem Gerät."
                : `${count === 1 ? "Deine Rechnung ist" : `Deine ${count} Rechnungen sind`} jetzt auf diesem Gerät – mit Profil und Bilanz.`}
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={() => navigate("/", { replace: true })}>
              Zu Deinen Rechnungen
            </button>
          </div>
        ) : (
          <>
            {/* Safari and the home-screen app keep separate data: take it over where billsplit is used. */}
            {isIosBrowser() && <OpenInApp url={deviceLinkUrl(code)} />}
            <div className="card device-card">
              <h3>Rechnungen von Deinem anderen Gerät übernehmen?</h3>
              <p className="muted small">
                Dieses Gerät bekommt Deine Rechnungen, Dein Profil und Deine Bilanz. Auf dem alten Gerät funktioniert danach
                weiterhin alles.
              </p>
              {here > 0 && (
                <p className="alert">
                  Auf diesem Gerät {here === 1 ? "ist schon eine Rechnung" : `sind schon ${here} Rechnungen`} – {here === 1 ? "sie wird" : "sie werden"} dabei
                  ersetzt.
                </p>
              )}
              {error && <p className="alert">{error}</p>}
              <button type="button" className="btn btn-primary btn-large" disabled={stage === "busy"} onClick={takeOver}>
                {stage === "busy" ? "Wird übernommen …" : "Übernehmen"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/", { replace: true })}>
                Abbrechen
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
