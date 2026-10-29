import { rich, t, tMsg } from "../lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useOneLine } from "../lib/useOneLine";
import { hasTip, participantShare, type BillSnapshot } from "../lib/bill";
import { centsToInput, formatMoney } from "../lib/money";
import { copyText } from "../lib/clipboard";
import { clickPress, clickRelease } from "../lib/haptics";
import { otherMethods, payAction, type OtherMethod } from "../lib/payment";
import TransferSheet from "./TransferSheet";
import { useScrollThrough } from "../lib/useScrollThrough";

interface Props {
  snapshot: BillSnapshot;
  /** Records the pay click on the server (fire and forget). */
  onPay: () => void;
  /** Marks the friend's share as paid (or takes that back). */
  onMarkPaid: (paid: boolean) => void;
  /** No payment details: paid in person (e.g. cash) – notes the amount and marks it as paid. */
  onPaidInPerson?: () => void;
  /** The bar's height whenever it changes (it grows after paying), so the page can scroll past it. */
  onHeight?: (px: number) => void;
  /** The page below: strokes on the bar scroll it (see useScrollThrough). */
  scroller?: RefObject<HTMLDivElement | null>;
  /** "Stimmt nicht?": another guest shared a line I had paid for afterwards – show me where to take it back. */
  onContest?: () => void;
  /** … and the receipt now shows where (the hint stays here until it is done). */
  contesting?: boolean;
}

/**
 * The bubble's "loud" jump (see .paybar-bubble): as big as fits – never wider than the screen,
 * never higher than the room between the top bar and the pay bar.
 */
function fitPop(el: HTMLParagraphElement | null) {
  if (!el) return;
  // A little room for the corners while it rumbles (tilted by up to 2°).
  const byWidth = (document.documentElement.clientWidth - 24) / el.offsetWidth;
  const barTop = el.offsetParent?.getBoundingClientRect().top ?? window.innerHeight;
  const headerBottom = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
  // Its bottom sits 12px above the bar and it rises 18px while big.
  const byHeight = (barTop - 12 - 18 - headerBottom - 8) / el.offsetHeight;
  el.style.setProperty("--pop", String(Math.max(1, Math.min(2.2, byWidth, byHeight))));
}

