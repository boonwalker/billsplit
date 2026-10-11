import { useEffect, useState } from "react";
import BusyScreen from "../components/BusyScreen";
import { ShareIcon } from "../components/InstallHint";
import OpenInApp from "../components/OpenInApp";
import { api } from "../lib/api";
import { deviceLinkUrl } from "../lib/deviceTransfer";
import { isIosBrowser } from "../lib/handoff";
import { finishMove, safeTarget } from "../lib/move";
import { navigate } from "../lib/router";
import { loadOwnProfile } from "../lib/storage";

/** A code works once: the take-over runs once per page, even when React mounts twice. */
const moves = new Map<string, Promise<void>>();

/**
 * The new address, opened from the old one (see move.ts): takes over the data that came
 * along, then shows the page that was open there. Coming from the home-screen app on the
 * iPhone, it first explains how to get klicksplit onto the home screen again.
 */
export default function Move({ code, target, app }: { code: string; target?: string; app: boolean }) {
  const [install, setInstall] = useState<string | null>(null);
  const next = safeTarget(target);

  useEffect(() => {
    let cancelled = false;
    if (!moves.has(code)) moves.set(code, finishMove(code));
    void moves
      .get(code)!
      // Without the data (e.g. an expired code) the page still opens: the old address keeps everything.
      .catch(() => {})
      .then(async () => {
        if (cancelled) return;
        if (!app || !isIosBrowser()) return navigate(next, { replace: true });
        // Safari and the home-screen app keep separate data: the new app takes it over with a code.
        const link = await api.createDeviceLink(loadOwnProfile()).catch(() => null);
        if (cancelled) return;
        if (link) setInstall(link.code);
        else navigate(next, { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [code, app, next]);

  if (!install) return <BusyScreen message="klicksplit zieht um" />;

  return (
    <div className="page">
      <div className="sheet-backdrop">
        <div className="sheet install-hint" role="dialog" aria-label="klicksplit neu auf den Home-Bildschirm">
          <h2>Fast geschafft!</h2>
          <p className="muted">
            Deine Rechnungen sind jetzt auf <b>{window.location.host}</b>. Hol Dir klicksplit von hier neu auf Deinen Home-Bildschirm:
          </p>
          <ol className="install-steps">
            <li>
              Tippe auf <b>„In der App öffnen“</b> – Deine Rechnungen kommen mit.
            </li>
            <li>
              Dann unten in Safari auf <b>Teilen</b> <ShareIcon /> und <b>„Zum Home-Bildschirm“</b>.
            </li>
            <li>
              klicksplit dort öffnen und <b>„Kopierten Link öffnen“</b> tippen.
            </li>
            <li>Die alte klicksplit-App vom Home-Bildschirm löschen.</li>
          </ol>
          <OpenInApp url={deviceLinkUrl(install)} compact />
          <button type="button" className="btn btn-ghost" onClick={() => navigate(next, { replace: true })}>
            Später
          </button>
        </div>
      </div>
    </div>
  );
}
