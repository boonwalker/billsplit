import { Fragment } from "react";
import { formatTime, rich, t, tMsg } from "../lib/i18n";
import {
  isSettledPayment,
  openShare,
  billTotal,
  equalShare,
  poolTotal,
  perHeadFees,
  sharedPerPerson,
  sharedTotal,
  splitHeadCount,
  splitPeople,
  tipPerHead,
  unassignedAmount,
  type BillData,
  type BillSnapshot,
  type Debtor,
} from "../lib/bill";
import { formatMoney } from "../lib/money";
import RemindButton, { remindedAgo } from "./RemindButton";

interface Props {
  snapshot: BillSnapshot;
  /** With `topUp` (its index): a payment made on top later (see TopUp). */
  onToggleReceived: (debtor: Debtor, received: boolean, topUp?: number) => void;
  /** The bill's link, for reminders via WhatsApp. */
  shareUrl?: string;
  /** Sends a reminder as a notification (for friends it reaches). */
  onRemind?: (debtor: Debtor) => Promise<void>;
}

/** Switch for the payer: split the whole bill equally instead of ticking items (e.g. supermarket receipts). */
export function EqualSplitToggle({ snapshot, onUpdateData }: { snapshot: BillSnapshot; onUpdateData: (data: BillData) => void }) {
  const on = Boolean(snapshot.data.equalSplit);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`equal-toggle${on ? " on" : ""}`}
      onClick={() => onUpdateData({ ...snapshot.data, equalSplit: on ? undefined : true })}
    >
      <span className="equal-toggle-text">
        <b>{t("Gleichverteilung")}</b>
        <small>{on ? t("Alle zahlen gleich viel – Abhaken ist aus.") : t("Alle zahlen gleich viel, z.B. beim Supermarkt-Einkauf.")}</small>
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

/**
 * Shown above the bill for the payer: how many people share tip and fees (or, with an equal split, the whole bill). Defaults to everyone who joined; the payer can
 * raise it when someone will only scan later (e.g. the next day).
 */
export function TipSplit({ snapshot, onUpdateData }: { snapshot: BillSnapshot; onUpdateData: (data: BillData) => void }) {
  const { data, participants } = snapshot;
  const joined = splitPeople(data, participants).length;
  // "Andy zahlt 5,00 €": the payer is not part of the equal split.
  const withoutMe = Boolean(data.equalSplit && data.ownerExcluded);
  const count = splitHeadCount(data, participants);
  const missing = count - joined;
  const setCount = (n: number) => onUpdateData({ ...data, tipSplitCount: n <= joined ? undefined : n });
  const equal = Boolean(data.equalSplit);
  // Lines given to particular people (long press) are not part of what is split.
  const shared = formatMoney(equal ? poolTotal(data, participants) : sharedTotal(data), data.currency);
  const perPerson = formatMoney(equal ? equalShare(data, participants) : sharedPerPerson(data, participants), data.currency);

  return (
    <div className="tip-split-panel">
      <div className="row between">
        <span>
          {rich(
            equal
              ? t("<b>Rechnung {amount}</b> aufteilen auf", { amount: shared })
              : perHeadFees(data) !== 0
                ? tipPerHead(data) !== 0
                  ? t("<b>Gebühren & Trinkgeld {amount}</b> aufteilen auf", { amount: shared })
                  : t("<b>Gebühren {amount}</b> aufteilen auf", { amount: shared })
                : t("<b>Trinkgeld {amount}</b> aufteilen auf", { amount: shared }),
          )}
        </span>
        <div className="stepper-mini" role="group" aria-label={t("Personen für Trinkgeld und Gebühren")}>
          <button type="button" onClick={() => setCount(count - 1)} disabled={count <= joined} aria-label={t("Eine Person weniger")}>
            −
          </button>
          <span>{count}</span>
          <button type="button" onClick={() => setCount(count + 1)} disabled={count >= 100} aria-label={t("Eine Person mehr")}>
            +
          </button>
        </div>
      </div>
      <p className="muted small">
        {withoutMe
          ? count === 1
            ? t("{amount} für eine Person – Du bist nicht dabei", { amount: perPerson })
            : t("{amount} pro Person · {count} Personen – Du bist nicht dabei", { amount: perPerson, count })
          : missing > 0
          ? missing === 1
            ? t("{amount} pro Person · {joined} beigetreten (inkl. Dir), {missing} kommt noch dazu", { amount: perPerson, joined, missing })
            : t("{amount} pro Person · {joined} beigetreten (inkl. Dir), {missing} kommen noch dazu", { amount: perPerson, joined, missing })
          : t("{amount} pro Person · gezählt: alle, die beigetreten sind, plus Du", { amount: perPerson })}
      </p>
    </div>
  );
}

