import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import { billIdFromUrl } from "../lib/bill";
import { deviceCodeFromUrl } from "../lib/deviceTransfer";
import { confirmScan } from "../lib/haptics";
import { navigate } from "../lib/router";

/** In-app QR scanner for friends: opens the scanned bill directly in billsplit. */
export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function tick() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && ctx && video.readyState >= video.HAVE_ENOUGH_DATA) {
        // Scan a downscaled frame – plenty for a QR code on a phone screen.
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          const id = billIdFromUrl(code.data);
          const device = deviceCodeFromUrl(code.data);
          if (id || device) {
            stopped = true;
            confirmScan();
            navigate(id ? `/b/${id}` : `/geraet/${device}`, { replace: true });
            return;
          }
          setHint("Das ist kein billsplit-QR-Code.");
        }
      }
      raf = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        void video.play();
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError("Kein Kamerazugriff. Erlaube die Kamera in den Browser-Einstellungen oder füge den Link unten ein."));
    if (!navigator.mediaDevices) setError("Dein Browser unterstützt keinen Kamerazugriff. Füge den Link unten ein.");

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const manualId = billIdFromUrl(manual);
  const manualDevice = deviceCodeFromUrl(manual);

  return (
    <div className="page scan-page">
      <Header back="/" title="QR-Code scannen" />
      <main className="content">
        <div className="viewfinder">
          <video ref={videoRef} playsInline muted />
          <div className="viewfinder-frame" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="viewfinder-laser" aria-hidden="true" />
        </div>
        <p className="muted center-text">Richte die Kamera auf den QR-Code auf dem Handy deines Freundes.</p>
        {hint && <p className="warning center-text">{hint}</p>}
        {error && <div className="alert">{error}</div>}

        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (manualId) navigate(`/b/${manualId}`);
            else if (manualDevice) navigate(`/geraet/${manualDevice}`);
          }}
        >
          <label className="field">
            <span>Oder Link einfügen</span>
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="https://…/#/b/…" />
          </label>
          <button className="btn btn-secondary" disabled={!manualId && !manualDevice}>
            {manualDevice ? "Gerät übernehmen" : "Rechnung öffnen"}
          </button>
        </form>
      </main>
    </div>
  );
}
