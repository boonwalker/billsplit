import { useEffect, useRef, useState, type CSSProperties } from "react";
import LiveBadge from "../components/bill/LiveBadge";
import OwnerBar from "../components/bill/OwnerBar";
import QrHero from "../components/bill/QrHero";
import ReceiptPeek from "../components/bill/ReceiptPeek";
import DemoBar from "../components/DemoBar";
import DivisorSheet from "../components/DivisorSheet";
import Header from "../components/Header";
import NamePrompt from "../components/NamePrompt";
import OpenInApp from "../components/OpenInApp";
import OwnerPanel, { EqualSplitToggle, ownerStatus, ownerSummary, TipSplit } from "../components/OwnerPanel";
import PayBar from "../components/PayBar";
import Receipt from "../components/Receipt";
import { api } from "../lib/api";
import { billUrl, sharedTotal, type BillData, type Debtor } from "../lib/bill";
import { setItemDivisor, toggleFeeExcluded, toggleItemExcluded, toggleTipExcluded } from "../lib/billEdits";
import { DEMO } from "../lib/demo";
import { isIosBrowser } from "../lib/handoff";
import { confirmScan, knock } from "../lib/haptics";
import { navigate } from "../lib/router";
import { paymentFromProfile, samePayment } from "../lib/payment";
import { forgetBill, hasPaymentMethod, loadOwnProfile, loadProfile, rememberBill, saveProfile, updateRecent } from "../lib/storage";
import { useLiveBill } from "../lib/useLiveBill";

export default function BillPage({ id }: { id: string }) {
  const { snapshot, error, notFound, live, setMyClaims, replace } = useLiveBill(id);
  const [askName, setAskName] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Scrolled to the very end, where the owner panel shows what the bar at the bottom says. */
  const [atEnd, setAtEnd] = useState(false);
  /** Payer: the line whose settings are open (after holding it). */
  const [divisorFor, setDivisorFor] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [ownerBarHeight, setOwnerBarHeight] = useState(0);
  /** Height of the friend's pay bar: the receipt can always be scrolled up above it. */
  const [payBarHeight, setPayBarHeight] = useState<number | null>(null);
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

  /** Equal split, payer: crossing out lines, fees and the tip, billing a part of a line (see billEdits). */
  function edit(data: BillData) {
    // Show it right away; the server's answer follows.
    replace({ ...snap, data });
    updateData(data);
  }
  const toggleExcluded = (itemId: string) => edit(toggleItemExcluded(snap.data, itemId));
  const applyDivisor = (itemId: string, divisor: number) => edit(setItemDivisor(snap.data, itemId, divisor));
  const toggleFee = (feeId: string) => edit(toggleFeeExcluded(snap.data, feeId));
  const toggleTip = () => edit(toggleTipExcluded(snap.data));

  function pay() {
    api.pay(id).catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Konnte Zahlung nicht vermerken."));
  }

  function markPaid(paid: boolean) {
    api
      .markPaid(id, paid)
      .then(replace)
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Konnte Zahlung nicht vermerken."));
  }

  const summary = snap.isOwner ? ownerSummary(snap) : null;

  return (
    // Only the middle scrolls: the bar at the bottom stays put (iOS moves fixed bars around while scrolling).
    <div className={`page bill-page ${snap.isOwner ? "owner" : "guest"}`}>
      <Header
        back="/"
        title={snap.data.title}
        action={<LiveBadge live={live} online={snap.online} />}
      />

      <div className="bill-scroll" ref={scroller}>
      <main
        className="content bill-content"
        style={payBarHeight ? ({ "--paybar-h": `${payBarHeight}px` } as CSSProperties) : undefined}
      >
        {DEMO && <DemoBar />}
        {/* iPhone: shared links open in Safari – offer the way into the home-screen app. */}
        {inBrowser && <OpenInApp url={url} />}

        {snap.isOwner && <QrHero snapshot={snap} url={url} />}

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
            onToggleFee={snap.isOwner && equal ? toggleFee : undefined}
            // Only in the equal split: in "Jeder selber abhaken" everyone ticks what they had.
            onEditDivisor={snap.isOwner && equal ? setDivisorFor : undefined}
            onResetDivisor={snap.isOwner && equal ? (itemId) => applyDivisor(itemId, 1) : undefined}
            onToggleTip={snap.isOwner && equal ? toggleTip : undefined}
          />
        </div>

        {snap.isOwner && <OwnerPanel snapshot={snap} onToggleReceived={toggleReceived} />}
      </main>
      </div>

      {/* The finished receipt peeks up from behind the bar: the interactive bill is ready below. */}
      {snap.isOwner && summary && (
        <ReceiptPeek billId={id} title={snap.data.title} scroller={scroller} bottom={Math.max(0, ownerBarHeight - 26)} hidden={atEnd} />
      )}
      {snap.isOwner && summary && <OwnerBar snapshot={snap} missing={summary.missing} away={atEnd} onHeight={setOwnerBarHeight} />}

      {!snap.isOwner && snap.me && <PayBar snapshot={snap} onPay={pay} onMarkPaid={markPaid} onHeight={setPayBarHeight} />}

      {divisorFor && snap.data.items.some((i) => i.id === divisorFor) && (
        <DivisorSheet
          item={snap.data.items.find((i) => i.id === divisorFor)!}
          currency={snap.data.currency}
          onApply={(divisor) => applyDivisor(divisorFor, divisor)}
          onClose={() => setDivisorFor(null)}
        />
      )}

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
