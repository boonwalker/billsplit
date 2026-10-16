import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { NetworkEdge, Transfer, TransferAllocation } from "../lib/bill";
import { t } from "../lib/i18n";
import { formatMoney } from "../lib/money";
import { loadSeenTransfers, markTransfersSeen } from "../lib/storage";
import { planSettlement, type PlannedTransfer, type SettlementPlan } from "../lib/simplify";
import PayButtons from "./PayButtons";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_MS = 14 * DAY_MS;
/** Confirmed payments of my own stay visible a little while (then they are just settled). */
const CONFIRMED_MS = 3 * DAY_MS;

/** One share in a list: bill, who owes whom, the amount – and a tap opens that bill at its place. */
export function BillEntry({ title, text, amount, onOpen }: { title: string; text: string; amount: ReactNode; onOpen?: () => void }) {
  const content = (
    <>
      <span>
        <b>{title}</b>
        <small className="muted">{text}</small>
      </span>
      <span className="settle-amount">{amount}</span>
    </>
  );
  return (
    <li>
      {onOpen ? (
        <button type="button" className="settle-entry" onClick={onOpen} aria-label={t("{title}: {text} – Rechnung öffnen", { title, text })}>
          {content}
          <span className="settle-entry-go" aria-hidden="true">
            ›
          </span>
        </button>
      ) : (
        content
      )}
    </li>
  );
}

/** One settled share in words, from my point of view. */
function describe(a: TransferAllocation, me: string, edges: Map<string, NetworkEdge>) {
  const e = edges.get(`${a.billId}:${a.debtorId}:${a.creditorId}`);
  const title = e?.title ?? t("Rechnung");
  const debtor = e?.debtorName ?? "";
  const creditor = e?.creditorName ?? "";
  if (a.debtorId === me) return { title, text: t("Dein Anteil bei {name}", { name: creditor }), sign: "−" };
  if (a.creditorId === me) return { title, text: t("Anteil von {name} bei Dir (verrechnet)", { name: debtor }), sign: "+" };
  return { title, text: t("Anteil von {debtor} bei {creditor} – wird mit beglichen", { debtor, creditor }), sign: "" };
}

/**
 * Settling everything with as few payments as possible: the plan (who gets how much, and which
 * shares in which bills that settles), then paying each one. A payment waits until its
 * recipient confirms it; until then the shares count as being paid.
 */
