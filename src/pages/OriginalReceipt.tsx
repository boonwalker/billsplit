import { useEffect, useState } from "react";
import Header from "../components/Header";
import PhotoViewer from "../components/PhotoViewer";
import { api } from "../lib/api";

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
      <Header back={`/b/${id}`} title="Originalbeleg" />
      <main className="content original">
        {src === undefined && <div className="spinner" aria-label="Lädt" />}
        {missing && (
          <div className="empty-state">
            <div className="empty-emoji">🧾</div>
            <h2>Kein Originalbeleg</h2>
            <p className="muted">Zu dieser Rechnung wurde kein Foto gespeichert.</p>
          </div>
        )}
        {src && !failed && (
          <>
            <button type="button" className="original-open" onClick={() => setFullscreen(true)} aria-label="In voller Größe anzeigen">
              <img className="original-photo" src={src} alt="Foto bzw. Screenshot der Rechnung" onError={() => setFailed(true)} />
            </button>
            <button type="button" className="original-full" onClick={() => setFullscreen(true)}>
              In voller Größe anzeigen
            </button>
            {fullscreen && <PhotoViewer src={src} alt="Originalbeleg" onClose={() => setFullscreen(false)} />}
          </>
        )}
      </main>
    </div>
  );
}
