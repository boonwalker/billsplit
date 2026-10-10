import { useEffect, useRef, useState } from "react";
import DemoBar from "../components/DemoBar";
import Header from "../components/Header";
import NamePrompt from "../components/NamePrompt";
import OpenInApp from "../components/OpenInApp";
import OwnerPanel, { EqualSplitToggle, ownerStatus, ownerSummary, TipSplit } from "../components/OwnerPanel";
import PayBar from "../components/PayBar";
import QrCode from "../components/QrCode";
import Receipt from "../components/Receipt";
import { api } from "../lib/api";
import { billUrl, sharedTotal, type BillData, type Debtor } from "../lib/bill";
import { DEMO } from "../lib/demo";
import { isIosBrowser } from "../lib/handoff";
import { confirmScan, knock } from "../lib/haptics";
import { formatMoney } from "../lib/money";
import { navigate } from "../lib/router";
import { paymentFromProfile, samePayment } from "../lib/payment";
import { forgetBill, hasPaymentMethod, loadOwnProfile, loadProfile, rememberBill, saveProfile, updateRecent } from "../lib/storage";
import { useLiveBill } from "../lib/useLiveBill";

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

export default function BillPage({ id }: { id: string }) {
  const { snapshot, error, notFound, live, setMyClaims, replace } = useLiveBill(id);
  const [askName, setAskName] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** Scrolled to the very end, where the owner panel shows what the bar at the bottom says. */
  const [atEnd, setAtEnd] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // Hides the payer's bar at the end of the page (with some slack, so it does not flicker),
  // also when the page is too short to scroll at all.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => {
      const left = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtEnd((was) => (was ? left <= 140 : left < 48));
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", check);
      observer.disconnect();
    };
  }, [snapshot !== null]);
  const joining = useRef(false);

  // Opening the bill (by scanning the QR code) joins it with the profile name.
  useEffect(() => {
    if (!snapshot || snapshot.me || joining.current) return;
    const name = loadProfile().name.trim();
    // In Safari on the iPhone, ask first: whoever continues in the home-screen app would
    // otherwise appear twice in the bill.
    if (!name || isIosBrowser()) {
      setAskName(true);
      return;
    }
    joining.current = true;
    api
      .join(id, name)
      .then((snap) => {
        // Opened by scanning the QR code (e.g. with the camera app): in the bill now.
        if (!snap.isOwner) confirmScan();
        replace(snap);
      })
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Beitreten fehlgeschlagen."))
      .finally(() => (joining.current = false));
  }, [snapshot, id, replace]);

  // The payment details are copied from the profile when the bill is created. If the payer
  // has changed them since (e.g. added PayPal.Me), bring their open bill up to date.
  const syncedPayment = useRef(false);
  useEffect(() => {
    if (!snapshot?.isOwner || syncedPayment.current) return;
    syncedPayment.current = true;
    const profile = loadOwnProfile();
    if (!hasPaymentMethod(profile)) return;
    const payment = paymentFromProfile(profile);
    if (samePayment(snapshot.data.payment, payment)) return;
    api
      .updateBill(id, { ...snapshot.data, payment })
      .then(replace)
      .catch(() => {});
  }, [snapshot, id, replace]);

  // The payer feels it when someone new joins the bill.
  const headCount = useRef<number | null>(null);
  const participantCount = snapshot?.isOwner ? snapshot.participants.length : null;
  useEffect(() => {
    if (participantCount === null) return;
    if (headCount.current !== null && participantCount > headCount.current) knock();
    headCount.current = participantCount;
  }, [participantCount]);

  useEffect(() => {
    // In the demo, friend personas must not turn the payer's bill into an invitation.
    if (snapshot?.me && (snapshot.isOwner || !DEMO)) {
      rememberBill({ id, title: snapshot.data.title, role: snapshot.isOwner ? "owner" : "guest", createdAt: snapshot.createdAt });
    }
  }, [snapshot?.me, snapshot?.isOwner, snapshot?.data.title, snapshot?.createdAt, id]);

  // The list of bills shows whether the friend marked their share as paid.
  const markedPaid = snapshot && !snapshot.isOwner && snapshot.me ? Boolean(snapshot.myPayment?.markedPaidAt) : null;
  useEffect(() => {
    if (markedPaid !== null) updateRecent(id, { markedPaid });
  }, [markedPaid, id]);
  // … and for the payer whether everything has come back.
  const status = snapshot?.isOwner ? ownerStatus(snapshot) : null;
  useEffect(() => {
    if (status) updateRecent(id, status);
    // A new status object comes with every snapshot; only its values matter.
  }, [status?.settled, status?.missing, status?.currency, id]);

  // An invalid bill does not stay in the list of bills.
  useEffect(() => {
    if (notFound) forgetBill(id);
  }, [notFound, id]);

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
  const equal = Boolean(snap.data.equalSplit);
  const url = billUrl(id, window.location.href, snap.data.payment);
  const mine = snap.participants.find((p) => p.id === snap.me);
  const inBrowser = isIosBrowser();

  /** Sets the units the viewer takes of an item and which of them they offer for sharing. */
  function setSlots(itemId: string, slots: number[], splits: number[]) {
    const claims = { ...mine?.claims };
    const offered = { ...mine?.splits };
    if (slots.length > 0) claims[itemId] = slots;
    else delete claims[itemId];
    const keep = splits.filter((slot) => slots.includes(slot));
    if (keep.length > 0) offered[itemId] = keep;
    else delete offered[itemId];
    setMyClaims(claims, offered);
  }

  function toggleReceived(d: Debtor, received: boolean) {
    api
      .setReceived(id, d.id, received)
      .then(replace)
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Speichern fehlgeschlagen."));
  }

  function updateData(data: BillData) {
    api
      .updateBill(id, data)
      .then(replace)
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Speichern fehlgeschlagen."));
  }

  /** Equal split: the payer crosses a forgotten line out (or brings it back); it is then not billed. */
  function toggleExcluded(itemId: string) {
    const items = snap.data.items.map((item) => {
      if (item.id !== itemId) return item;
      if (item.excluded) {
        const rest = { ...item };
        delete rest.excluded;
        return rest;
      }
      return { ...item, excluded: true };
    });
    // Show the stroke right away; the server's answer follows.
    replace({ ...snap, data: { ...snap.data, items } });
    updateData({ ...snap.data, items });
  }

  function pay() {
    api.pay(id).catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Konnte Zahlung nicht vermerken."));
  }

  function markPaid(paid: boolean) {
    api
      .markPaid(id, paid)
      .then(replace)
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Konnte Zahlung nicht vermerken."));
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
    // Only the middle scrolls: the bar at the bottom stays put (iOS moves fixed bars around while scrolling).
    <div className={`page bill-page ${snap.isOwner ? "owner" : "guest"}`}>
      <Header
        back="/"
        title={snap.data.title}
        action={
          <span className={`live-dot${live ? " on" : ""}`} title={live ? "Live verbunden" : "Verbinde …"}>
            {live ? "live" : "…"}
          </span>
        }
      />

      <div className="bill-scroll" ref={scroller}>
      <main className="content bill-content">
        {DEMO && <DemoBar />}
        {/* iPhone: shared links open in Safari – offer the way into the home-screen app. */}
        {inBrowser && <OpenInApp url={url} />}

        {snap.isOwner && (
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
                Demo ohne Server: Auf anderen Handys öffnet der Code noch keine Rechnung. Schalte oben auf Anna oder Ben, um
                die Sicht deiner Freunde zu sehen.
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
              <b>{snap.ownerName}</b> hat bezahlt.{" "}
              {equal
                ? "Die Rechnung wird gleichmäßig auf alle verteilt – du musst nichts abhaken."
                : "Hake ab, was du hattest – alle sehen live, wer was übernimmt."}
            </p>
          </section>
        )}

        {(error || actionError) && <div className="alert">{actionError ?? error}</div>}
        {/* Also right above the bar, where the finger is – the alert at the top is often scrolled away. */}
        {(error || actionError) && (
          <p className="bill-toast" role="alert" key={actionError ?? error ?? ""}>
            {actionError ?? error}
          </p>
        )}

        <div id="receipt" className="receipt-anchor">
          {snap.isOwner && <EqualSplitToggle snapshot={snap} onUpdateData={updateData} />}
          {snap.isOwner && (sharedTotal(snap.data) !== 0 || equal) && <TipSplit snapshot={snap} onUpdateData={updateData} />}
          {snap.isOwner && !equal && <p className="receipt-instruction">Hake deine eigenen Positionen ab:</p>}
          {snap.isOwner && equal && (
            <p className="receipt-instruction">Etwas war nicht für alle? Tippe es an, um es zu streichen – nochmal tippen holt es zurück.</p>
          )}
          <Receipt
            snapshot={snap}
            onSetSlots={snap.me && !equal ? setSlots : undefined}
            onShowOriginal={snap.hasReceiptImage ? () => navigate(`/b/${id}/beleg`) : undefined}
            onToggleExcluded={snap.isOwner && equal ? toggleExcluded : undefined}
          />
        </div>

        {snap.isOwner && <OwnerPanel snapshot={snap} onToggleReceived={toggleReceived} />}
      </main>
      </div>

      {snap.isOwner && summary && (
        <div className={`ownerbar${atEnd ? " away" : ""}`} aria-hidden={atEnd}>
          <div className="ownerbar-inner">
            <span>
              Dir fehlen noch
              <small>
                {snap.debtors?.filter((d) => d.payClickedAt).length ?? 0} von {snap.debtors?.length ?? 0} haben auf Bezahlen getippt
              </small>
            </span>
            <strong>{formatMoney(summary.missing, snap.data.currency)}</strong>
          </div>
        </div>
      )}

      {!snap.isOwner && snap.me && <PayBar snapshot={snap} onPay={pay} onMarkPaid={markPaid} />}

      {askName && (
        <NamePrompt
          ownerName={snap.ownerName}
          initialName={loadProfile().name.trim()}
          extra={inBrowser ? <OpenInApp url={url} /> : undefined}
          onSubmit={(name) => {
            saveProfile({ ...loadProfile(), name });
            setAskName(false);
            joining.current = true;
            api
              .join(id, name)
              .then((snap) => {
                if (!snap.isOwner) confirmScan();
                replace(snap);
              })
              .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Beitreten fehlgeschlagen."))
              .finally(() => (joining.current = false));
          }}
        />
      )}
    </div>
  );
}
