import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { withMergeCode } from "../lib/deviceTransfer";
import { announceHandoff } from "../lib/handoff";
import { loadOwnProfile } from "../lib/storage";

/** A one-time code is valid for 10 minutes; a fresh one is fetched a little before. */
const REFRESH_MS = 8 * 60 * 1000;

/**
 * One code for the whole page: a new code replaces the previous one of the same key on the
 * server, so the banner and the name prompt must not each fetch their own.
 */
let shared: { at: number; code: Promise<string | null> } | null = null;
function mergeCode(): Promise<string | null> {
  if (!shared || Date.now() - shared.at > REFRESH_MS) {
    shared = {
      at: Date.now(),
      code: api
        .createDeviceLink(loadOwnProfile())
        .then((link) => link.code)
        .catch(() => null),
    };
  }
  return shared.code;
}

/**
 * Safari on the iPhone: the link was opened in the browser instead of the home-screen app.
 * Copies the link and tells the app (via the server) to offer opening it. With `carry`, the
 * link takes Safari's identity along, so whatever was ticked or paid here shows up in the app.
 */
export default function OpenInApp({ url, carry = false }: { url: string; carry?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  // Fetched ahead: the copy must happen right in the tap (iOS drops it after a request).
  useEffect(() => {
    if (!carry) return;
    let cancelled = false;
    const fetchCode = () => void mergeCode().then((c) => !cancelled && setCode(c));
    fetchCode();
    const timer = window.setInterval(fetchCode, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [carry]);

  if (copied) {
    return (
      <div className="open-in-app done" role="status">
        <b>✓ Link kopiert.</b> Öffne jetzt billsplit auf Deinem Home-Bildschirm und tippe dort auf „Kopierten Link öffnen“
        {carry && code ? " – was Du hier abgehakt hast, kommt mit" : ""}.
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
          copyText(carry && code ? withMergeCode(url, code) : url);
          announceHandoff();
          setCopied(true);
        }}
      >
        In der App öffnen
      </button>
    </div>
  );
}
