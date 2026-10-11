import { useEffect, useState } from "react";
import { isStandalone } from "../lib/handoff";
import { rich, t } from "../lib/i18n";
import { currentPath, moveCode, moveUrl, newHome } from "../lib/move";

/** A one-time code is valid for 10 minutes; a fresh one is fetched a little before. */
const REFRESH_MS = 8 * 60 * 1000;
const LATER_KEY = "billsplit.moveLater";

function later(): boolean {
  try {
    return sessionStorage.getItem(LATER_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The home-screen app at the old address (see move.ts): it keeps working, but asks to move –
 * the link opens the new address in the browser and takes this app's data along.
 */
export default function MovedNotice() {
  const [home] = useState(() => (isStandalone() ? newHome() : null));
  const [hidden, setHidden] = useState(later);
  const [code, setCode] = useState<string | null>(null);

  // Fetched ahead: the link must open right in the tap.
  useEffect(() => {
    if (!home || hidden) return;
    let cancelled = false;
    const fetchCode = () => void moveCode().then((c) => !cancelled && setCode(c), () => {});
    fetchCode();
    const timer = window.setInterval(fetchCode, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [home, hidden]);

  if (!home || hidden) return null;
  const host = new URL(home).host;

  function close() {
    try {
      sessionStorage.setItem(LATER_KEY, "1");
    } catch {
      // Then it shows again next time – no harm.
    }
    setHidden(true);
  }

  return (
    <div className="sheet-backdrop">
      <div className="sheet install-hint" role="dialog" aria-label={t("klicksplit ist umgezogen")}>
        <h2>{t("klicksplit ist umgezogen")}</h2>
        <p className="muted">
          {rich(t("Ab jetzt findest Du klicksplit unter <b>{host}</b>. Hier funktioniert vorerst alles weiter – so ziehst Du mit um:", { host }))}
        </p>
        <ol className="install-steps">
          <li>
            {rich(t("Tippe auf <b>„{host} öffnen“</b> – Deine Rechnungen, Dein Profil und Deine Bilanz kommen mit.", { host }))}
          </li>
          <li>{t("Dort holst Du Dir klicksplit neu auf den Home-Bildschirm.")}</li>
          <li>{t("Danach diese alte App vom Home-Bildschirm löschen.")}</li>
        </ol>
        <a className="btn btn-primary btn-large" href={code ? moveUrl(home, code, currentPath(), true) : `${home}/`} target="_blank" rel="noopener">
          {t("{host} öffnen", { host })}
        </a>
        <button type="button" className="btn btn-ghost" onClick={close}>
          {t("Später")}
        </button>
      </div>
    </div>
  );
}
