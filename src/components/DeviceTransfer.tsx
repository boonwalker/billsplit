import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { deviceLinkUrl, takeOverDevice } from "../lib/deviceTransfer";
import { navigate } from "../lib/router";
import { deviceKey, isDeviceKey, loadOwnProfile, loadRecent } from "../lib/storage";
import QrCode from "./QrCode";

type Open = "none" | "link" | "code" | "restore";

/**
 * Bills belong to this device (its key). So that they survive a new phone or a wiped browser:
 * move them with a one-time QR code, or note the recovery code and enter it on any device.
 */
export default function DeviceTransfer() {
  const [open, setOpen] = useState<Open>("none");
  const [link, setLink] = useState<{ url: string; expires: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [input, setInput] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState<number | null>(null);

  // Counts down while the QR code is shown; it works for a few minutes only.
  useEffect(() => {
    if (!link) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [link]);
  const left = link ? Math.max(0, Math.ceil((link.expires - now) / 1000)) : 0;

  function toggle(next: Open) {
    setError(null);
    setCopied(null);
    setOpen((o) => (o === next ? "none" : next));
  }

  function showLink() {
    toggle("link");
    if (open !== "link") void createLink();
  }

  async function createLink() {
    setLink(null);
    setError(null);
    try {
      const { code, expiresAt } = await api.createDeviceLink(loadOwnProfile());
      setLink({ url: deviceLinkUrl(code), expires: Date.parse(expiresAt) });
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    }
  }

  async function restore() {
    const key = input.replace(/\s+/g, "");
    if (!isDeviceKey(key)) return setError("Das ist kein Wiederherstellungs-Code – bitte prüfe ihn.");
    if (key === deviceKey()) return setError("Das ist der Code dieses Geräts.");
    setRestoring(true);
    setError(null);
    try {
      const bills = await api.myBills(key);
      if (!bills.length) {
        setError("Zu diesem Code gibt es keine Rechnungen (mehr). Bitte prüfe ihn.");
        return;
      }
      // The profile stays as it is here; the bills (and their names) come from the code.
      setRestored(await takeOverDevice(key, null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setRestoring(false);
    }
  }

  const here = loadRecent().length;

  return (
    <div className="card device-transfer">
      <p className="muted small">
        Deine Rechnungen hängen an diesem Gerät. Damit sie bei einem neuen Handy oder gelöschtem Browser-Speicher nicht verloren
        gehen:
      </p>

      <button type="button" className="btn btn-ghost" onClick={showLink}>
        Auf neues Gerät übertragen
      </button>
      {open === "link" && (
        <div className="device-panel">
          {link && left > 0 ? (
            <>
              <QrCode value={link.url} label="QR-Code zum Übertragen auf ein neues Gerät" />
              <p className="small">
                Auf dem neuen Gerät billsplit öffnen und <b>„QR-Code scannen“</b> antippen. Gilt noch{" "}
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} Minuten und nur einmal.
              </p>
              <button
                type="button"
                className="link small"
                onClick={() => {
                  copyText(link.url);
                  setCopied("link");
                }}
              >
                {copied === "link" ? "✓ Link kopiert" : "Stattdessen Link kopieren"}
              </button>
            </>
          ) : link ? (
            <button type="button" className="link small" onClick={() => void createLink()}>
              Abgelaufen – neuen QR-Code zeigen
            </button>
          ) : (
            !error && <p className="muted small">QR-Code wird erstellt …</p>
          )}
        </div>
      )}

      <button type="button" className="btn btn-ghost" onClick={() => toggle("code")}>
        Wiederherstellungs-Code anzeigen
      </button>
      {open === "code" && (
        <div className="device-panel">
          <code className="recovery-code">{deviceKey()}</code>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              copyText(deviceKey());
              setCopied("code");
            }}
          >
            {copied === "code" ? "✓ Kopiert" : "Kopieren"}
          </button>
          <p className="muted small">
            Bewahre ihn sicher auf, z. B. in Deinem Passwort-Manager. Damit holst Du Deine Rechnungen auf jedes Gerät zurück –
            und wer ihn hat, kann in Deinem Namen abhaken und Zahlungen bestätigen. Gib ihn niemandem.
          </p>
        </div>
      )}

      <button type="button" className="link small device-restore-toggle" onClick={() => toggle("restore")}>
        Wiederherstellungs-Code eingeben
      </button>
      {open === "restore" &&
        (restored !== null ? (
          <div className="device-panel">
            <p className="settle-done">✓ {restored === 1 ? "1 Rechnung" : `${restored} Rechnungen`} wiederhergestellt</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/")}>
              Zu Deinen Rechnungen
            </button>
          </div>
        ) : (
          <div className="device-panel">
            <textarea
              className="recovery-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Wiederherstellungs-Code einfügen"
              rows={3}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {here > 0 && (
              <p className="muted small">
                Die {here === 1 ? "Rechnung" : `${here} Rechnungen`} auf diesem Gerät {here === 1 ? "wird" : "werden"} dabei durch die
                des Codes ersetzt.
              </p>
            )}
            <button type="button" className="btn btn-primary" disabled={restoring || !input.trim()} onClick={restore}>
              {restoring ? "Wird wiederhergestellt …" : "Rechnungen wiederherstellen"}
            </button>
          </div>
        ))}

      {error && <p className="alert">{error}</p>}
    </div>
  );
}
