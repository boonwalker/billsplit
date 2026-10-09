import { useEffect, useRef, useState } from "react";
import DemoBar from "../components/DemoBar";
import Header from "../components/Header";
import NamePrompt from "../components/NamePrompt";
import OwnerPanel, { ownerSummary } from "../components/OwnerPanel";
import PayBar from "../components/PayBar";
import QrCode from "../components/QrCode";
import Receipt from "../components/Receipt";
import { api } from "../lib/api";
import { billUrl, type Debtor } from "../lib/bill";
import { DEMO } from "../lib/demo";
import { formatMoney } from "../lib/money";
import { navigate } from "../lib/router";
import { loadProfile, rememberBill, saveProfile } from "../lib/storage";
import { useLiveBill } from "../lib/useLiveBill";

export default function BillPage({ id }: { id: string }) {
  const { snapshot, error, notFound, live, setMyClaims, replace } = useLiveBill(id);
  const [askName, setAskName] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const joining = useRef(false);

  // Opening the bill (by scanning the QR code) joins it with the profile name.
  useEffect(() => {
    if (!snapshot || snapshot.me || joining.current) return;
    const name = loadProfile().name.trim();
    if (!name) {
      setAskName(true);
      return;
    }
    joining.current = true;
    api
      .join(id, name)
      .then(replace)
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Beitreten fehlgeschlagen."))
      .finally(() => (joining.current = false));
  }, [snapshot, id, replace]);

  useEffect(() => {
    // In the demo, friend personas must not turn the payer's bill into an invitation.
    if (snapshot?.me && (snapshot.isOwner || !DEMO)) {
      rememberBill({ id, title: snapshot.data.title, role: snapshot.isOwner ? "owner" : "guest", createdAt: snapshot.createdAt });
    }
  }, [snapshot?.me, snapshot?.isOwner, snapshot?.data.title, snapshot?.createdAt, id]);

  if (notFound) {
    return (
      <div className="page">
        <Header back="/" />
        <main className="content">
          <div className="empty-state">
            <div className="empty-emoji">🧾</div>
            <h2>Rechnung nicht gefunden</h2>
            <p className="muted">Der Link ist ungültig oder die Rechnung ist abgelaufen.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="page">
        <Header back="/" />
        <main className="content center-v">
          {error ? <div className="alert">{error}</div> : <div className="spinner" aria-label="Lädt" />}
        </main>
      </div>
    );
  }

  const snap = snapshot;
  const url = billUrl(id, window.location.href, snap.data.payment);
  const myClaims = snap.participants.find((p) => p.id === snap.me)?.claims ?? {};

  function setUnits(itemId: string, units: number) {
    const next = { ...myClaims };
    if (units > 0) next[itemId] = units;
    else delete next[itemId];
    setMyClaims(next);
  }

  function toggleReceived(d: Debtor, received: boolean) {
    api
      .setReceived(id, d.id, received)
      .then(replace)
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Speichern fehlgeschlagen."));
  }

  function pay() {
    api.pay(id).catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Konnte Zahlung nicht vermerken."));
  }

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

  const summary = snap.isOwner ? ownerSummary(snap) : null;

  return (
    <div className={`page ${snap.isOwner ? "owner" : "guest"}`}>
      <Header
        back="/"
        title={snap.data.title}
        action={
          <span className={`live-dot${live ? " on" : ""}`} title={live ? "Live verbunden" : "Verbinde …"}>
            {live ? "live" : "…"}
          </span>
        }
      />

      <main className="content bill-content">
        {DEMO && <DemoBar />}

        {snap.isOwner && (
          <section className="qr-hero" aria-label="QR-Code zum Teilen">
            <p className="eyebrow">Rechnung bereit</p>
            <h2>Lass deine Freunde scannen</h2>
            <QrCode value={url} label="QR-Code zur Rechnung" />
            <p className="muted small">
              Enthält die Rechnung und deine PayPal-Daten
              {snap.data.payment.paypalMe ? ` (paypal.me/${snap.data.payment.paypalMe})` : snap.data.payment.paypalEmail ? ` (${snap.data.payment.paypalEmail})` : ""}.
            </p>
            {DEMO && (
              <p className="demo-note">
                Demo ohne Server: Auf anderen Handys öffnet der Code noch keine Rechnung. Schalte oben auf Anna oder Ben, um
                die Sicht deiner Freunde zu sehen.
              </p>
            )}
            <div className="row gap">
              <button className="btn btn-ghost grow" onClick={share}>
                {copied ? "✓ Link kopiert" : "Link teilen"}
              </button>
              <button className="btn btn-ghost grow" onClick={() => navigate(`/b/${id}/edit`)}>
                Positionen bearbeiten
              </button>
            </div>
            <a className="scroll-hint" href="#receipt" onClick={(e) => (e.preventDefault(), document.getElementById("receipt")?.scrollIntoView({ behavior: "smooth" }))}>
              Deine digitale Rechnung
              <span aria-hidden="true">↓</span>
            </a>
          </section>
        )}

        {!snap.isOwner && (
          <section className="guest-intro">
            <p>
              <b>{snap.ownerName}</b> hat bezahlt. Hake ab, was du hattest – alle sehen live, wer was übernimmt.
            </p>
          </section>
        )}

        {(error || actionError) && <div className="alert">{actionError ?? error}</div>}

        <div id="receipt" className="receipt-anchor">
          {snap.isOwner && <p className="receipt-instruction">Hake deine eigenen Positionen ab:</p>}
          <Receipt snapshot={snap} onSetUnits={snap.me ? setUnits : undefined} />
        </div>

        {snap.isOwner && <OwnerPanel snapshot={snap} onToggleReceived={toggleReceived} />}
      </main>

      {snap.isOwner && summary && (
        <div className="ownerbar">
          <div className="ownerbar-inner">
            <span>
              Fehlt dir noch
              <small>
                {snap.debtors?.filter((d) => d.payClickedAt).length ?? 0} von {snap.debtors?.length ?? 0} haben auf Bezahlen getippt
              </small>
            </span>
            <strong>{formatMoney(summary.missing, snap.data.currency)}</strong>
          </div>
        </div>
      )}

      {!snap.isOwner && snap.me && <PayBar snapshot={snap} onPay={pay} />}

      {askName && (
        <NamePrompt
          ownerName={snap.ownerName}
          onSubmit={(name) => {
            saveProfile({ ...loadProfile(), name });
            setAskName(false);
            joining.current = true;
            api
              .join(id, name)
              .then(replace)
              .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Beitreten fehlgeschlagen."))
              .finally(() => (joining.current = false));
          }}
        />
      )}
    </div>
  );
}