function time(iso: string): string {
  return formatTime(iso, { hour: "2-digit", minute: "2-digit" });
}

/** The payer got everything back: friends joined and "Dir fehlen noch" is 0,00 €. */
/** What the list of bills shows for the payer: still missing, or settled. */
export function ownerStatus(snapshot: BillSnapshot): { settled: boolean; missing: number; currency: string } {
  return { settled: isSettled(snapshot), missing: ownerSummary(snapshot).missing, currency: snapshot.data.currency };
}

export function isSettled(snapshot: BillSnapshot): boolean {
  return (snapshot.debtors ?? []).length > 0 && ownerSummary(snapshot).missing === 0;
}

/**
 * The payer's sums. What is missing is exactly what the friends are asked to pay (their shares,
 * as their bill shows them) plus what nobody has yet – never "total minus my share": with
 * rounding (6,55 € / 2 = 3,28 € each) that would be a cent off. The payer's own share is what is
 * left of the total, so the payer carries the rounding cent and the lines still add up.
 */
export function ownerSummary(snapshot: BillSnapshot) {
  const total = billTotal(snapshot.data);
  const debtors = snapshot.debtors ?? [];
  const unassigned = unassignedAmount(snapshot.data, snapshot.participants);
  const others = debtors.reduce((s, d) => s + d.amount, 0);
  const own = Math.max(0, total - others - unassigned);
  // Confirmed as received (top-ups too), plus what confirmed settlement payments covered (never more than the share).
  const received = debtors.reduce(
    (s, d) =>
      s +
      Math.min(
        d.amount,
        (d.received ? (d.payAmount ?? d.amount) : 0) + (d.topUps ?? []).reduce((sum, top) => sum + (top.received ? top.amount : 0), 0) + (d.credited ?? 0),
      ),
    0,
  );
  return { total, own, received, missing: Math.max(0, others + unassigned - received), unassigned };
}

