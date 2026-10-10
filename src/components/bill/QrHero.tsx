import { useState } from "react";
import type { BillData, BillSnapshot } from "../../lib/bill";
import { DEMO } from "../../lib/demo";
import { navigate } from "../../lib/router";
import { useOneLine } from "../../lib/useOneLine";
import QrCode from "../QrCode";

/** "(paypal.me/niklas, Überweisung, Wero)" – what the QR code passes on. */
function paymentSummary(payment: BillData["payment"]): string {
  const parts = [
    payment.paypalMe ? `paypal.me/${payment.paypalMe}` : payment.paypalEmail,
    payment.iban && "Überweisung",
    payment.wero && "Wero",
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/** Opens WhatsApp itself with the message ready to send (the web address on desktops). */
function whatsappLink(text: string): string {
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  return `${mobile ? "whatsapp://send" : "https://wa.me/"}?text=${encodeURIComponent(text)}`;
}

/** The payer's top of the bill: the QR code to scan, WhatsApp, sharing the link, editing the items. */
export default function QrHero({ snapshot: snap, url }: { snapshot: BillSnapshot; url: string }) {
  const [copied, setCopied] = useState(false);
  const fitEditLabel = useOneLine();

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `billsplit · ${snap.data.title}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // cancelled
    }
  }

  return (
    <section className="qr-hero" aria-label="QR-Code zum Teilen">
      <p className="eyebrow">Rechnung bereit</p>
      <h2>Lass deine Freunde scannen</h2>
      <QrCode value={url} label="QR-Code zur Rechnung" />
      <p className="muted small">
        Enthält die Rechnung und deine Zahlungsdaten
        {paymentSummary(snap.data.payment)}.
      </p>
      {DEMO && (
        <p className="demo-note">
          Demo ohne Server: Auf anderen Handys öffnet der Code noch keine Rechnung. Schalte oben auf Anna oder Ben, um die
          Sicht deiner Freunde zu sehen.
        </p>
      )}
      {/* Straight into WhatsApp: its share-sheet extension on the iPhone often only sends once
          WhatsApp itself is opened, a message written in the app goes out right away. */}
      <a className="btn btn-whatsapp" href={whatsappLink(`Ich habe „${snap.data.title}“ bezahlt – hier kannst Du Deinen Anteil abhaken und begleichen: ${url}`)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3c.2-.6.2-1.1.2-1.3l-.6-.3Z"
          />
        </svg>
        Per WhatsApp senden
      </a>
      <div className="row gap share-row">
        <button className="btn btn-ghost grow" onClick={share}>
          {copied ? "✓ Link kopiert" : "Link teilen"}
        </button>
        <button className="btn btn-ghost grow edit-items" onClick={() => navigate(`/b/${snap.id}/edit`)}>
          {/* As large as "Link teilen": the text shrinks only as far as it must to fit. */}
          <span className="fit-line" ref={fitEditLabel}>
            Positionen bearbeiten
          </span>
        </button>
      </div>
      <a className="scroll-hint" href="#receipt" onClick={(e) => (e.preventDefault(), document.getElementById("receipt")?.scrollIntoView({ behavior: "smooth" }))}>
        Deine interaktive Rechnung
        <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}
