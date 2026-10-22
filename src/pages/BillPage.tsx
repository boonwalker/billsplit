import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import LiveBadge from "../components/bill/LiveBadge";
import OwnerBar from "../components/bill/OwnerBar";
import QrHero from "../components/bill/QrHero";
import ReceiptPeek from "../components/bill/ReceiptPeek";
import DemoBar from "../components/DemoBar";
import GuestInvite from "../components/bill/GuestInvite";
import GestureHelp from "../components/GestureHelp";
import DivisorSheet, { type AssignPeople } from "../components/DivisorSheet";
import Header from "../components/Header";
import NamePrompt from "../components/NamePrompt";
import OpenInApp from "../components/OpenInApp";
import OwnerPanel, { EqualSplitToggle, ownerStatus, ownerSummary, TipSplit } from "../components/OwnerPanel";
import PayBar from "../components/PayBar";
import Receipt from "../components/Receipt";
import { api } from "../lib/api";
import { guestStatus } from "../lib/balances";
import { billUrl, lineFor, sharedTotal, type BillData, type Contact, type Debtor } from "../lib/bill";
import { setItemDivisor, setItemFor, toggleFeeExcluded, toggleItemExcluded, toggleTipExcluded } from "../lib/billEdits";
import { DEMO } from "../lib/demo";
import { isIosBrowser } from "../lib/handoff";
import { confirmScan, knock } from "../lib/haptics";
import { navigate } from "../lib/router";
import { askOnStartPage, SHOW_PAID_MS, takeProfileQuestion } from "../lib/onboarding";
import { paymentFromProfile, samePayment } from "../lib/payment";
import { dropDeletedBill, hasPaymentMethod, markGone, loadOwnProfile, loadProfile, rememberBill, saveProfile, updateRecent } from "../lib/storage";
import { useLiveBill } from "../lib/useLiveBill";
import { rich, t } from "../lib/i18n";
import { newRefunds, type NewRefund } from "../lib/refunds";
import RefundConfirm from "../components/RefundConfirm";
import { scrollBehavior } from "../lib/motion";

/** People from earlier bills offered in the long-press sheet, besides those in the bill. */
const MAX_ASSIGN_CONTACTS = 10;

/**
 * focus: open at a participant's place – the payer sees that friend in the list below the
 * receipt (to check the amount and tick "erhalten"), a friend sees the end of the receipt with
 * their share. back: where "Zurück" leads (the list it was opened from).
 */

