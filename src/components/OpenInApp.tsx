import { useState } from "react";
import { copyText } from "../lib/clipboard";
import { announceHandoff } from "../lib/handoff";

/**
 * Safari on the iPhone: the link was opened in the browser instead of the home-screen app.
 * Copies the link and tells the app (via the server) to offer opening it.
 */
export default function OpenInApp({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  if (copied) {
    return (
      <div className="open-in-app done" role="status">
        <b>✓ Link kopiert.</b> Öffne jetzt billsplit auf Deinem Home-Bildschirm und tippe dort auf „Kopierten Link öffnen“.
      </div>
    );
  }
  return (
    <div className="open-in-app">
      <span>billsplit auf dem Home-Bildschirm?</span>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => {
          copyText(url);
          announceHandoff();
          setCopied(true);
        }}
      >
        In der App öffnen
      </button>
    </div>
  );
}
