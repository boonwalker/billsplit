import { useState } from "react";
import type { PersonBalance } from "../lib/balances";
import { formatMoney } from "../lib/money";
import { bookSettlement, netOf, sameEntries } from "../lib/settle";
import PayButtons from "./PayButtons";

interface Props {
  person: PersonBalance;
  currency: string;
  myName: string;
  /** Loads the current open amounts with this person again (null when they are all settled). */
  reload: () => Promise<PersonBalance | null>;
  onClose: (changed: boolean) => void;
}

type Stage = "review" | "booking" | "done";

/**
 * Settling up with one person across all bills: every open amount bill by bill, the net
 * amount, the way to pay it (PayPal, bank transfer, Wero) and – once paid – booking it in
 * each bill: my shares in their bills as paid, their shares in mine as received.
 */
export default function SettleSheet({ person: shown, currency, myName, reload, onClose }: Props) {
  const [person, setPerson] = useState(shown);
  const [stage, setStage] = useState<Stage>("review");
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const net = netOf(person);
  const pay = -net;
  const bills = new Set(person.entries.map((e) => e.billId)).size;
  const fmt = (c: number) => formatMoney(c, currency);
  const inBills = bills === 1 ? "der Rechnung" : `allen ${bills} Rechnungen`;

  /** Books everything – but only if the amounts are still the ones that were paid / shown. */
  async function book() {
    setNotice(null);
    setStage("booking");
    try {
      const current = await reload();
      if (!current || !sameEntries(current.entries, person.entries)) {
        if (current) setPerson(current);
        setNotice("Die Beträge haben sich gerade geändert. Bitte prüfe die neue Aufstellung – noch wurde nichts eingetragen.");
        setStage("review");
        if (!current) onClose(true);
        return;
      }
      await bookSettlement(person.entries, setProgress);
      setStage("done");
    } catch (e) {
      setNotice(`${e instanceof Error ? e.message : "Das Eintragen ist fehlgeschlagen."} Bereits Eingetragenes bleibt – bitte nochmal versuchen.`);
      setStage("review");
    }
  }

  const reference = `billsplit · Ausgleich ${myName ? `von ${myName} ` : ""}(${bills} ${bills === 1 ? "Rechnung" : "Rechnungen"})`.slice(0, 140);

  return (
    <div className="sheet-backdrop settle-backdrop" onClick={(e) => e.target === e.currentTarget && stage !== "booking" && onClose(stage === "done")}>
      <div className="sheet settle-sheet" role="dialog" aria-label={`Mit ${person.name} ausgleichen`}>
        <h2>Mit {person.name} ausgleichen</h2>

        {stage === "done" ? (
          <>
            <p className="settle-done">✓ In {inBills} eingetragen.</p>
            <p className="muted small">
              {person.owed > 0 && <>{person.name} sieht in den eigenen Rechnungen, dass Du bezahlt hast. </>}
              {person.lent > 0 && <>In Deinen Rechnungen ist der Anteil von {person.name} als erhalten markiert.</>}
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={() => onClose(true)}>
              Fertig
            </button>
          </>
        ) : (
          <>
            {/* Bill by bill, so every euro can be traced to its bill. */}
            <ul className="settle-entries">
              {person.entries.map((e) => (
                <li key={`${e.billId}-${e.direction}`}>
                  <span>
                    <b>{e.title}</b>
                    <small className="muted">{e.direction === "owed" ? `Du schuldest ${person.name}` : `${person.name} schuldet Dir`}</small>
                  </span>
                  <span className="settle-amount">
                    {e.direction === "owed" ? "−" : "+"}
                    {fmt(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="settle-total">
              {net < 0 ? (
                <>
                  Du zahlst {person.name} <b>{fmt(pay)}</b>
                </>
              ) : net > 0 ? (
                <>
                  {person.name} zahlt Dir <b>{fmt(net)}</b>
                </>
              ) : (
                <>Gleicht sich genau aus</>
              )}
            </p>

            {notice && <p className="alert">{notice}</p>}
            {stage === "booking" && progress > 0 && <p className="muted small">Wird eingetragen … ({progress} von {person.entries.length})</p>}

            {/* I pay: only after paying is it booked in the bills. */}
            {net < 0 && (
              <PayButtons
                payment={person.payment ?? {}}
                amount={pay}
                currency={currency}
                recipient={person.name}
                reference={reference}
                confirmLabel={`✓ Bezahlt – in ${inBills} eintragen`}
                onConfirm={book}
                busy={stage === "booking"}
              />
            )}

            {/* They pay me (or it evens out): confirm once the money is there. */}
            {net > 0 && stage === "review" && (
              <>
                <p className="muted small">{person.name} sieht den Ausgleich im eigenen Dashboard. Sobald das Geld da ist, trag es hier ein.</p>
                <button type="button" className="btn btn-primary btn-large" onClick={book}>
                  ✓ {fmt(net)} erhalten – eintragen
                </button>
              </>
            )}
            {net === 0 && stage === "review" && (
              <button type="button" className="btn btn-primary btn-large" onClick={book}>
                Gegenseitig verrechnen
              </button>
            )}

            {stage !== "booking" && (
              <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>
                Schließen
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