export default function BillPage({ id, focus, back }: { id: string; focus?: string; back?: string }) {
  const { snapshot, error, notFound, deleted, live, setMyClaims, flushClaims, replace } = useLiveBill(id);
  const [askName, setAskName] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Scrolled to the very end, where the owner panel shows what the bar at the bottom says. */
  const [atEnd, setAtEnd] = useState(false);
  /** Payer: the line whose settings are open (after holding it). */
  const [divisorFor, setDivisorFor] = useState<string | null>(null);
  // Long press in a bill with ticking: people from earlier bills to give the line to.
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  /** A change that leaves friends having paid too much, waiting for the payer's yes. */
  const [refundAsk, setRefundAsk] = useState<{ refunds: NewRefund[]; apply: () => void } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [ownerBarHeight, setOwnerBarHeight] = useState(0);
  /**
   * A friend who just paid for the first time and has no way to get paid yet: after a moment
   * on the confirmation, the start page opens and asks there (see lib/onboarding).
   */
  const toStartPage = useRef<number | null>(null);
  useEffect(() => () => {
    if (toStartPage.current) window.clearTimeout(toStartPage.current);
  }, []);
  function askForProfile() {
    if (!takeProfileQuestion()) return;
    askOnStartPage(id);
    toStartPage.current = window.setTimeout(() => navigate("/"), SHOW_PAID_MS);
  }
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

  // Opened from a notification or a list: straight to the place where something is to be done.
  const focused = useRef<string | null>(null);
  const ready = snapshot !== null;
  useEffect(() => {
    if (!focus || !ready || focused.current === focus) return;
    focused.current = focus;
    const timer = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`.debtor[data-id="${CSS.escape(focus)}"]`);
      if (row) {
        row.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
        row.classList.add("focus-flash");
        window.setTimeout(() => row.classList.remove("focus-flash"), 2600);
        return;
      }
      // A friend's own share: the end of the receipt with the sums (the bar shows the amount).
      const el = scroller.current;
      el?.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [focus, ready]);

  /** Joins the bill under this name (and keeps the name in the profile). */
  const joinAs = useCallback(
    (name: string) => {
      saveProfile({ ...loadProfile(), name });
      joining.current = true;
      api
        .join(id, name)
        .then((snap) => {
          // Opened by scanning the QR code (e.g. with the camera app): in the bill now.
          if (!snap.isOwner) confirmScan();
          replace(snap);
        })
        .catch((e: unknown) => setActionError(e instanceof Error ? e.message : t("Beitreten fehlgeschlagen.")))
        .finally(() => (joining.current = false));
    },
    [id, replace],
  );
  /** Signed in from the name prompt: once the bill is loaded as the account, join without asking again. */
  const signedIn = useRef(false);

  // Opening the bill (by scanning the QR code) joins it with the profile name.
  useEffect(() => {
    if (!snapshot || snapshot.me || joining.current) return;
    const name = loadProfile().name.trim();
    // In Safari on the iPhone, ask first: whoever continues in the home-screen app would
    // otherwise appear twice in the bill.
    if (!name || (isIosBrowser() && !signedIn.current)) {
      setAskName(true);
      return;
    }
    joinAs(name);
  }, [snapshot, joinAs]);

  // Payer, bill with ticking: the people from earlier bills, once a line is long-pressed.
  const wantContacts = Boolean(divisorFor && snapshot?.isOwner);
  useEffect(() => {
    if (!wantContacts || contacts) return;
    api
      .contacts()
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [wantContacts, contacts]);

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

  // The list of bills shows what the friend still owes, or that it is marked as paid / settled.
  const guest = snapshot && !snapshot.isOwner && snapshot.me ? guestStatus(snapshot) : null;
  useEffect(() => {
    if (guest) updateRecent(id, guest);
    // A new status object comes with every snapshot; only its values matter.
  }, [guest?.markedPaid, guest?.owed, guest?.settled, guest?.currency, id]);
  // … and for the payer whether everything has come back.
  const status = snapshot?.isOwner ? ownerStatus(snapshot) : null;
  useEffect(() => {
    if (status) updateRecent(id, status);
    // A new status object comes with every snapshot; only its values matter.
  }, [status?.settled, status?.missing, status?.currency, id]);

  // An invalid bill does not stay in the list of bills.
  useEffect(() => {
    if (notFound) markGone(id);
  }, [notFound, id]);
  // Deleted on the admin page: it leaves the device without a trace.
  useEffect(() => {
    if (deleted) dropDeletedBill(id);
  }, [deleted, id]);

  if (deleted) {
    return (
      <div className="page">
        <Header back="/" />
        <main className="content">
          <div className="empty-state">
            <div className="empty-emoji">🧾</div>
            <h2>{t("Diese Rechnung wurde gelöscht.")}</h2>
          </div>
        </main>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page">
        <Header back="/" />
        <main className="content">
          <div className="empty-state">
            <div className="empty-emoji">🧾</div>
            <h2>{t("Rechnung nicht gefunden")}</h2>
            <p className="muted">{t("Der Link ist ungültig oder die Rechnung ist abgelaufen.")}</p>
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
          {error ? <div className="alert">{error}</div> : <div className="spinner" aria-label={t("Lädt")} />}
        </main>
      </div>
    );
  }

  const snap = snapshot;
  const equal = Boolean(snap.data.equalSplit);
  const url = billUrl(id, window.location.href, snap.data.payment, DEMO);
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
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : t("Speichern fehlgeschlagen.")));
  }

  function save(data: BillData) {
    api
      .updateBill(id, data)
      .then(replace)
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : t("Speichern fehlgeschlagen.")));
  }

  /** Someone paid already and would have paid too much afterwards: ask first (see RefundConfirm). */
  function guarded(data: BillData, apply: (data: BillData) => void) {
    const refunds = newRefunds(snap, data);
    if (refunds.length) setRefundAsk({ refunds, apply: () => apply(data) });
    else apply(data);
  }

  const updateData = (data: BillData) => guarded(data, save);

  /** Equal split, payer: crossing out lines, fees and the tip, billing a part of a line (see billEdits). */
  function edit(data: BillData) {
    guarded(data, (next) => {
      // Show it right away; the server's answer follows.
      replace({ ...snap, data: next });
      save(next);
    });
  }
  const toggleExcluded = (itemId: string) => edit(toggleItemExcluded(snap.data, itemId));
  const applyDivisor = (itemId: string, divisor: number) => edit(setItemDivisor(snap.data, itemId, divisor));
  const toggleFee = (feeId: string) => edit(toggleFeeExcluded(snap.data, feeId));
  const toggleTip = () => edit(toggleTipExcluded(snap.data));

  function pay() {
    // Ticks of the last moment go first, so the amount noted is the one being paid.
    void flushClaims()
      .then(() => api.pay(id))
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : t("Konnte Zahlung nicht vermerken.")));
  }

  /** No payment details in the bill: paid in person – the amount is noted first, then marked as paid. */
  function paidInPerson() {
    void flushClaims()
      .then(() => api.pay(id))
      .then(() => markPaid(true))
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : t("Konnte Zahlung nicht vermerken.")));
  }

  function markPaid(paid: boolean) {
    api
      .markPaid(id, paid)
      .then((snap) => {
        replace(snap);
        if (paid) askForProfile();
      })
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : t("Konnte Zahlung nicht vermerken.")));
  }

  /**
   * Payer, bill with ticking (long press on a line): who had it. Tapping a person gives them all
   * of the line, or takes it back; several people with it share it.
   */
  function assignPeople(itemId: string): AssignPeople | undefined {
    const item = snap.data.items.find((i) => i.id === itemId);
    if (!snap.isOwner || !item || !snap.me) return undefined;
    const people: AssignPeople["people"] = [{ id: snap.me, name: snap.ownerName, me: true }];
    const add = (id: string, name: string) => {
      if (name.trim() && !people.some((p) => p.id === id)) people.push({ id, name: name.trim(), me: false });
    };
    for (const p of snap.participants) add(p.id, p.name);
    for (const c of (contacts ?? []).slice(0, MAX_ASSIGN_CONTACTS)) add(c.id, c.name);
    // Equal split: the people the line was given to (BillItem.for) – with ticking: who ticked it.
    const holders = equal ? lineFor(item, snap.participants) : snap.participants.filter((p) => (p.claims[itemId]?.length ?? 0) > 0).map((p) => p.id);
    const all = Array.from({ length: item.qty }, (_, slot) => slot);
    /** A friend's claims with the line (or without): puts them into the bill, or lets an untouched assignee leave it. */
    const syncClaims = (personId: string, on: boolean) => {
      const claims = { ...snap.participants.find((p) => p.id === personId)?.claims };
      if (on) claims[itemId] = all;
      else delete claims[itemId];
      return api.assign(id, [{ id: personId, claims }]);
    };
    const fail = (e: unknown) => setActionError(e instanceof Error ? e.message : t("Speichern fehlgeschlagen."));
    return {
      people,
      holders,
      busy: assigning,
      onToggle: (personId) => {
        const on = !holders.includes(personId);
        if (equal) {
          // The line goes to these people alone; the rest of the bill stays split equally.
          const next = on ? [...holders, personId] : holders.filter((h) => h !== personId);
          guarded(setItemFor(snap.data, itemId, next), (data) => {
            setAssigning(true);
            const friend = personId !== snap.me;
            void (async () => {
              if (friend && on) await syncClaims(personId, true);
              let fresh = await api.updateBill(id, data);
              if (friend && !on) fresh = await syncClaims(personId, false);
              replace(fresh);
            })()
              .catch(fail)
              .finally(() => setAssigning(false));
          });
          return;
        }
        if (personId === snap.me) {
          setSlots(itemId, on ? all : [], []);
          return;
        }
        setAssigning(true);
        void flushClaims()
          .then(() => syncClaims(personId, on))
          .then(replace)
          .catch(fail)
          .finally(() => setAssigning(false));
      },
    };
  }

  const summary = snap.isOwner ? ownerSummary(snap) : null;

  return (
    // Only the middle scrolls: the bar at the bottom stays put (iOS moves fixed bars around while scrolling).
    <div className={`page bill-page ${snap.isOwner ? "owner" : "guest"}`}>
      <Header
        back={back ? `/${back}` : "/"}
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
        {/* Only friends take their identity along: a payer's copied link must never carry it (it may end up in a chat). */}
        {inBrowser && <OpenInApp url={url} carry={!snap.isOwner} />}

        {snap.isOwner && <QrHero snapshot={snap} url={url} />}

        {!snap.isOwner && (
          <section className="guest-intro">
            <p>
              {rich(t("<b>{name}</b> hat bezahlt.", { name: snap.ownerName }))}{" "}
              {equal
                ? t("Die Rechnung wird gleichmäßig auf alle verteilt – Du musst nichts abhaken.")
                : t("Hake ab, was Du hattest – alle sehen live, wer was übernimmt.")}
              {!equal && snap.me && <GestureHelp mode="claim" />}
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
          {snap.isOwner && !equal && <p className="receipt-instruction">{t("Hake Deine eigenen Positionen ab:")} <GestureHelp mode="claim" hold /></p>}
          {snap.isOwner && equal && (
            <p className="receipt-instruction">
              {t("Etwas war nicht für alle? Tippe es an, um es zu streichen – nochmal tippen holt es zurück.")} <GestureHelp mode="strike" />
            </p>
          )}
          <Receipt
            snapshot={snap}
            onSetSlots={snap.me && !equal ? setSlots : undefined}
            onShowOriginal={snap.hasReceiptImage ? () => navigate(`/b/${id}/beleg`) : undefined}
            onToggleExcluded={snap.isOwner && equal ? toggleExcluded : undefined}
            onToggleFee={snap.isOwner && equal ? toggleFee : undefined}
            // Payer only: "/ N" – and with ticking also who had the line (see assignPeople).
            onEditDivisor={snap.isOwner ? setDivisorFor : undefined}
            onResetDivisor={snap.isOwner ? (itemId) => applyDivisor(itemId, 1) : undefined}
            onToggleTip={snap.isOwner && equal ? toggleTip : undefined}
          />
        </div>

        {/* Paid: next time they could pay – and get it back with klicksplit. */}
        {!snap.isOwner && snap.me && (snap.myPayment?.markedPaidAt || snap.myReceived) && <GuestInvite />}

        {snap.isOwner && <OwnerPanel snapshot={snap} onToggleReceived={toggleReceived} shareUrl={url} onRemind={async (d) => replace(await api.remind(id, d.id))} />}
      </main>
      </div>

      {/* The finished receipt peeks up from behind the bar: the interactive bill is ready below. */}
      {snap.isOwner && summary && (
        <ReceiptPeek billId={id} title={snap.data.title} scroller={scroller} bottom={Math.max(0, ownerBarHeight - 26)} hidden={atEnd} />
      )}
      {snap.isOwner && summary && <OwnerBar snapshot={snap} missing={summary.missing} away={atEnd} onHeight={setOwnerBarHeight} scroller={scroller} />}
      {refundAsk && (
        <RefundConfirm
          refunds={refundAsk.refunds}
          currency={snap.data.currency}
          onConfirm={() => {
            refundAsk.apply();
            setRefundAsk(null);
          }}
          onCancel={() => setRefundAsk(null)}
        />
      )}

      {!snap.isOwner && snap.me && <PayBar snapshot={snap} onPay={pay} onMarkPaid={markPaid} onPaidInPerson={paidInPerson} onHeight={setPayBarHeight} scroller={scroller} />}

      {divisorFor && snap.data.items.some((i) => i.id === divisorFor) && (
        <DivisorSheet
          item={snap.data.items.find((i) => i.id === divisorFor)!}
          currency={snap.data.currency}
          onApply={(divisor) => applyDivisor(divisorFor, divisor)}
          onClose={() => setDivisorFor(null)}
          assign={assignPeople(divisorFor)}
        />
      )}


      {askName && (
        <NamePrompt
          ownerName={snap.ownerName}
          initialName={loadProfile().name.trim()}
          extra={inBrowser ? <OpenInApp url={url} carry /> : undefined}
          onSubmit={(name) => {
            setAskName(false);
            joinAs(name);
          }}
          onSignedIn={(result, typed) => {
            setAskName(false);
            signedIn.current = true;
            // A device that took on the account's identity loads the bill again as that one (see
            // useLiveBill) – already in it, or joining with the account's name. Otherwise join now.
            if (result === "login") return;
            const name = loadProfile().name.trim() || typed;
            if (name) joinAs(name);
            else setAskName(true);
          }}
        />
      )}
    </div>
  );
}
