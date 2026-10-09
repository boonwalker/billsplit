import {
  billTotal,
  equalShare,
  participantShare,
  feesTotal,
  hasTip,
  sharedPerPerson,
  sharedTotal,
  splitHeadCount,
  unassignedAmount,
  type BillData,
  type BillSnapshot,
  type Debtor,
} from "../lib/bill";
import { formatMoney } from "../lib/money";

interface Props {
  snapshot: BillSnapshot;
  onToggleReceived: (debtor: Debtor, received: boolean) => void;
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
        <b>Gleichverteilung</b>
        <small>{on ? "Alle zahlen gleich viel – Abhaken ist aus." : "Alle zahlen gleich viel, z. B. beim Supermarkt-Einkauf."}</small>
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
  const joined = participants.length;
  const count = splitHeadCount(data, participants);
  const missing = count - joined;
  const setCount = (n: number) => onUpdateData({ ...data, tipSplitCount: n <= joined ? undefined : n });
  const equal = Boolean(data.equalSplit);

  return (
    <div className="tip-split-panel">
      <div className="row between">
        <span>
          <b>
            {equal ? "Rechnung" : feesTotal(data) !== 0 ? (hasTip(data) ? "Gebühren & Trinkgeld" : "Gebühren") : "Trinkgeld"}{" "}
            {formatMoney(equal ? billTotal(data) : sharedTotal(data), data.currency)}
          </b>{" "}
          aufteilen auf
        </span>
        <div className="stepper-mini" role="group" aria-label="Personen für Trinkgeld und Gebühren">
          <button type="button" onClick={() => setCount(count - 1)} disabled={count <= joined} aria-label="Eine Person weniger">
            −
          </button>
          <span>{count}</span>
          <button type="button" onClick={() => setCount(count + 1)} disabled={count >= 100} aria-label="Eine Person mehr">
            +
          </button>
        </div>
      </div>
      <p className="muted small">
        {formatMoney(equal ? equalShare(data, participants) : sharedPerPerson(data, participants), data.currency)} pro Person ·{" "}
        {missing > 0
          ? `${joined} beigetreten (inkl. Dir), ${missing} ${missing === 1 ? "kommt" : "kommen"} noch dazu`
          : `gezählt: alle, die beigetreten sind, plus du`}
      </p>
    </div>
  );
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function ownerSummary(snapshot: BillSnapshot) {
  const total = billTotal(snapshot.data);
  const own = snapshot.me ? participantShare(snapshot.data, snapshot.participants, snapshot.me).total : 0;
  const debtors = snapshot.debtors ?? [];
  const received = debtors.filter((d) => d.received).reduce((s, d) => s + (d.payAmount ?? d.amount), 0);
  return { total, own, received, missing: Math.max(0, total - own - received), unassigned: unassignedAmount(snapshot.data, snapshot.participants) };
}

/** What only the payer sees below the bill: who scanned, who tapped pay, what is still missing. */
export default function OwnerPanel({ snapshot, onToggleReceived }: Props) {
  const currency = snapshot.data.currency;
  const debtors = snapshot.debtors ?? [];
  const { total, own, received, missing, unassigned } = ownerSummary(snapshot);

  return (
    <section className="owner-panel" aria-labelledby="owner-title">
      <div className="panel-head">
        <h3 id="owner-title">Deine Freunde</h3>
        <span className="pill">{debtors.length} beigetreten</span>
      </div>

      {debtors.length === 0 ? (
        <p className="muted empty">
          Noch ist niemand deiner Abrechnung beigetreten. Sobald jemand beitritt, taucht er hier mit seinem Namen auf.
        </p>
      ) : (
        <ul className="debtors">
          {debtors.map((d) => {
            const changed = d.payAmount !== undefined && d.payAmount !== d.amount;
            return (
              <li key={d.id} className={`debtor${d.received ? " received" : ""}${d.payClickedAt ? " announced" : ""}`}>
                <span className="avatar" aria-hidden="true">
                  {d.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="debtor-main">
                  <span className="debtor-name">{d.name}</span>
                  <span className="debtor-status">
                    {d.received
                      ? "Zahlungseingang bestätigt"
                      : d.markedPaidAt
                        ? `hat um ${time(d.markedPaidAt)} als bezahlt markiert`
                        : d.payClickedAt
                        ? `hat um ${time(d.payClickedAt)} auf Bezahlen getippt`
                        : snapshot.data.equalSplit
                          ? "ist beigetreten"
                          : "ist beigetreten · wählt noch aus …"}
                    {changed && <> · Auswahl jetzt {formatMoney(d.amount, currency)}</>}
                  </span>
                </span>
                {d.payAmount !== undefined && <span className="debtor-amount">{formatMoney(d.payAmount, currency)}</span>}
                {d.payClickedAt && (
                  <label className="received-toggle" title="Geld ist auf PayPal angekommen">
                    <input type="checkbox" checked={d.received} onChange={(e) => onToggleReceived(d, e.target.checked)} />
                    <span>erhalten</span>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <dl className="owner-sums">
        <dt>Rechnung gesamt</dt>
        <dd>{formatMoney(total, currency)}</dd>
        <dt>Dein eigener Anteil</dt>
        <dd>− {formatMoney(own, currency)}</dd>
        <dt>Schon erhalten</dt>
        <dd>− {formatMoney(received, currency)}</dd>
        <dt className="strong">Dir fehlen noch</dt>
        <dd className="strong">{formatMoney(missing, currency)}</dd>
      </dl>
      {unassigned > 0 && snapshot.data.equalSplit && (
        <p className="hint">
          {formatMoney(unassigned, currency)} entfallen auf Personen, die noch nicht beigetreten sind.
        </p>
      )}
      {unassigned > 0 && !snapshot.data.equalSplit && (
        <p className="hint">
          {formatMoney(unassigned, currency)} sind noch keiner Person zugeordnet – hast du deine eigenen Positionen schon
          abgehakt?
          {splitHeadCount(snapshot.data, snapshot.participants) > snapshot.participants.length &&
            " Darin enthalten sind auch Anteile an Trinkgeld und Gebühren von Personen, die noch nicht beigetreten sind."}
        </p>
      )}
      {debtors.length > 0 && (
        <p className="hint muted">
          Gleiche die Beträge mit den Eingängen in deiner PayPal-App ab und hake „erhalten“ an, sobald das Geld da ist.
        </p>
      )}
    </section>
  );
}
