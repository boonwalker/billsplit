import QRCode from "qrcode";
import { useEffect, useState } from "react";
import Header from "../components/Header";
import { billUrl, decodeBill, subtotal } from "../lib/bill";
import { formatMoney } from "../lib/money";
import { navigate } from "../lib/router";
import { editBill } from "./Editor";

export default function Share({ data }: { data: string }) {
  const bill = decodeBill(data);
  const url = billUrl(data, window.location.href);
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [url]);

  if (!bill) {
    return (
      <div className="page">
        <Header title="Rechnung" back="/" />
        <main className="content">
          <div className="alert">Diese Rechnung konnte nicht geladen werden.</div>
        </main>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Link kopieren:", url);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `billsplit: ${bill!.title}`, text: `Hier ist die Rechnung von ${bill!.title} – hak ab, was du hattest:`, url });
    } catch {
      // cancelled
    }
  }

  const total = subtotal(bill.items);
  const canShare = typeof navigator.share === "function";

  return (
    <div className="page">
      <Header title="Teilen" back="/" />
      <main className="content center">
        <div className="card qr-card">
          <h2>{bill.title}</h2>
          <p className="muted">
            {bill.date && new Date(bill.date).toLocaleDateString("de-DE")} · {bill.items.length} Positionen · {formatMoney(total, bill.currency)}
          </p>
          <div className="qr" role="img" aria-label="QR-Code zur Rechnung" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="small muted">Lass deine Freunde diesen Code mit der Handykamera scannen.</p>
        </div>

        <div className="row gap wrap">
          {canShare && (
            <button className="btn btn-primary grow" onClick={share}>
              Link teilen
            </button>
          )}
          <button className={`btn ${canShare ? "btn-secondary" : "btn-primary"} grow`} onClick={copy}>
            {copied ? "✓ Kopiert" : "Link kopieren"}
          </button>
        </div>
        <div className="row gap wrap">
          <button className="btn btn-ghost grow" onClick={() => navigate(`/b/${data}`)}>
            Vorschau ansehen
          </button>
          <button className="btn btn-ghost grow" onClick={() => editBill(bill)}>
            Bearbeiten
          </button>
        </div>
      </main>
    </div>
  );
}
