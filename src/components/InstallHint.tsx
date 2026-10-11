import OpenInApp from "./OpenInApp";

/**
 * Safari on the iPhone, after a friend set up their profile: billsplit belongs on the home
 * screen. "In der App öffnen" first copies the bill (with what was done here), then the app
 * is added and opened – and offers to open the copied link.
 */
export default function InstallHint({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet install-hint" role="dialog" aria-label="billsplit auf den Home-Bildschirm">
        <h2>billsplit auf Deinen Home-Bildschirm</h2>
        <p className="muted">Dann hast Du Deine Rechnungen, Deine Bilanz und Benachrichtigungen immer dabei – und Deine Freunde zahlen Dir mit einem Tipp.</p>
        <ol className="install-steps">
          <li>
            Tippe auf <b>„In der App öffnen“</b> – diese Rechnung und was Du hier abgehakt hast, kommen mit.
          </li>
          <li>
            Dann unten in Safari auf <b>Teilen</b>{" "}
            <svg className="install-share" viewBox="0 0 24 24" aria-label="Teilen-Symbol">
              <path d="M12 3v12M8 7l4-4 4 4" />
              <path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8" />
            </svg>{" "}
            und <b>„Zum Home-Bildschirm“</b>.
          </li>
          <li>
            billsplit dort öffnen und <b>„Kopierten Link öffnen“</b> tippen.
          </li>
        </ol>
        <OpenInApp url={url} carry compact />
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Später
        </button>
      </div>
    </div>
  );
}
