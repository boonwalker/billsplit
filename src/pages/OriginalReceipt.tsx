import { useEffect, useState } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { DEMO } from "../lib/demo";

/** The photo or screenshot a bill was read from – reached via "Zum Originalbeleg". */
export default function OriginalReceipt({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

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
            <img className="original-photo" src={src} alt="Foto bzw. Screenshot der Rechnung" onError={() => setFailed(true)} />
            {!DEMO && (
              <a className="small muted original-full" href={src} target="_blank" rel="noreferrer">
                In voller Größe öffnen
              </a>
            )}
          </>
        )}
      </main>
    </div>
  );
}
