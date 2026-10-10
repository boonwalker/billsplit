import { useState } from "react";
import { api } from "../lib/api";
import type { NetworkEdge, Transfer, TransferAllocation } from "../lib/bill";
import { formatMoney } from "../lib/money";
import { planSettlement, type PlannedTransfer, type SettlementPlan } from "../lib/simplify";
import PayButtons from "./PayButtons";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_MS = 14 * DAY_MS;
/** Confirmed payments of my own stay visible a little while (then they are just settled). */
const CONFIRMED_MS = 3 * DAY_MS;

/** One settled share in words, from my point of view. */
function describe(a: TransferAllocation, me: string, edges: Map<string, NetworkEdge>) {
  const e = edges.get(`${a.billId}:${a.debtorId}`);
  const title = e?.title ?? "Rechnung";
  const debtor = e?.debtorName ?? "";
  const creditor = e?.creditorName ?? "";
  if (a.debtorId === me) return { title, text: `Dein Anteil bei ${creditor}`, sign: "−" };
  if (a.creditorId === me) return { title, text: `Anteil von ${debtor} bei Dir (verrechnet)`, sign: "+" };
  return { title, text: `Anteil von ${debtor} bei ${creditor} – wird mit beglichen`, sign: "" };
}

/**
 * Settling everything with as few payments as possible: the plan (who gets how much, and which
 * shares in which bills that settles), then paying each one. A payment waits until its
 * recipient confirms it; until then the shares count as being paid.
 */
