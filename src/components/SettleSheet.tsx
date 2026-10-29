import { useEffect, useState } from "react";
import { api, type ReminderStatus } from "../lib/api";
import { billUrl, withRecipient } from "../lib/bill";
import { DEMO } from "../lib/demo";
import type { NetworkEdge } from "../lib/bill";
import type { HistoryEntry } from "../lib/balances";
import { formatDate, rich, t } from "../lib/i18n";
import { formatMoney } from "../lib/money";
import { sameAllocations, settlementWith } from "../lib/settle";
import PayButtons from "./PayButtons";
import RemindButton, { remindedAgo } from "./RemindButton";
import { BillEntry } from "./SettlementPanel";

interface Props {
  /** The person's participant id and name. */
  person: { id: string; name: string };
  /** Every bill shared with them, newest first – also the settled ones. */
  history?: HistoryEntry[];
  currency: string;
  me: string;
  edges: NetworkEdge[];
  myName: string;
  /** Loads the open shares again (to check nothing changed before recording). */
  reload: () => Promise<{ me: string; edges: NetworkEdge[] }>;
  onClose: (changed: boolean) => void;
  /** Opens a bill at the place of a participant's share. */
  onOpenBill?: (billId: string, participantId: string) => void;
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
export default function SettleSheet({ person, history = [], currency, me, edges: shownEdges, myName, reload, onClose, onOpenBill }: Props) {
  const [edges, setEdges] = useState(shownEdges);
  const [stage, setStage] = useState<Stage>("review");
  const [notice, setNotice] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ net: number } | null>(null);
  const s = settlementWith(me, person.id, edges, currency);
  const { net } = s;
  const bills = new Set(s.edges.map((e) => e.billId)).size;
  const fmt = (c: number) => formatMoney(c, currency);