/** What only the payer sees below the bill: who scanned, who tapped pay, what is still missing. */
export default function OwnerPanel({ snapshot, onToggleReceived, shareUrl, onRemind }: Props) {
  const currency = snapshot.data.currency;
  const title = snapshot.data.title || t("die Rechnung");
  const openOf = (d: Debtor) => openShare(d.amount, d, (d.credited ?? 0) + (d.creditPending ?? 0));
  /** Their share grew after they had paid, and nobody started paying the difference yet. */
  const grownBy = (d: Debtor) => {
    const last = d.topUps?.at(-1);
    return isSettledPayment(d) && !(last && !isSettledPayment(last)) ? openOf(d) : 0;
  };
  /** Not ticked anything yet (and no equal split, where nothing needs ticking). */
  const nothingTicked = (d: Debtor) => d.amount === 0 && !snapshot.data.equalSplit;
  const reminder = (d: Debtor) =>
    nothingTicked(d)
      ? t("Hi {name}, kleine Erinnerung von klicksplit: Bitte hake in „{title}“ ab, was Du hattest. Hier geht's zur Rechnung: {url}", {
          name: d.name,
          title,
          url: shareUrl ?? "",
        })
      : t("Hi {name}, kleine Erinnerung von klicksplit: Für „{title}“ sind bei Dir noch {amount} offen. Hier kannst Du direkt begleichen: {url}", {
          name: d.name,
          title,
          amount: formatMoney(openOf(d), currency),
          url: shareUrl ?? "",
        });
  const debtors = snapshot.debtors ?? [];
  const { total, own, received, missing, unassigned } = ownerSummary(snapshot);

  return (
    <section className="owner-panel" aria-labelledby="owner-title">
      <div className="panel-head">
        <h3 id="owner-title">{t("Deine Freunde")}</h3>
        <span className="pill">{t("{n} beigetreten", { n: debtors.length })}</span>
      </div>

      {debtors.length === 0 ? (
        <p className="muted empty">
          {t("Noch ist niemand Deiner Abrechnung beigetreten. Sobald jemand beitritt, taucht er hier mit seinem Namen auf.")}
        </p>
      ) : (
        <ul className="debtors">
          {debtors.map((d) => {
            const changed = d.payAmount !== undefined && d.payAmount !== d.amount && !isSettledPayment(d);
            const grown = grownBy(d);
            return (
              <Fragment key={d.id}>
              <li data-id={d.id} className={`debtor${d.received ? " received" : ""}${d.payClickedAt ? " announced" : ""}`}>
                <span className="avatar" aria-hidden="true">
                  {d.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="debtor-main">
                  <span className="debtor-name">{d.name}</span>
                  <span className="debtor-status">
                    {d.received
                      ? t("Zahlungseingang bestätigt")
                      : d.amount > 0 && (d.credited ?? 0) >= d.amount
                        ? t("per Ausgleich beglichen")
                        : d.amount > 0 && (d.credited ?? 0) + (d.creditPending ?? 0) >= d.amount
                          ? t("Ausgleich gesendet – bestätige ihn im Dashboard")
                      : d.markedPaidAt
                        ? t("hat um {time} als bezahlt markiert", { time: time(d.markedPaidAt) })
                        : d.payClickedAt
                        ? t("hat um {time} auf Bezahlen getippt", { time: time(d.payClickedAt) })
                        : d.assigned
                          ? t("von Dir zugeordnet · {amount} offen", { amount: formatMoney(d.amount, currency) })
                        : snapshot.data.equalSplit || d.amount > 0
                          ? t("ist beigetreten")
                          : t("ist beigetreten · wählt noch aus …")}
                    {changed && <> · {t("Auswahl jetzt {amount}", { amount: formatMoney(d.amount, currency) })}</>}
                  </span>
                  {d.remindedAt && !d.received && !d.markedPaidAt && <span className="debtor-reminded">{t("per Mitteilung erinnert {ago}", { ago: remindedAgo(d.remindedAt) })}</span>}
                  {/* Settled (partly) by settlement payments from the dashboard. */}
                  {/* Paid more than the share is now: the payer owes it back (it counts in the dashboard). */}
                  {d.refund ? (
                    <span className="debtor-refund">{t("Du schuldest {name} {amount} zurück", { name: d.name, amount: formatMoney(d.refund, currency) })}</span>
                  ) : null}
                  {d.creditNotes?.map(tMsg).map((note) => (
                    <span key={note} className="debtor-credit">
                      {note}
                    </span>
                  ))}
                </span>
                {/* Their share – what they set out to pay, else what they have now (also without payment details in the bill). */}
                {(d.payAmount ?? d.amount) > 0 && <span className="debtor-amount">{formatMoney(d.payAmount ?? d.amount, currency)}</span>}
                {/* Still open (or nothing ticked yet): a friendly nudge – as a notification where it reaches them, else via WhatsApp. */}
                {shareUrl && !d.received && !d.markedPaidAt && (openOf(d) > 0 || nothingTicked(d)) && (
                  <RemindButton
                    name={d.name}
                    reachable={d.reachable && Boolean(onRemind)}
                    remindedAt={d.remindedAt}
                    whatsappText={reminder(d)}
                    onPush={() => onRemind!(d)}
                  />
                )}
                {d.payClickedAt && (
                  <label className="received-toggle" title={t("Geld ist auf PayPal angekommen")}>
                    <input type="checkbox" checked={d.received} onChange={(e) => onToggleReceived(d, e.target.checked)} />
                    <span>{t("erhalten")}</span>
                  </label>
                )}
              </li>
              {/* Paid, and then the share grew: each payment on top is a line of its own, confirmed on its own. */}
              {d.topUps?.map((top, i) => (
                <li key={`${d.id}-${i}`} className={`debtor debtor-topup${top.received ? " received" : " announced"}`}>
                  <span className="avatar avatar-topup" aria-hidden="true">
                    +
                  </span>
                  <span className="debtor-main">
                    <span className="debtor-name">{t("{name} · Nachzahlung", { name: d.name })}</span>
                    <span className="debtor-status">
                      {top.received
                        ? t("Zahlungseingang bestätigt")
                        : top.markedPaidAt
                          ? t("hat um {time} als bezahlt markiert", { time: time(top.markedPaidAt) })
                          : t("hat um {time} auf Bezahlen getippt", { time: time(top.payClickedAt) })}
                    </span>
                  </span>
                  <span className="debtor-amount">{formatMoney(top.amount, currency)}</span>
                  <label className="received-toggle" title={t("Geld ist auf PayPal angekommen")}>
                    <input
                      type="checkbox"
                      checked={Boolean(top.received)}
                      onChange={(e) => onToggleReceived(d, e.target.checked, i)}
                      aria-label={t("Nachzahlung von {name} erhalten", { name: d.name })}
                    />
                    <span>{t("erhalten")}</span>
                  </label>
                </li>
              ))}
              {grown > 0 && (
                <li className="debtor debtor-topup">
                  <span className="avatar avatar-topup" aria-hidden="true">
                    +
                  </span>
                  <span className="debtor-main">
                    <span className="debtor-name">{t("{name} · Nachzahlung", { name: d.name })}</span>
                    <span className="debtor-status">{t("Auswahl nach der Zahlung erweitert – noch offen")}</span>
                  </span>
                  <span className="debtor-amount">{formatMoney(grown, currency)}</span>
                </li>
              )}
              </Fragment>
            );
          })}
        </ul>
      )}

      <dl className="owner-sums">
        <dt>{t("Rechnung gesamt")}</dt>
        <dd>{formatMoney(total, currency)}</dd>
        <dt>{t("Dein eigener Anteil")}</dt>
        <dd>− {formatMoney(own, currency)}</dd>
        <dt>{t("Schon erhalten")}</dt>
        <dd>− {formatMoney(received, currency)}</dd>
        <dt className="strong">{t("Dir fehlen noch")}</dt>
        <dd className="strong">{formatMoney(missing, currency)}</dd>
      </dl>
      {unassigned > 0 && snapshot.data.equalSplit && (
        <p className="hint">
          {t("{amount} entfallen auf Personen, die noch nicht beigetreten sind.", { amount: formatMoney(unassigned, currency) })}
        </p>
      )}
      {unassigned > 0 && !snapshot.data.equalSplit && (
        <p className="hint">
          {t("{amount} sind noch keiner Person zugeordnet – hast Du Deine eigenen Positionen schon abgehakt?", {
            amount: formatMoney(unassigned, currency),
          })}
          {splitHeadCount(snapshot.data, snapshot.participants) > snapshot.participants.length && (
            <> {t("Darin enthalten sind auch Anteile an Trinkgeld und Gebühren von Personen, die noch nicht beigetreten sind.")}</>
          )}
        </p>
      )}
      {debtors.length > 0 && (
        <p className="hint muted">
          {t("Gleiche die Beträge mit den Eingängen in Deiner PayPal-App ab und hake „erhalten“ an, sobald das Geld da ist.")}
        </p>
      )}
    </section>
  );
}
