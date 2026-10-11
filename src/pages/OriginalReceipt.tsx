import { useEffect, useState } from "react";
import Header from "../components/Header";
import PhotoViewer from "../components/PhotoViewer";
import { api } from "../lib/api";
import { t } from "../lib/i18n";

/** The photo or screenshot a bill was read from – reached via "Zum Originalbeleg". */
export default function OriginalReceipt({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    api
      .receiptImageUrl(id)
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [id]);

  const missing = src === null || failed;

  return (
    <div className="page">
      <Header back={`/b/${id}`} title={t("Originalbeleg")} />
      <main className="content original">
        {src === undefined && <div className="spinner" aria-label={t("Lädt")} />}
        {missing && (
          <div className="empty-state">
            <div className="empty-emoji">🧾</div>
            <h2>{t("Kein Originalbeleg")}</h2>
            <p className="muted">{t("Zu dieser Rechnung wurde kein Foto gespeichert.")}</p>
          </div>
        )}
        {src && !failed && (
          <>
            <button type="button" className="original-open" onClick={() => setFullscreen(true)} aria-label={t("In voller Größe anzeigen")}>
              <img className="original-photo" src={src} alt={t("Foto bzw. Screenshot der Rechnung")} onError={() => setFailed(true)} />
            </button>
            <button type="button" className="original-full" onClick={() => setFullscreen(true)}>
              {t("In voller Größe anzeigen")}
            </button>
            {fullscreen && <PhotoViewer src={src} alt={t("Originalbeleg")} onClose={() => setFullscreen(false)} />}
          </>
        )}
      </main>
    </div>
  );
}