/** Sticky bottom bar for friends: their individual sum and the pay button. */
export default function PayBar({ snapshot, onPay, onMarkPaid, onPaidInPerson, onHeight, scroller, onContest, contesting }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  // A stroke that starts on the bar scrolls the receipt above it.
  const noScroller = useRef<HTMLDivElement>(null);
  useScrollThrough(bar, scroller ?? noScroller);
  const oneLine = useOneLine();
  const change = snapshot.myShareChange;
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || !onHeight) return;
    const report = () => onHeight(el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeight]);
  const [copied, setCopied] = useState(false);
  /** Amount copied in the first tap; the second tap then opens PayPal. */
  const [prepared, setPrepared] = useState<{ amount: string; copied: boolean } | null>(null);
  const { data, participants, me, myPayment, ownerName } = snapshot;
  const share = me ? participantShare(data, participants, me) : { subtotal: 0, shared: 0, total: 0 };
  const topUps = snapshot.myTopUps ?? [];
  const lastTop = topUps.at(-1);
  // Covered by settlement payments (dashboard), confirmed or still waiting for the recipient.
  const credit = snapshot.myCredit ? snapshot.myCredit.confirmed + snapshot.myCredit.pending : 0;
  /** What the first payment covers: its pay click, or (confirmed without one) what was open then. */
  const firstAmount = snapshot.myReceived ? (myPayment?.amount ?? snapshot.myReceivedAmount ?? share.total) : (myPayment?.amount ?? 0);
  const due = Math.max(0, share.total - firstAmount - topUps.reduce((sum, top) => sum + top.amount, 0) - credit);
  /** The latest payment: a top-up (the share grew after paying, see TopUp), else the first one. */
  const latest: { amount: number; markedPaidAt?: string; received?: boolean } | null = lastTop
    ? lastTop
    : myPayment
      ? { ...myPayment, received: snapshot.myReceived }
      : snapshot.myReceived
        ? { amount: firstAmount, received: true }
        : null;
  /** The payment this bar is about – none once it is confirmed, or marked while something new is due (a top-up then). */
  const payment = latest && !latest.received && !(due > 0 && latest.markedPaidAt) ? latest : null;
  /** Paid already, and something came on top since (being paid, or still to pay). */
  const topUp = topUps.length > 0 || Boolean(!payment && due > 0 && latest);
  /** The payments so far (not the one being paid right now). */
  const history = [{ amount: firstAmount, received: snapshot.myReceived, markedPaidAt: myPayment?.markedPaidAt }, ...topUps].filter(
    (paid) => paid !== payment && (paid.received || paid.markedPaidAt),
  );
  /** Confirmed by the payer and nothing new on top: nothing to pay here. */
  const confirmed = Boolean(latest?.received) && due === 0;
  const coveredByCredit = credit > 0 && due === 0 && !latest;
  const action = payAction(data.payment, due, data.currency);
  const nothing = due <= 0;
  /** Bank transfer / Wero: shown in a sheet with copy buttons. */
  const others = otherMethods(data.payment);
  const [sheet, setSheet] = useState<OtherMethod | null>(null);
  const myName = participants.find((p) => p.id === me)?.name ?? "";
  const reference = `klicksplit · ${data.title}${myName ? ` · ${myName}` : ""}`.slice(0, 140);
  const otherLabel = others.length > 1 ? t("Lieber per Überweisung oder Wero") : others[0] === "bank" ? t("Lieber per Überweisung") : t("Lieber per Wero");

  /**
   * Back from PayPal (or the banking app): ask right away whether the money went out, instead
   * of relying on the friend to find "Als bezahlt markieren" – which is easily forgotten.
   */
  const away = useRef<"no" | "leaving" | "away">("no");
  const [askPaid, setAskPaid] = useState(false);
  const leaving = () => (away.current = "leaving");
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (away.current === "leaving") away.current = "away";
      } else if (away.current === "away") {
        away.current = "no";
        setAskPaid(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const asking = askPaid && Boolean(payment) && !payment?.markedPaidAt && nothing && !confirmed;

  /** Opens the transfer details (and notes the pay click, as the PayPal button does). */
  function openSheet(method: OtherMethod, record = true) {
    if (record && !nothing) onPay();
    leaving();
    setSheet(method);
  }

  /**
   * PayPal often drops the amount from the PayPal.Me link (it opens with only the
   * recipient preset), so the amount goes to the clipboard to paste it there. This
   * happens in a tap of its own: when the same tap also left for PayPal, iOS lost the
   * clipboard write.
   */
  const dueText = centsToInput(due);
  const ready = prepared?.amount === dueText ? prepared : null;
  function prepareAmount() {
    setPrepared({ amount: dueText, copied: copyText(dueText) });
  }

  /** The address in a tap of its own (the tap that leaves for PayPal loses the clipboard on iOS). */
  function copyEmail(email: string) {
    setCopied(copyText(email));
  }

  return (
    <div className="paybar" ref={bar} role="region" aria-label={t("Dein Anteil")}>
      {/* Right before leaving for PayPal: come back afterwards – the payer only sees it once it is confirmed here. */}
      {!confirmed && !coveredByCredit && !asking && !(payment && nothing) && (action.kind === "paypalMe" || action.kind === "email") && ready && (
        <p className="paybar-bubble" role="status" ref={fitPop}>
          ↩ {t("Danach wieder zurück in die App kommen und die Zahlung bestätigen")}
        </p>
      )}
      <div className="paybar-inner">
        <div className="paybar-sum">
          <span className="paybar-label">
            {t("Dein Anteil")}
            {share.shared !== 0 && (
              <small>
                {" "}
                {(data.fees ?? []).length > 0
                  ? hasTip(data)
                    ? t("inkl. {amount} Anteil an Gebühren & Trinkgeld", { amount: formatMoney(share.shared, data.currency) })
                    : t("inkl. {amount} Anteil an Gebühren", { amount: formatMoney(share.shared, data.currency) })
                  : t("inkl. {amount} Anteil an Trinkgeld", { amount: formatMoney(share.shared, data.currency) })}
              </small>
            )}
          </span>
          <strong className="paybar-total" key={share.total}>
            {formatMoney(share.total, data.currency)}
          </strong>
        </div>

        {/* The payer confirmed the share as received (e.g. offset in the dashboard): nothing to pay here. */}
        {snapshot.myReceived && !topUps.length && due === 0 && (
          <p className="paybar-note paybar-copied">✓ {t("{name} hat Deinen Anteil als erhalten markiert.", { name: ownerName || t("Der Rechnungssteller") })}</p>
        )}

        {/* Paid, and then the share grew: the payments so far, and what is still to pay on top. */}
        {topUp && (
          <>
            {history.map((paid, i) => (
              <p key={i} className="paybar-note paybar-copied">
                ✓{" "}
                {paid.received
                  ? t("{amount} bezahlt – von {name} bestätigt", { amount: formatMoney(paid.amount, data.currency), name: ownerName || t("dem Rechnungssteller") })
                  : t("{amount} als bezahlt markiert", { amount: formatMoney(paid.amount, data.currency) })}
              </p>
            ))}
            {!payment && due > 0 && (
              <p className="paybar-note paybar-grown">
                {t("Dein Anteil ist nach Deiner Zahlung gestiegen – es fehlen noch {amount}.", { amount: formatMoney(due, data.currency) })}
              </p>
            )}
          </>
        )}

        {/* The bill changed after I paid: the difference is mine (it counts in the dashboard) – and what changed. */}
        {snapshot.myRefund ? (
          <div className="paybar-refund-box">
            <p className="paybar-note paybar-refund">
              {!change
                ? t("Du hast mehr bezahlt, als Dein Anteil jetzt beträgt – {name} schuldet Dir {amount}.", {
                    name: ownerName || t("Der Rechnungssteller"),
                    amount: formatMoney(snapshot.myRefund, data.currency),
                  })
                : change.kind === "shared"
                  ? t("{by} hat „{items}“ nachträglich mit Dir geteilt – darum schuldet Dir {name} jetzt wieder {amount} zurück. Das wird im Dashboard vermerkt und gerät nicht in Vergessenheit!", {
                      by: change.byName,
                      items: change.items.map((i) => i.name).join("“, „"),
                      name: ownerName || t("der Rechnungssteller"),
                      amount: formatMoney(snapshot.myRefund, data.currency),
                    })
                  : participants.some((p) => p.id === change.byId && p.isOwner)
                    ? t("{name} hat die Rechnung nachträglich geändert und schuldet Dir jetzt {amount} zurück. Das wird im Dashboard vermerkt und gerät nicht in Vergessenheit!", {
                        name: change.byName,
                        amount: formatMoney(snapshot.myRefund, data.currency),
                      })
                    : t("{by} hat die Rechnung nachträglich geändert – darum schuldet Dir {name} jetzt {amount} zurück. Das wird im Dashboard vermerkt und gerät nicht in Vergessenheit!", {
                        by: change.byName,
                        name: ownerName || t("der Rechnungssteller"),
                        amount: formatMoney(snapshot.myRefund, data.currency),
                      })}
            </p>
            {onContest &&
              change?.kind === "shared" &&
              (contesting ? (
                <p className="paybar-note paybar-contest-hint">
                  {t("Tippe in der Rechnung bei „{items}“ auf {by}, um den Anteil wegzuklicken.", {
                    items: change.items.map((i) => i.name).join("“, „"),
                    by: change.byName,
                  })}
                </p>
              ) : (
                <button type="button" className="btn btn-ghost btn-contest" onClick={onContest}>
                  {t("Stimmt nicht?")}
                </button>
              ))}
          </div>
        ) : null}

        {snapshot.myCredit?.notes.map(tMsg).map((note) => (
          <p key={note} className="paybar-note">
            ✓ {note}
          </p>
        ))}

        {payment && (
          <p className="paybar-note">
            ✓{" "}
            {due > 0
              ? topUp
                ? t("Nachzahlung über {amount} an {name} gestartet – durch Deine neue Auswahl kommen {extra} dazu.", {
                    amount: formatMoney(payment.amount, data.currency),
                    name: ownerName || t("den Rechnungssteller"),
                    extra: formatMoney(due, data.currency),
                  })
                : t("Bezahlung über {amount} an {name} gestartet – durch Deine neue Auswahl kommen {extra} dazu.", {
                    amount: formatMoney(payment.amount, data.currency),
                    name: ownerName || t("den Rechnungssteller"),
                    extra: formatMoney(due, data.currency),
                  })
              : topUp
                ? t("Nachzahlung über {amount} an {name} gestartet.", {
                    amount: formatMoney(payment.amount, data.currency),
                    name: ownerName || t("den Rechnungssteller"),
                  })
                : t("Bezahlung über {amount} an {name} gestartet.", {
                    amount: formatMoney(payment.amount, data.currency),
                    name: ownerName || t("den Rechnungssteller"),
                  })}
          </p>
        )}

        {asking && payment && (
          <div className="paybar-ask" role="alertdialog" aria-label={t("Hast Du bezahlt?")}>
            <p>
              {t("Hast Du {amount} an {name} gesendet?", {
                amount: formatMoney(payment.amount, data.currency),
                name: ownerName || t("den Rechnungssteller"),
              })}
            </p>
            <div className="paybar-ask-actions">
              <button
                type="button"
                className="btn btn-mark"
                onClick={() => {
                  onMarkPaid(true);
                  setAskPaid(false);
                }}
              >
                ✓ {t("Ja, gesendet")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setAskPaid(false)}>
                {t("Noch nicht")}
              </button>
            </div>
          </div>
        )}

        {!confirmed && !coveredByCredit && !asking && (
          <>
            {payment && nothing && action.kind !== "none" && (
              <a
                className="btn btn-done btn-large"
                href={action.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (action.kind === "paypalMe") copyText(centsToInput(payment.amount));
                  leaving();
                }}
              >
                {t("PayPal erneut öffnen")}
              </a>
            )}
            {payment && nothing && action.kind === "none" && others.length > 0 && (
              <button type="button" className="btn btn-done btn-large" onClick={() => openSheet(others[0], false)}>
                {t("Zahlungsdaten erneut anzeigen")}
              </button>
            )}
            {payment && nothing && (
              <button
                type="button"
                className={`btn btn-large ${payment.markedPaidAt ? "btn-done btn-marked" : "btn-mark"}`}
                aria-pressed={Boolean(payment.markedPaidAt)}
                onClick={() => onMarkPaid(!payment.markedPaidAt)}
              >
                {payment.markedPaidAt ? t("✓ Als bezahlt markiert") : t("Als bezahlt markieren")}
              </button>
            )}
            {payment?.markedPaidAt && nothing && (
              <p className="paybar-note">
                {t("{name} sieht das jetzt. Nochmal tippen macht es rückgängig.", { name: ownerName || t("Der Rechnungssteller") })}
              </p>
            )}

            {action.kind === "paypalMe" && !(payment && nothing) && !ready && (
              <button
                type="button"
                className={`btn btn-paypal btn-large${nothing ? " disabled" : ""}`}
                disabled={nothing}
                onPointerDown={nothing ? undefined : clickPress}
                onClick={() => {
                  prepareAmount();
                  clickRelease();
                }}
              >
                {nothing ? t("Hake Deine Positionen ab") : t("Anteil begleichen · {amount}", { amount: formatMoney(due, data.currency) })}
              </button>
            )}
            {action.kind === "paypalMe" && !(payment && nothing) && ready && (
              <>
                <p className="paybar-note paybar-copied">
                  {ready.copied ? (
                    <>
                      ✓ {t("{amount} in die Zwischenablage kopiert –", { amount: formatMoney(due, data.currency) })}
                      <span className="paybar-oneline" ref={oneLine}>
                        {t("in PayPal ins Betragsfeld tippen und „Einfügen“ wählen.")}
                      </span>
                    </>
                  ) : (
                    t("Trag in PayPal {amount} ein.", { amount: formatMoney(due, data.currency) })
                  )}
                </p>
                <a
                  className="btn btn-paypal btn-large"
                  href={action.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    onPay();
                    leaving();
                  }}
                >
                  {t("Mit PayPal bezahlen · {amount}", { amount: formatMoney(due, data.currency) })}
                </a>
              </>
            )}

            {/* PayPal by e-mail address: the same two taps – the amount is copied first, then PayPal opens. */}
            {action.kind === "email" && !(payment && nothing) && !ready && (
              <button
                type="button"
                className={`btn btn-paypal btn-large${nothing ? " disabled" : ""}`}
                disabled={nothing}
                onPointerDown={nothing ? undefined : clickPress}
                onClick={() => {
                  prepareAmount();
                  clickRelease();
                }}
              >
                {nothing ? t("Hake Deine Positionen ab") : t("Anteil begleichen · {amount}", { amount: formatMoney(due, data.currency) })}
              </button>
            )}
            {action.kind === "email" && !(payment && nothing) && ready && (
              <>
                <p className="paybar-note paybar-copied">
                  {ready.copied ? (
                    <>
                      ✓ {t("{amount} in die Zwischenablage kopiert –", { amount: formatMoney(due, data.currency) })}
                      <span className="paybar-oneline" ref={oneLine}>
                        {t("in PayPal ins Betragsfeld tippen und „Einfügen“ wählen.")}
                      </span>
                    </>
                  ) : (
                    t("Trag in PayPal {amount} ein.", { amount: formatMoney(due, data.currency) })
                  )}
                </p>
                <a
                  className="btn btn-paypal btn-large"
                  href={action.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    onPay();
                    leaving();
                  }}
                >
                  {t("In PayPal bezahlen · {amount}", { amount: formatMoney(due, data.currency) })}
                </a>
                <p className="paybar-note">
                  {rich(t("Sende {amount} an <b>{email}</b>", { amount: formatMoney(due, data.currency), email: action.email }))}{" "}
                  <button type="button" className="link" onClick={() => copyEmail(action.email)}>
                    {copied ? t("(Adresse kopiert)") : t("Adresse kopieren")}
                  </button>
                </p>
              </>
            )}

            {/* Without PayPal the main button opens the bank / Wero details. */}
            {action.kind === "none" && others.length > 0 && !(payment && nothing) && (
              <button
                type="button"
                className={`btn btn-paypal btn-large${nothing ? " disabled" : ""}`}
                disabled={nothing}
                onPointerDown={nothing ? undefined : clickPress}
                onClick={() => {
                  openSheet(others[0]);
                  clickRelease();
                }}
              >
                {nothing ? t("Hake Deine Positionen ab") : t("Anteil begleichen · {amount}", { amount: formatMoney(due, data.currency) })}
              </button>
            )}
            {/* With PayPal as the main way, bank transfer and Wero are offered below it. */}
            {action.kind !== "none" && others.length > 0 && !nothing && (
              <button type="button" className="link paybar-other" onClick={() => openSheet(others[0])}>
                {otherLabel}
              </button>
            )}
            {/* No way to pay in the app: pay in person, then mark it – so the payer sees it and can tick "erhalten". */}
            {action.kind === "none" && others.length === 0 && !(payment && nothing) && (
              <>
                <p className="paybar-note">
                  {t("{name} hat keine Zahlungsdaten hinterlegt.", { name: ownerName || t("Der Rechnungssteller") })}{" "}
                  {!nothing && t("Gib den Betrag direkt, z.B. bar – und markiere ihn dann als bezahlt.")}
                </p>
                {!nothing && onPaidInPerson && (
                  <button type="button" className="btn btn-large btn-mark" onClick={onPaidInPerson}>
                    {t("Als bezahlt markieren")}
                  </button>
                )}
              </>
            )}
          </>
        )}
        {sheet && (
          <TransferSheet
            payment={data.payment}
            methods={others}
            initial={sheet}
            amount={nothing ? (payment?.amount ?? share.total) : due}
            currency={data.currency}
            ownerName={ownerName}
            reference={reference}
            onClose={() => {
              setSheet(null);
              // Copied the details and paid in the banking app meanwhile? Ask once the sheet is closed.
              if (away.current !== "no") {
                away.current = "no";
                setAskPaid(true);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