  // "Erinnern": what the person still owes me, bill by bill – as a notification where it reaches them.
  const [reminders, setReminders] = useState<ReminderStatus | null>(null);
  useEffect(() => {
    api
      .reminders()
      .then(setReminders)
      .catch(() => setReminders({ reachable: [], remindedAt: {} }));
  }, []);
  const owedToMe = s.edges.filter((e) => e.debtorId === person.id && e.creditorId === me);
  const owedTotal = owedToMe.reduce((sum, e) => sum + e.amount, 0);
  const remindedAt = reminders?.remindedAt[person.id];
  const reminderText =
    owedToMe.length === 1
      ? t("Hi {name}, kleine Erinnerung von klicksplit: Für „{title}“ sind bei Dir noch {amount} offen. Hier kannst Du direkt begleichen: {url}", {
          name: person.name,
          title: owedToMe[0].title,
          amount: fmt(owedTotal),
          url: withRecipient(billUrl(owedToMe[0].billId, window.location.href, undefined, DEMO), person.id),
        })
      : t("Hi {name}, kleine Erinnerung von klicksplit: Bei Dir sind noch {amount} aus {n} Rechnungen offen. Im Dashboard kannst Du alles auf einmal ausgleichen: {url}", {
          name: person.name,
          amount: fmt(owedTotal),
          n: owedToMe.length,
          url: `${window.location.href.replace(/#.*$/, "")}#/dashboard`,
        });

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
            ? t("Die Beträge haben sich gerade geändert. Bitte prüfe die neue Aufstellung – noch wurde nichts eingetragen.")
            : t("Mit {name} ist inzwischen alles ausgeglichen – noch wurde nichts eingetragen.", { name: person.name }),
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
      setNotice(t("{error} Es wurde nichts eingetragen.", { error: e instanceof Error ? e.message : t("Das Eintragen ist fehlgeschlagen.") }));
      setStage("review");
    }
  }

  const reference = (
    myName
      ? bills === 1
        ? t("klicksplit · Ausgleich von {name} ({n} Rechnung)", { name: myName, n: bills })
        : t("klicksplit · Ausgleich von {name} ({n} Rechnungen)", { name: myName, n: bills })
      : bills === 1
        ? t("klicksplit · Ausgleich ({n} Rechnung)", { n: bills })
        : t("klicksplit · Ausgleich ({n} Rechnungen)", { n: bills })
  ).slice(0, 140);

  return (
    <div className="sheet-backdrop settle-backdrop" onClick={(e) => e.target === e.currentTarget && stage !== "booking" && onClose(stage === "done")}>
      <div className="sheet settle-sheet" role="dialog" aria-label={t("Mit {name} ausgleichen", { name: person.name })}>
        <h2>{s.edges.length || stage !== "review" ? t("Mit {name} ausgleichen", { name: person.name }) : t("Du und {name}", { name: person.name })}</h2>

        {stage === "done" && booked ? (
          <>
            {booked.net < 0 ? (
              <>
                <p className="settle-done">{t("✓ Eingetragen – wartet auf die Bestätigung von {name}.", { name: person.name })}</p>
                <p className="muted small">
                  {bills === 1
                    ? t("Bis dahin gelten Deine Anteile als bezahlt. Bestätigt {name} den Eingang, ist alles in der Rechnung beglichen.", { name: person.name })
                    : t("Bis dahin gelten Deine Anteile als bezahlt. Bestätigt {name} den Eingang, ist alles in allen {n} Rechnungen beglichen.", {
                        name: person.name,
                        n: bills,
                      })}
                </p>
              </>
            ) : booked.net > 0 ? (
              <>
                <p className="settle-done">
                  {bills === 1 ? t("✓ In der Rechnung als erhalten eingetragen.") : t("✓ In allen {n} Rechnungen als erhalten eingetragen.", { n: bills })}
                </p>
                <p className="muted small">{t("{name} sieht im Dashboard und in den Rechnungen, dass alles beglichen ist.", { name: person.name })}</p>
              </>
            ) : (
              <>
                <p className="settle-done">{t("✓ Verrechnung vorgeschlagen – wartet auf die Bestätigung von {name}.", { name: person.name })}</p>
                <p className="muted small">{t("Bis dahin gelten die Beträge als verrechnet.")}</p>
              </>
            )}
            <button type="button" className="btn btn-primary btn-large" onClick={() => onClose(true)}>
              {t("Fertig")}
            </button>
          </>
        ) : (
          <>
            {/* Bill by bill, so every euro can be traced to its bill. */}
            {s.edges.length > 0 && (
              <ul className="settle-entries">
                {s.edges.map((e) => (
                  <BillEntry
                    key={`${e.billId}:${e.debtorId}:${e.creditorId}`}
                    title={e.title}
                    text={e.debtorId === me ? t("Du schuldest {name}", { name: person.name }) : t("{name} schuldet Dir", { name: person.name })}
                    amount={`${e.debtorId === me ? "−" : "+"}${fmt(e.amount)}`}
                    onOpen={onOpenBill && (() => onOpenBill(e.billId, e.debtorId))}
                  />
                ))}
              </ul>
            )}
            {s.edges.length > 0 && (
              <p className="settle-total">
                {net < 0 ? (
                  rich(t("Du zahlst {name} <b>{amount}</b>", { name: person.name, amount: fmt(-net) }))
                ) : net > 0 ? (
                  rich(t("{name} zahlt Dir <b>{amount}</b>", { name: person.name, amount: fmt(net) }))
                ) : (
                  t("Gleicht sich genau aus")
                )}
              </p>
            )}

            {s.edges.length === 0 && !notice && <p className="settle-done">{t("✓ Mit {name} ist alles ausgeglichen.", { name: person.name })}</p>}

            {notice && <p className="alert">{notice}</p>}

            {/* I pay: recorded only after paying; then it waits for them to confirm it. */}
            {s.edges.length > 0 && net < 0 && (
              <PayButtons
                payment={s.payment ?? {}}
                amount={-net}
                currency={currency}
                recipient={person.name}
                reference={reference}
                confirmLabel={t("✓ Gesendet – {name} bestätigen lassen", { name: person.name })}
                onConfirm={book}
                busy={stage === "booking"}
              />
            )}

            {/* They pay me: remind them – and record it once the money is there. */}
            {net > 0 && owedToMe.length > 0 && stage === "review" && reminders && (
              <div className="settle-remind">
                <span>
                  {t("{name} hat noch nicht bezahlt?", { name: person.name })}
                  {remindedAt && <small className="muted">{t("per Mitteilung erinnert {ago}", { ago: remindedAgo(remindedAt) })}</small>}
                </span>
                <RemindButton
                  name={person.name}
                  reachable={reminders.reachable.includes(person.id)}
                  remindedAt={remindedAt}
                  whatsappText={reminderText}
                  onPush={async () => setReminders(await api.remindPerson(person.id))}
                />
              </div>
            )}
            {s.edges.length > 0 && net > 0 && stage === "review" && (
              <>
                <p className="muted small">{t("{name} sieht den Ausgleich im eigenen Dashboard. Sobald das Geld da ist, trag es hier ein.", { name: person.name })}</p>
                <button type="button" className="btn btn-primary btn-large" onClick={book}>
                  {t("✓ {amount} erhalten – eintragen", { amount: fmt(net) })}
                </button>
              </>
            )}
            {s.edges.length > 0 && net === 0 && stage === "review" && (
              <>
                <p className="muted small">
                  {t("Ihr schuldet Euch gegenseitig gleich viel. {name} bestätigt die Verrechnung im Dashboard.", { name: person.name })}
                </p>
                <button type="button" className="btn btn-primary btn-large" onClick={book}>
                  {t("Gegenseitig verrechnen")}
                </button>
              </>
            )}
            {stage === "booking" && net >= 0 && <p className="muted small">{t("Wird eingetragen …")}</p>}

            {/* The shared history: every bill with them, settled or not, newest first. */}
            {history.length > 0 && stage === "review" && (
              <>
                <h3 className="settle-history-title">{t("Gemeinsame Rechnungen")}</h3>
                <ul className="settle-entries">
                  {history.map((h) => (
                    <BillEntry
                      key={`${h.billId}:${h.participantId}`}
                      title={h.title}
                      text={`${formatDate(h.createdAt)} · ${
                        h.mine
                          ? t("Du hast bezahlt · Anteil {name} {amount}", { name: person.name, amount: formatMoney(h.share, h.currency) })
                          : t("{name} hat bezahlt · Dein Anteil {amount}", { name: person.name, amount: formatMoney(h.share, h.currency) })
                      }`}
                      amount={
                        h.open > 0 ? (
                          t("{amount} offen", { amount: formatMoney(h.open, h.currency) })
                        ) : (
                          <span className="history-settled">{t("✓ beglichen")}</span>
                        )
                      }
                      onOpen={onOpenBill && (() => onOpenBill(h.billId, h.participantId))}
                    />
                  ))}
                </ul>
              </>
            )}

            {stage !== "booking" && (
              <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>
                {t("Schließen")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
