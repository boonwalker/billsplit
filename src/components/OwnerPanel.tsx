import {
  billTotal,
  participantShare,
  tipHeadCount,
  tipPerPerson,
  tipTotal,
  unassignedAmount,
  type BillData,
  type BillSnapshot,
  type Debtor,
} from "../lib/bill";
import { formatMoney } from "../lib/money";

interface Props {
  snapshot: BillSnapshot;
  onToggleReceived: (debtor: Debtor, received: boolean) => void;
  onUpdateData: (data: BillData) => void;
}

/**
 * How many people share the tip. Defaults to everyone who joined; the payer can
 * raise it when someone will only scan later (e.g. the next day).
 */
function TipSplit({ snapshot, onUpdateData }: { snapshot: BillSnapshot; onUpdateData: (data: BillData) => void }) {
  const { data, participants } = snapshot;
  const joined = participants.length;
  const count = tipHeadCount(data, participants);
  const missing = count - joined;
  const setCount = (n: number) => onUpdateData({ ...data, tipSplitCount: n <= joined ? undefined : n });

  return (
    <div className="tip-split-panel">
      <div className="row between">
        <span>
          <b>Trinkgeld {formatMoney(tipTotal(data), data.currency)}</b> aufteilen auf
        </span>
        <div className="stepper-mini" role="group" aria-label="Personen für das Trinkgeld">
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
        {formatMoney(tipPerPerson(data, participants), data.currency)} pro Person ·{" "}
        {missing > 0
          ? `${joined} beigetreten (inkl. dir), ${missing} ${missing === 1 ? "kommt" : "kommen"} noch dazu`
          : `gezählt: alle, die gescannt haben, plus du`}
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
export default function OwnerPanel({ snapshot, onToggleReceived, onUpdateData }: Props) {
  const currency = snapshot.data.currency;
  const debtors = snapshot.debtors ?? [];
  const { total, own, received, missing, unassigned } = ownerSummary(snapshot);

  return (
    <section className="owner-panel" aria-labelledby="owner-title">
      <div className="panel-head">
        <h3 id="owner-title">Deine Freunde</h3>
        <span className="pill">{debtors.length} gescannt</span>
      </div>

      {debtors.length === 0 ? (
        <p className="muted empty">
          Noch hat niemand den QR-Code gescannt. Sobald jemand scannt, taucht er hier mit seinem Namen auf.
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
                      : d.payClickedAt
                        ? `hat um ${time(d.payClickedAt)} auf Bezahlen getippt`
                        : "hat gescannt · wählt noch aus …"}
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

      {tipTotal(snapshot.data) > 0 && <TipSplit snapshot={snapshot} onUpdateData={onUpdateData} />}

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
      {unassigned > 0 && (
        <p className="hint">
          {formatMoney(unassigned, currency)} sind noch keiner Person zugeordnet – hast du deine eigenen Positionen schon
          abgehakt?
          {tipHeadCount(snapshot.data, snapshot.participants) > snapshot.participants.length &&
            " Darin enthalten sind auch Trinkgeld-Anteile von Personen, die noch nicht gescannt haben."}
        </p>
      )}
      <p className="hint muted">
        Gleiche die Beträge mit den Eingängen in deiner PayPal-App ab und hake „erhalten“ an, sobald das Geld da ist.
      </p>
    </section>
  );
}