export function PlanCard({ plan, onPay }: { plan: SettlementPlan; onPay: (tr: PlannedTransfer) => void }) {
  const fmt = (c: number) => formatMoney(c, plan.currency);
  const count = plan.transfers.length;
  if (!count && !plan.incoming.length) return null;

  return (
    <div className="card plan-card">
      {count > 0 ? (
        <>
          <h4>
            {count === 1 ? t("Alles ausgleichen mit einer Zahlung") : t("Alles ausgleichen mit {n} Zahlungen", { n: count })}
            {plan.directCount > count && <small> {t("statt {n}", { n: plan.directCount })}</small>}
          </h4>
          <ul className="plan-list">
            {plan.transfers.map((tr) => (
              <li key={tr.toId}>
                <span className="plan-text">
                  <b>{t("An {name}", { name: tr.toName })}</b>
                  {/* The detour it saves, as arrows: one payment instead of passing the money on. */}
                  {tr.via.map((names) => (
                    <small key={names.join("→")} className="plan-route">
                      <s>
                        {t("Du")} → {names.join(" → ")} → {tr.toName}
                      </s>{" "}
                      <b>
                        {t("Du")} → {tr.toName}
                      </b>
                    </small>
                  ))}
                  {tr.onBehalfOf.length > 0 && (
                    <small className="muted">
                      {t("begleicht auch {list} bei {name}", {
                        list: tr.onBehalfOf.map((o) => t("{amount} von {name}", { amount: fmt(o.amount), name: o.name })).join(t(" und ")),
                        name: tr.toName,
                      })}
                    </small>
                  )}
                </span>
                <span className="plan-amount">{fmt(tr.amount)}</span>
                <button type="button" className="btn btn-paypal plan-pay" onClick={() => onPay(tr)}>
                  {t("Zahlen")}
                </button>
              </li>
            ))}
          </ul>
          {plan.transfers.some((tr) => tr.via.length > 0) && (
            <p className="muted small plan-explain">
              {t(
                "Statt Geld über mehrere Ecken weiterzureichen, zahlst Du direkt an die Person, die es am Ende bekommt. Jeder Anteil in jeder Rechnung gilt dann als beglichen.",
              )}
            </p>
          )}
        </>
      ) : (
        <h4>{t("Du musst niemandem etwas zahlen")}</h4>
      )}
      {plan.incoming.length > 0 && (
        <p className="muted small plan-incoming">
          {t("Noch offen für Dich: {list} – das gleichen sie von ihrer Seite aus.", {
            list: plan.incoming.map((i) => `${i.name} ${fmt(i.amount)}`).join(", "),
          })}
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
  onOpenBill,
}: {
  planned: PlannedTransfer;
  me: string;
  edges: NetworkEdge[];
  myName: string;
  reload: () => Promise<{ me: string; edges: NetworkEdge[] }>;
  onClose: () => void;
  /** Opens a bill at the place of a participant's share. */
  onOpenBill?: (billId: string, participantId: string) => void;
}) {
  const [planned, setPlanned] = useState(shown);
  const [stage, setStage] = useState<"pay" | "booking" | "done">("pay");
  const [notice, setNotice] = useState<string | null>(null);
  const byShare = new Map(edges.map((e) => [`${e.billId}:${e.debtorId}:${e.creditorId}`, e]));
  const fmt = (c: number) => formatMoney(c, planned.currency);
  const same = (a: PlannedTransfer, b: PlannedTransfer) =>
    a.amount === b.amount &&
    JSON.stringify([...a.allocations].sort((x, y) => `${x.billId}${x.debtorId}${x.creditorId}`.localeCompare(`${y.billId}${y.debtorId}${y.creditorId}`))) ===
      JSON.stringify([...b.allocations].sort((x, y) => `${x.billId}${x.debtorId}${x.creditorId}`.localeCompare(`${y.billId}${y.debtorId}${y.creditorId}`)));

  /** Records the payment – only if the plan is still exactly what was paid. */
  async function book() {
    setNotice(null);
    setStage("booking");
    try {
      const fresh = await reload();
      const again = planSettlement(fresh.me, fresh.edges)
        .find((p) => p.currency === planned.currency)
        ?.transfers.find((tr) => tr.toId === planned.toId);
      if (!again || !same(again, planned)) {
        if (again) setPlanned(again);
        setNotice(t("Die Beträge haben sich gerade geändert. Bitte prüfe die neue Aufstellung – noch wurde nichts eingetragen."));
        setStage("pay");
        return;
      }
      await api.createTransfer({ toId: planned.toId, amount: planned.amount, currency: planned.currency, allocations: planned.allocations });
      await reload();
      setStage("done");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("Das Eintragen ist fehlgeschlagen."));
      setStage("pay");
    }
  }

  const reference = (myName ? t("klicksplit · Ausgleich von {name}", { name: myName }) : t("klicksplit · Ausgleich")).slice(0, 140);

  return (
    <div className="sheet-backdrop settle-backdrop" onClick={(e) => e.target === e.currentTarget && stage !== "booking" && onClose()}>
      <div className="sheet settle-sheet" role="dialog" aria-label={t("{amount} an {name}", { amount: fmt(planned.amount), name: planned.toName })}>
        <h2>{t("{amount} an {name}", { amount: fmt(planned.amount), name: planned.toName })}</h2>
        {stage === "done" ? (
          <>
            <p className="settle-done">{t("✓ Eingetragen – wartet auf die Bestätigung von {name}.", { name: planned.toName })}</p>
            <p className="muted small">
              {planned.onBehalfOf.length > 0
                ? t("Bis dahin gelten die Anteile als bezahlt. Bestätigt {name} den Eingang, sind sie in allen Rechnungen beglichen – auch für {names}.", {
                    name: planned.toName,
                    names: planned.onBehalfOf.map((o) => o.name).join(t(" und ")),
                  })
                : t("Bis dahin gelten die Anteile als bezahlt. Bestätigt {name} den Eingang, sind sie in allen Rechnungen beglichen.", {
                    name: planned.toName,
                  })}
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={onClose}>
              {t("Fertig")}
            </button>
          </>
        ) : (
          <>
            <p className="muted small">{t("Damit sind diese Anteile beglichen:")}</p>
            <ul className="settle-entries">
              {planned.allocations.map((a) => {
                const d = describe(a, me, byShare);
                return (
                  <BillEntry
                    key={`${a.billId}:${a.debtorId}:${a.creditorId}`}
                    title={d.title}
                    text={d.text}
                    amount={
                      <>
                        {d.sign}
                        {fmt(a.amount)}
                      </>
                    }
                    onOpen={onOpenBill && (() => onOpenBill(a.billId, a.debtorId))}
                  />
                );
              })}
            </ul>
            {planned.onBehalfOf.length > 0 && (
              <p className="muted small">
                {t("Statt {names} zahlst Du direkt an {name} – eine Zahlung weniger für alle.", {
                  names: planned.onBehalfOf.map((o) => o.name).join(t(" und ")),
                  name: planned.toName,
                })}
              </p>
            )}
            {notice && <p className="alert">{notice}</p>}
            <PayButtons
              payment={planned.payment}
              amount={planned.amount}
              currency={planned.currency}
              recipient={planned.toName}
              reference={reference}
              confirmLabel={t("✓ Gesendet – {name} bestätigen lassen", { name: planned.toName })}
              onConfirm={book}
              busy={stage === "booking"}
            />
            {stage !== "booking" && (
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {t("Schließen")}
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
export function TransferInbox({
  me,
  transfers,
  onDecided,
  onOpenBill,
  focus,
}: {
  me: string;
  transfers: Transfer[];
  onDecided: () => void;
  /** Opens a bill at the place of a participant's share. */
  onOpenBill?: (billId: string, participantId: string) => void;
  /** A payment to bring into view (opened from a notification). */
  focus?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const recent = (tr: Transfer) => now - Date.parse(tr.decidedAt ?? tr.createdAt) < RECENT_MS;
  // An outcome ("… hat erhalten – alles ausgeglichen") is news only once: shown on the first visit
  // after it, then gone (still there when a notification leads to it). Waiting ones always show.
  const [seen] = useState(() => new Set(loadSeenTransfers()));
  const news = (tr: Transfer) => tr.status === "pending" || !seen.has(tr.id) || focus === tr.id;
  const incoming = transfers.filter((tr) => tr.toId === me && tr.status === "pending");
  const outgoing = transfers.filter(
    (tr) =>
      tr.fromId === me &&
      news(tr) &&
      (tr.status === "pending" || (tr.status === "rejected" && recent(tr)) || (tr.status === "confirmed" && now - Date.parse(tr.decidedAt ?? tr.createdAt) < CONFIRMED_MS)),
  );
  const involved = transfers.filter((tr) => tr.fromId !== me && tr.toId !== me && tr.status !== "cancelled" && tr.status !== "rejected" && recent(tr) && news(tr));
  const shownOutcomes = [...outgoing, ...involved].filter((tr) => tr.status !== "pending").map((tr) => tr.id);
  const shownKey = shownOutcomes.join(",");
  useEffect(() => {
    if (shownKey) markTransfersSeen(shownKey.split(","));
  }, [shownKey]);
  if (!incoming.length && !outgoing.length && !involved.length) return null;
  const fmt = (tr: Transfer, c: number) => formatMoney(c, tr.currency);

  async function decide(tr: Transfer, action: "confirm" | "reject" | "cancel") {
    setBusy(tr.id);
    setError(null);
    try {
      await api.decideTransfer(tr.id, action);
      onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Das hat nicht geklappt."));
    } finally {
      setBusy(null);
    }
  }

  const lines = (tr: Transfer) =>
    tr.allocations.map((a) => (
      <BillEntry
        key={`${a.billId}:${a.debtorId}:${a.creditorId}`}
        title={a.billTitle}
        text={
          a.debtorId === me
            ? a.creditorId === me
              ? t("Dein Anteil bei Dir")
              : t("Dein Anteil bei {name}", { name: a.creditorName })
            : a.creditorId === me
              ? t("Anteil von {name} bei Dir", { name: a.debtorName })
              : t("Anteil von {debtor} bei {creditor}", { debtor: a.debtorName, creditor: a.creditorName })
        }
        amount={fmt(tr, a.amount)}
        onOpen={onOpenBill && (() => onOpenBill(a.billId, a.debtorId))}
      />
    ));

  return (
    <section className="transfer-inbox">
      {error && <p className="alert">{error}</p>}
      {incoming.map((tr) =>
        tr.amount === 0 ? (
          // An offset: what we owe each other cancels out exactly.
          <div key={tr.id} data-transfer={tr.id} className={`card inbox-card incoming${focus === tr.id ? " focus-flash" : ""}`}>
            <h4>{t("{name} möchte gegenseitig verrechnen", { name: tr.fromName })}</h4>
            <p className="muted small">{t("Eure offenen Beträge gleichen sich genau aus – ohne dass jemand etwas zahlt:")}</p>
            <ul className="settle-entries">{lines(tr)}</ul>
            <div className="inbox-actions">
              <button type="button" className="btn btn-primary" disabled={busy === tr.id} onClick={() => decide(tr, "confirm")}>
                {t("✓ Einverstanden")}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy === tr.id} onClick={() => decide(tr, "reject")}>
                {t("Ablehnen")}
              </button>
            </div>
          </div>
        ) : (
          <div key={tr.id} data-transfer={tr.id} className={`card inbox-card incoming${focus === tr.id ? " focus-flash" : ""}`}>
            <h4>{t("{name} hat Dir {amount} gesendet", { name: tr.fromName, amount: fmt(tr, tr.amount) })}</h4>
            <p className="muted small">{t("Bestätige den Eingang, wenn das Geld da ist – dann wird es in diesen Rechnungen eingetragen:")}</p>
            <ul className="settle-entries">{lines(tr)}</ul>
            <div className="inbox-actions">
              <button type="button" className="btn btn-primary" disabled={busy === tr.id} onClick={() => decide(tr, "confirm")}>
                {t("✓ Erhalten")}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy === tr.id} onClick={() => decide(tr, "reject")}>
                {t("Nicht erhalten")}
              </button>
            </div>
          </div>
        ),
      )}
      {outgoing.map((tr) => (
        <div key={tr.id} data-transfer={tr.id} className={`card inbox-card ${tr.status}${focus === tr.id ? " focus-flash" : ""}`}>
          {tr.status === "pending" ? (
            <>
              <h4>
                {tr.amount === 0
                  ? t("Verrechnung mit {name} · wartet auf Bestätigung", { name: tr.toName })
                  : t("{amount} an {name} · wartet auf Bestätigung", { amount: fmt(tr, tr.amount), name: tr.toName })}
              </h4>
              <button type="button" className="link" disabled={busy === tr.id} onClick={() => decide(tr, "cancel")}>
                {tr.amount === 0 ? t("Verrechnung zurückziehen") : t("Doch nicht gezahlt – zurückziehen")}
              </button>
            </>
          ) : tr.status === "confirmed" ? (
            <h4>
              ✓{" "}
              {tr.amount === 0
                ? t("{name} hat die Verrechnung bestätigt – alles ausgeglichen.", { name: tr.toName })
                : tr.recordedByRecipient
                  ? t("{name} hat {amount} von Dir als erhalten eingetragen – alles ausgeglichen.", { name: tr.toName, amount: fmt(tr, tr.amount) })
                  : t("{name} hat {amount} erhalten – alles ausgeglichen.", { name: tr.toName, amount: fmt(tr, tr.amount) })}
            </h4>
          ) : (
            <h4>
              {tr.amount === 0
                ? t("{name} hat die Verrechnung abgelehnt – die Beträge sind wieder offen.", { name: tr.toName })
                : t("{name} hat {amount} als nicht erhalten markiert – die Anteile sind wieder offen.", { name: tr.toName, amount: fmt(tr, tr.amount) })}
            </h4>
          )}
        </div>
      ))}
      {involved.map((tr) => {
        const mine = tr.allocations.filter((a) => a.debtorId === me || a.creditorId === me);
        const settledMine = mine.filter((a) => a.debtorId === me).reduce((s, a) => s + a.amount, 0);
        return (
          <div key={tr.id} data-transfer={tr.id} className={`card inbox-card involved${focus === tr.id ? " focus-flash" : ""}`}>
            <h4>
              {tr.status === "pending"
                ? t("{from} hat {amount} an {to} gezahlt (noch nicht bestätigt)", { from: tr.fromName, amount: fmt(tr, tr.amount), to: tr.toName })
                : t("{from} hat {amount} an {to} gezahlt ✓", { from: tr.fromName, amount: fmt(tr, tr.amount), to: tr.toName })}
            </h4>
            <p className="muted small">
              {settledMine > 0
                ? t("Damit ist Dein Anteil von {amount} bei {to} beglichen – und {from} schuldet Dir dafür nichts mehr.", {
                    amount: fmt(tr, settledMine),
                    to: tr.toName,
                    from: tr.fromName,
                  })
                : t("Darin sind Anteile verrechnet, die Dich betreffen:")}
            </p>
            <ul className="settle-entries">{lines({ ...tr, allocations: mine })}</ul>
          </div>
        );
      })}
    </section>
  );
}
