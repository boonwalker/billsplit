import type { CSSProperties } from "react";
import Header from "./Header";

/**
 * Waiting in the editor. Reading a receipt: the photo as large as the screen allows, with the
 * scanning beam. Creating the bill ("Rechnung erstellen"): only the dots and a line of text.
 */
export default function BusyScreen({
  message,
  progress,
  preview,
  previewRatio,
  creating,
}: {
  message: string;
  progress?: number;
  preview?: string | null;
  previewRatio?: number;
  creating?: boolean;
}) {
  const dots = (
    <div className="dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
  if (creating) {
    return (
      <div className="page loading-page">
        <Header back="/" />
        <main className="content center-v">
          <div className="scanning creating" role="status">
            {dots}
            <p className="scan-msg">{message}</p>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="page loading-page">
      <Header back="/" />
      <main className={`content center-v${preview ? " scan-content" : ""}`}>
        <div className="scanning" role="status">
          {preview && (
            // As large as the screen allows in the photo's own shape, so the payer can already look it over.
            <div className="scan-photo" style={{ "--ar": previewRatio } as CSSProperties}>
              <img className="scan-photo-img" src={preview} alt="Dein Beleg" decoding="async" />
              <div className="scan-beam" aria-hidden="true">
                <i />
              </div>
            </div>
          )}
          <p className="scan-msg">{message}</p>
          {progress !== undefined ? <progress max={1} value={progress} /> : dots}
        </div>
      </main>
    </div>
  );
}
