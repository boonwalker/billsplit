import { useState } from "react";
import { api } from "../lib/api";
import type { NetworkEdge } from "../lib/bill";
import { formatMoney } from "../lib/money";
import { sameAllocations, settlementWith } from "../lib/settle";
import PayButtons from "./PayButtons";

interface Props {
  /** The person's participant id and name. */
  person: { id: string; name: string };
  currency: string;
  me: string;
  edges: NetworkEdge[];
  myName: string;
  /** Loads the open shares again (to check nothing changed before recording). */
  reload: () => Promise<{ me: string; edges: NetworkEdge[] }>;
  onClose: (changed: boolean) => void;
}

type Stage = "review" | "booking" | "done";

/**
 * Settling up with one person across all bills: every open amount bill by bill, the net
 * amount and – in one settlement payment, like the overall plan – booking all of it at once:
 * - I owe them: pay (PayPal, bank transfer, Wero), then it waits for them to confirm it.
 * - They owe me: once the money is there, I record it (confirmed right away, they are told).
 * - It evens out exactly: offset both sides; they confirm.
 * Until it is confirmed the shares count as paid in every bill (nobody pays twice).
 */
export default function SettleSheet({ person, currency, me, edges: shownEdges, myName, reload, onClose }: Props) {
  const [edges, setEdges] = useState(shownEdges);
  const [stage, setStage] = useState<Stage>("review");
  const [notice, setNotice] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ net: number } | null>(null);
  const s = settlementWith(me, person.id, edges, currency);
  const { net } = s;
  const bills = new Set(s.edges.map((e) => e.billId)).size;
  const fmt = (c: number) => formatMoney(c, currency);
  const inBills = bills === 1 ? "der Rechnung" : `allen ${bills} Rechnungen`;

  /** Records the settlement – but only if the open amounts are still the ones shown (and paid). */
  async function book() {
    setNotice(null);
    setStage("booking");
    try {
      const fresh = await reload();
      const now = settlementWith(fresh.me, person.id, fresh.edges, currency);
      if (!sameAllocations(now.allocations, s.allocations)) {
        setEdges(fresh.edges);
        setNotice(
          now.edges.length
            ? "Die Beträge haben sich gerade geändert. Bitte prüfe die neue Aufstellung – noch wurde nichts eingetragen."
            : `Mit ${person.name} ist inzwischen alles ausgeglichen – noch wurde nichts eingetragen.`,
        );
        setStage("review");
        return;
      }
      await api.createTransfer({
        toId: net > 0 ? me : person.id,
        ...(net > 0 ? { fromId: person.id } : {}),
        amount: Math.abs(net),
        currency,
        allocations: s.allocations,
      });
      setBooked({ net });
      setStage("done");
    } catch (e) {
      setNotice(`${e instanceof Error ? e.message : "Das Eintragen ist fehlgeschlagen."} Es wurde nichts eingetragen.`);
      setStage("review");
    }
  }

  const reference = `billsplit · Ausgleich ${myName ? `von ${myName} ` : ""}(${bills} ${bills === 1 ? "Rechnung" : "Rechnungen"})`.slice(0, 140);

  return (
    <div className="sheet-backdrop settle-backdrop" onClick={(e) => e.target === e.currentTarget && stage !== "booking" && onClose(stage === "done")}>
      <div className="sheet settle-sheet" role="dialog" aria-label={`Mit ${person.name} ausgleichen`}>
        <h2>Mit {person.name} ausgleichen</h2>

        {stage === "done" && booked ? (
          <>
            {booked.net < 0 ? (
              <>
                <p className="settle-done">✓ Eingetragen – wartet auf die Bestätigung von {person.name}.</p>
                <p className="muted small">
                  Bis dahin gelten Deine Anteile als bezahlt. Bestätigt {person.name} den Eingang, ist alles in {inBills} beglichen.
                </p>
              </>
            ) : booked.net > 0 ? (
              <>
                <p className="settle-done">✓ In {inBills} als erhalten eingetragen.</p>
                <p className="muted small">{person.name} sieht im Dashboard und in den Rechnungen, dass alles beglichen ist.</p>
              </>
            ) : (
              <>
                <p className="settle-done">✓ Verrechnung vorgeschlagen – wartet auf die Bestätigung von {person.name}.</p>
                <p className="muted small">Bis dahin gelten die Beträge als verrechnet.</p>
              </>
            )}
            <button type="button" className="btn btn-primary btn-large" onClick={() => onClose(true)}>
              Fertig
            </button>
          </>
        ) : (
          <>
            {/* Bill by bill, so every euro can be traced to its bill. */}
            <ul className="settle-entries">
              {s.edges.map((e) => (
                <li key={`${e.billId}:${e.debtorId}`}>
                  <span>
                    <b>{e.title}</b>
                    <small className="muted">{e.debtorId === me ? `Du schuldest ${person.name}` : `${person.name} schuldet Dir`}</small>
                  </span>
                  <span className="settle-amount">
                    {e.debtorId === me ? "−" : "+"}
                    {fmt(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
            {s.edges.length > 0 && (
              <p className="settle-total">
                {net < 0 ? (
                  <>
                    Du zahlst {person.name} <b>{fmt(-net)}</b>
                  </>
                ) : net > 0 ? (
                  <>
                    {person.name} zahlt Dir <b>{fmt(net)}</b>
                  </>
                ) : (
                  <>Gleicht sich genau aus</>
                )}
              </p>
            )}

            {notice && <p className="alert">{notice}</p>}

            {/* I pay: recorded only after paying; then it waits for them to confirm it. */}
            {s.edges.length > 0 && net < 0 && (
              <PayButtons
                payment={s.payment ?? {}}
                amount={-net}
                currency={currency}
                recipient={person.name}
                reference={reference}
                confirmLabel={`✓ Gesendet – ${person.name} bestätigen lassen`}
                onConfirm={book}
                busy={stage === "booking"}
              />
            )}

            {/* They pay me: record it once the money is there. */}
            {s.edges.length > 0 && net > 0 && stage === "review" && (
              <>
                <p className="muted small">{person.name} sieht den Ausgleich im eigenen Dashboard. Sobald das Geld da ist, trag es hier ein.</p>
                <button type="button" className="btn btn-primary btn-large" onClick={book}>
                  ✓ {fmt(net)} erhalten – eintragen
                </button>
              </>
            )}
            {s.edges.length > 0 && net === 0 && stage === "review" && (
              <>
                <p className="muted small">Ihr schuldet Euch gegenseitig gleich viel. {person.name} bestätigt die Verrechnung im Dashboard.</p>
                <button type="button" className="btn btn-primary btn-large" onClick={book}>
                  Gegenseitig verrechnen
                </button>
              </>
            )}
            {stage === "booking" && net >= 0 && <p className="muted small">Wird eingetragen …</p>}

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
