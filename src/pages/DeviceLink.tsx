import { useState } from "react";
import Header from "../components/Header";
import OpenInApp from "../components/OpenInApp";
import { api } from "../lib/api";
import { deviceLinkUrl, takeOverDevice } from "../lib/deviceTransfer";
import { isIosBrowser } from "../lib/handoff";
import { t } from "../lib/i18n";
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
      setError(e instanceof Error ? e.message : t("Das hat nicht geklappt."));
      setStage("ask");
    }
  }

  return (
    <div className="page">
      <Header back="/" title={t("Gerät übernehmen")} />
      <main className="content">
        {stage === "done" ? (
          <div className="card device-card">
            <p className="settle-done">{t("✓ Übernommen")}</p>
            <p className="muted">
              {count === 0
                ? t("Profil und Gerätekennung sind jetzt auf diesem Gerät.")
                : count === 1
                  ? t("Deine Rechnung ist jetzt auf diesem Gerät – mit Profil und Bilanz.")
                  : t("Deine {count} Rechnungen sind jetzt auf diesem Gerät – mit Profil und Bilanz.", { count })}
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={() => navigate("/", { replace: true })}>
              {t("Zu Deinen Rechnungen")}
            </button>
          </div>
        ) : (
          <>
            {/* Safari and the home-screen app keep separate data: take it over where klicksplit is used. */}
            {isIosBrowser() && <OpenInApp url={deviceLinkUrl(code)} />}
            <div className="card device-card">
              <h3>{t("Rechnungen von Deinem anderen Gerät übernehmen?")}</h3>
              <p className="muted small">
                {t("Dieses Gerät bekommt Deine Rechnungen, Dein Profil und Deine Bilanz. Auf dem alten Gerät funktioniert danach weiterhin alles.")}
              </p>
              {here > 0 && (
                <p className="alert">
                  {here === 1
                    ? t("Auf diesem Gerät ist schon eine Rechnung – sie wird dabei ersetzt.")
                    : t("Auf diesem Gerät sind schon {count} Rechnungen – sie werden dabei ersetzt.", { count: here })}
                </p>
              )}
              {error && <p className="alert">{error}</p>}
              <button type="button" className="btn btn-primary btn-large" disabled={stage === "busy"} onClick={takeOver}>
                {stage === "busy" ? t("Wird übernommen …") : t("Übernehmen")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/", { replace: true })}>
                {t("Abbrechen")}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