export function PlanCard({ plan, onPay }: { plan: SettlementPlan; onPay: (t: PlannedTransfer) => void }) {
  const fmt = (c: number) => formatMoney(c, plan.currency);
  const count = plan.transfers.length;
  if (!count && !plan.incoming.length) return null;

  return (
    <div className="card plan-card">
      {count > 0 ? (
        <>
          <h4>
            Alles ausgleichen mit {count === 1 ? "einer Zahlung" : `${count} Zahlungen`}
            {plan.directCount > count && <small> statt {plan.directCount}</small>}
          </h4>
          <ul className="plan-list">
            {plan.transfers.map((t) => (
              <li key={t.toId}>
                <span className="plan-text">
                  <b>An {t.toName}</b>
                  {t.onBehalfOf.length > 0 && (
                    <small className="muted">
                      begleicht auch {t.onBehalfOf.map((o) => `${fmt(o.amount)} von ${o.name}`).join(" und ")} bei {t.toName}
                    </small>
                  )}
                </span>
                <span className="plan-amount">{fmt(t.amount)}</span>
                <button type="button" className="btn btn-paypal plan-pay" onClick={() => onPay(t)}>
                  Zahlen
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <h4>Du musst niemandem etwas zahlen</h4>
      )}
      {plan.incoming.length > 0 && (
        <p className="muted small plan-incoming">
          Noch offen für Dich: {plan.incoming.map((i) => `${i.name} ${fmt(i.amount)}`).join(", ")} – das gleichen sie von ihrer Seite aus.
        </p>
      )}
    </div>
  );
}

/** Paying one payment of the plan; stays open after it was recorded (when the plan may be empty). */
export function PlanPaySheet({
  planned: shown,
  me,
  edges,
  myName,
  reload,
  onClose,
}: {
  planned: PlannedTransfer;
  me: string;
  edges: NetworkEdge[];
  myName: string;
  reload: () => Promise<{ me: string; edges: NetworkEdge[] }>;
  onClose: () => void;
}) {
  const [planned, setPlanned] = useState(shown);
  const [stage, setStage] = useState<"pay" | "booking" | "done">("pay");
  const [notice, setNotice] = useState<string | null>(null);
  const byShare = new Map(edges.map((e) => [`${e.billId}:${e.debtorId}`, e]));
  const fmt = (c: number) => formatMoney(c, planned.currency);
  const same = (a: PlannedTransfer, b: PlannedTransfer) =>
    a.amount === b.amount &&
    JSON.stringify([...a.allocations].sort((x, y) => `${x.billId}${x.debtorId}`.localeCompare(`${y.billId}${y.debtorId}`))) ===
      JSON.stringify([...b.allocations].sort((x, y) => `${x.billId}${x.debtorId}`.localeCompare(`${y.billId}${y.debtorId}`)));

  /** Records the payment – only if the plan is still exactly what was paid. */
  async function book() {
    setNotice(null);
    setStage("booking");
    try {
      const fresh = await reload();
      const again = planSettlement(fresh.me, fresh.edges)
        .find((p) => p.currency === planned.currency)
        ?.transfers.find((t) => t.toId === planned.toId);
      if (!again || !same(again, planned)) {
        if (again) setPlanned(again);
        setNotice("Die Beträge haben sich gerade geändert. Bitte prüfe die neue Aufstellung – noch wurde nichts eingetragen.");
        setStage("pay");
        return;
      }
      await api.createTransfer({ toId: planned.toId, amount: planned.amount, currency: planned.currency, allocations: planned.allocations });
      await reload();
      setStage("done");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Das Eintragen ist fehlgeschlagen.");
      setStage("pay");
    }
  }

  const reference = `billsplit · Ausgleich ${myName ? `von ${myName}` : ""}`.trim().slice(0, 140);

  return (
    <div className="sheet-backdrop settle-backdrop" onClick={(e) => e.target === e.currentTarget && stage !== "booking" && onClose()}>
      <div className="sheet settle-sheet" role="dialog" aria-label={`${fmt(planned.amount)} an ${planned.toName}`}>
        <h2>
          {fmt(planned.amount)} an {planned.toName}
        </h2>
        {stage === "done" ? (
          <>
            <p className="settle-done">✓ Eingetragen – wartet auf die Bestätigung von {planned.toName}.</p>
            <p className="muted small">
              Bis dahin gelten die Anteile als bezahlt. Bestätigt {planned.toName} den Eingang, sind sie in allen Rechnungen
              beglichen{planned.onBehalfOf.length > 0 && <> – auch für {planned.onBehalfOf.map((o) => o.name).join(" und ")}</>}.
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={onClose}>
              Fertig
            </button>
          </>
        ) : (
          <>
            <p className="muted small">Damit sind diese Anteile beglichen:</p>
            <ul className="settle-entries">
              {planned.allocations.map((a) => {
                const d = describe(a, me, byShare);
                return (
                  <li key={`${a.billId}:${a.debtorId}`}>
                    <span>
                      <b>{d.title}</b>
                      <small className="muted">{d.text}</small>
                    </span>
                    <span className="settle-amount">
                      {d.sign}
                      {fmt(a.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {planned.onBehalfOf.length > 0 && (
              <p className="muted small">
                Statt {planned.onBehalfOf.map((o) => o.name).join(" und ")} zahlst Du direkt an {planned.toName} – eine Zahlung weniger
                für alle.
              </p>
            )}
            {notice && <p className="alert">{notice}</p>}
            <PayButtons
              payment={planned.payment}
              amount={planned.amount}
              currency={planned.currency}
              recipient={planned.toName}
              reference={reference}
              confirmLabel={`✓ Gesendet – ${planned.toName} bestätigen lassen`}
              onConfirm={book}
              busy={stage === "booking"}
            />
            {stage !== "booking" && (
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Schließen
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Settlement payments that concern me: received ones to confirm, my own that wait (can be
 * taken back), and ones that settled my share on my behalf or through me.
 */
export function TransferInbox({ me, transfers, onDecided }: { me: string; transfers: Transfer[]; onDecided: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const recent = (t: Transfer) => now - Date.parse(t.decidedAt ?? t.createdAt) < RECENT_MS;
  const incoming = transfers.filter((t) => t.toId === me && t.status === "pending");
  const outgoing = transfers.filter(
    (t) =>
      t.fromId === me &&
      (t.status === "pending" || (t.status === "rejected" && recent(t)) || (t.status === "confirmed" && now - Date.parse(t.decidedAt ?? t.createdAt) < CONFIRMED_MS)),
  );
  const involved = transfers.filter((t) => t.fromId !== me && t.toId !== me && t.status !== "cancelled" && t.status !== "rejected" && recent(t));
  if (!incoming.length && !outgoing.length && !involved.length) return null;
  const fmt = (t: Transfer, c: number) => formatMoney(c, t.currency);

  async function decide(t: Transfer, action: "confirm" | "reject" | "cancel") {
    setBusy(t.id);
    setError(null);
    try {
      await api.decideTransfer(t.id, action);
      onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(null);
    }
  }

  const lines = (t: Transfer) =>
    t.allocations.map((a) => (
      <li key={`${a.billId}:${a.debtorId}`}>
        <span>
          <b>{a.billTitle}</b>
          <small className="muted">
            {a.debtorId === me ? "Dein Anteil" : `Anteil von ${a.debtorName}`} bei {a.creditorId === me ? "Dir" : a.creditorName}
          </small>
        </span>
        <span className="settle-amount">{fmt(t, a.amount)}</span>
      </li>
    ));

  return (
    <section className="transfer-inbox">
      {error && <p className="alert">{error}</p>}
      {incoming.map((t) =>
        t.amount === 0 ? (
          // An offset: what we owe each other cancels out exactly.
          <div key={t.id} className="card inbox-card incoming">
            <h4>{t.fromName} möchte gegenseitig verrechnen</h4>
            <p className="muted small">Eure offenen Beträge gleichen sich genau aus – ohne dass jemand etwas zahlt:</p>
            <ul className="settle-entries">{lines(t)}</ul>
            <div className="inbox-actions">
              <button type="button" className="btn btn-primary" disabled={busy === t.id} onClick={() => decide(t, "confirm")}>
                ✓ Einverstanden
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy === t.id} onClick={() => decide(t, "reject")}>
                Ablehnen
              </button>
            </div>
          </div>
        ) : (
          <div key={t.id} className="card inbox-card incoming">
            <h4>
              {t.fromName} hat Dir {fmt(t, t.amount)} gesendet
            </h4>
            <p className="muted small">Bestätige den Eingang, wenn das Geld da ist – dann wird es in diesen Rechnungen eingetragen:</p>
            <ul className="settle-entries">{lines(t)}</ul>
            <div className="inbox-actions">
              <button type="button" className="btn btn-primary" disabled={busy === t.id} onClick={() => decide(t, "confirm")}>
                ✓ Erhalten
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy === t.id} onClick={() => decide(t, "reject")}>
                Nicht erhalten
              </button>
            </div>
          </div>
        ),
      )}
      {outgoing.map((t) => (
        <div key={t.id} className={`card inbox-card ${t.status}`}>
          {t.status === "pending" ? (
            <>
              <h4>{t.amount === 0 ? `Verrechnung mit ${t.toName} · wartet auf Bestätigung` : `${fmt(t, t.amount)} an ${t.toName} · wartet auf Bestätigung`}</h4>
              <button type="button" className="link" disabled={busy === t.id} onClick={() => decide(t, "cancel")}>
                {t.amount === 0 ? "Verrechnung zurückziehen" : "Doch nicht gezahlt – zurückziehen"}
              </button>
            </>
          ) : t.status === "confirmed" ? (
            <h4>
              ✓{" "}
              {t.amount === 0
                ? `${t.toName} hat die Verrechnung bestätigt – alles ausgeglichen.`
                : t.recordedByRecipient
                  ? `${t.toName} hat ${fmt(t, t.amount)} von Dir als erhalten eingetragen – alles ausgeglichen.`
                  : `${t.toName} hat ${fmt(t, t.amount)} erhalten – alles ausgeglichen.`}
            </h4>
          ) : (
            <h4>
              {t.amount === 0
                ? `${t.toName} hat die Verrechnung abgelehnt – die Beträge sind wieder offen.`
                : `${t.toName} hat ${fmt(t, t.amount)} als nicht erhalten markiert – die Anteile sind wieder offen.`}
            </h4>
          )}
        </div>
      ))}
      {involved.map((t) => {
        const mine = t.allocations.filter((a) => a.debtorId === me || a.creditorId === me);
        const settledMine = mine.filter((a) => a.debtorId === me).reduce((s, a) => s + a.amount, 0);
        return (
          <div key={t.id} className="card inbox-card involved">
            <h4>
              {t.fromName} hat {fmt(t, t.amount)} an {t.toName} gezahlt
              {t.status === "pending" ? " (noch nicht bestätigt)" : " ✓"}
            </h4>
            <p className="muted small">
              {settledMine > 0
                ? `Damit ist Dein Anteil von ${fmt(t, settledMine)} bei ${t.toName} beglichen – und ${t.fromName} schuldet Dir dafür nichts mehr.`
                : "Darin sind Anteile verrechnet, die Dich betreffen:"}
            </p>
            <ul className="settle-entries">{lines({ ...t, allocations: mine })}</ul>
          </div>
        );
      })}
    </section>
  );
}
