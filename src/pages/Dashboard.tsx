import { useCallback, useEffect, useState } from "react";
import Header from "../components/Header";
import SettleSheet from "../components/SettleSheet";
import { api } from "../lib/api";
import { computeBalances, type Balances, type PersonBalance } from "../lib/balances";
import type { BillSnapshot } from "../lib/bill";
import { formatMoney } from "../lib/money";
import { loadOwnProfile, loadRecent } from "../lib/storage";

/** Signed amount: "+12,30 €" / "−4,00 €". */
function signed(cents: number, currency: string): string {
  if (cents === 0) return formatMoney(0, currency);
  return `${cents > 0 ? "+" : "−"}${formatMoney(Math.abs(cents), currency)}`;
}

type Slice = "lent" | "owed";

const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between the two slices (in px along the ring). */
const GAP = 3;

const LABEL: Record<Slice, string> = { lent: "Du leihst", owed: "Du schuldest" };

/**
 * The two slices of a ring (lent green, owed orange) in a 200×200 view box, each shortened by
 * a gap that shows the card behind; a slice with nothing in it is left out. Without anything
 * open only the grey track is drawn.
 */
function RingSlices({
  lent,
  owed,
  currency,
  active = null,
  onActive,
}: {
  lent: number;
  owed: number;
  currency: string;
  active?: Slice | null;
  onActive?: (slice: Slice | null) => void;
}) {
  const total = lent + owed;
  if (total === 0) return <circle className="ring-track" cx="100" cy="100" r={RADIUS} />;
  const slices: { key: Slice; value: number; offset: number }[] = [];
  if (lent > 0) slices.push({ key: "lent", value: lent, offset: 0 });
  if (owed > 0) slices.push({ key: "owed", value: owed, offset: (lent / total) * CIRCUMFERENCE });
  const gap = slices.length > 1 ? GAP : 0;
  return (
    <>
      {slices.map((s) => {
        const length = Math.max(0, (s.value / total) * CIRCUMFERENCE - gap);
        return (
          <circle
            key={s.key}
            className={`ring-slice ${s.key}${active === s.key ? " active" : ""}${active && active !== s.key ? " dim" : ""}`}
            cx="100"
            cy="100"
            r={RADIUS}
            strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
            strokeDashoffset={-(s.offset + gap / 2)}
            onPointerEnter={onActive && ((e) => e.pointerType === "mouse" && onActive(s.key))}
            onPointerLeave={onActive && ((e) => e.pointerType === "mouse" && onActive(null))}
            onClick={onActive && (() => onActive(active === s.key ? null : s.key))}
          >
            <title>{`${LABEL[s.key]}: ${formatMoney(s.value, currency)} (${Math.round((s.value / total) * 100)} %)`}</title>
          </circle>
        );
      })}
    </>
  );
}

/**
 * Ring chart of what is lent vs. owed over all bills; the net balance sits in the middle.
 * Tapping (or hovering) a slice shows that slice's amount in the middle instead.
 */
function BalanceRing({ balances }: { balances: Balances }) {
  const [active, setActive] = useState<Slice | null>(null);
  const { lent, owed, currency } = balances;
  const total = lent + owed;
  const net = lent - owed;
  const share = (part: number) => (total ? Math.round((part / total) * 100) : 0);

  return (
    <figure className="balance-ring">
      <div className="balance-ring-chart">
        <svg viewBox="0 0 200 200" role="img" aria-label={`Du leihst ${formatMoney(lent, currency)}, Du schuldest ${formatMoney(owed, currency)}`}>
          <RingSlices lent={lent} owed={owed} currency={currency} active={active} onActive={setActive} />
        </svg>
        <div className="balance-ring-centre" aria-live="polite">
          {active ? (
            <>
              <small>{LABEL[active]}</small>
              <b>{formatMoney(active === "lent" ? lent : owed, currency)}</b>
              <small>{share(active === "lent" ? lent : owed)} % von allem Offenen</small>
            </>
          ) : total === 0 ? (
            <>
              <b className="settled">✓</b>
              <small>Alles ausgeglichen</small>
            </>
          ) : (
            <>
              <small>Bilanz</small>
              <b>{signed(net, currency)}</b>
              <small>{net > 0 ? "Du bekommst mehr zurück" : net < 0 ? "Du schuldest mehr" : "Hält sich die Waage"}</small>
            </>
          )}
        </div>
      </div>

      <figcaption className="balance-legend">
        {(["lent", "owed"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`balance-legend-row${active === key ? " active" : ""}`}
            onClick={() => setActive((a) => (a === key ? null : key))}
          >
            <i className={`swatch ${key}`} aria-hidden="true" />
            <span>{LABEL[key]}</span>
            <b>{formatMoney(key === "lent" ? lent : owed, currency)}</b>
          </button>
        ))}
        {balances.unassigned > 0 && (
          <p className="muted small balance-note">
            Davon {formatMoney(balances.unassigned, balances.currency)} noch von niemandem abgehakt.
          </p>
        )}
      </figcaption>
    </figure>
  );
}

/** One person as a small ring: what they owe me (green) and what I owe them (orange). */
function PersonRing({ person, currency, onOpen }: { person: PersonBalance; currency: string; onOpen: () => void }) {
  const net = person.lent - person.owed;
  const open = person.entries.length > 0;
  return (
    <li className={`person-ring${open ? " open" : ""}`}>
      {/* Tapping a person with open amounts opens the settlement (pay or confirm, bill by bill). */}
      {open && <button type="button" className="person-ring-hit" aria-label={`Mit ${person.name} ausgleichen`} onClick={onOpen} />}
      <div className="person-ring-chart">
        <svg viewBox="0 0 200 200" role="img" aria-label={`${person.name}: Dir geschuldet ${formatMoney(person.lent, currency)}, Du schuldest ${formatMoney(person.owed, currency)}`}>
          <RingSlices lent={person.lent} owed={person.owed} currency={currency} />
        </svg>
        <span className="person-ring-initial" aria-hidden="true">
          {person.name.slice(0, 1).toUpperCase()}
        </span>
      </div>
      <b className="person-ring-name">{person.name}</b>
      {net === 0 ? (
        <span className="list-paid small">✓ ausgeglichen</span>
      ) : (
        <>
          <span className="person-ring-amount">
            <i className={`swatch ${net > 0 ? "lent" : "owed"}`} aria-hidden="true" />
            {formatMoney(Math.abs(net), currency)}
          </span>
          <small className="muted">{net > 0 ? "schuldet Dir" : "schuldest Du"}</small>
        </>
      )}
      {person.lent > 0 && person.owed > 0 && (
        <small className="muted person-ring-both">
          +{formatMoney(person.lent, currency)} / −{formatMoney(person.owed, currency)}
        </small>
      )}
      <small className="muted person-ring-bills">
        {person.bills} {person.bills === 1 ? "Rechnung" : "Rechnungen"}
      </small>
      {open && <span className="person-ring-action">{net < 0 ? "Ausgleich zahlen ›" : net > 0 ? "Ausgleich ansehen ›" : "Verrechnen ›"}</span>}
    </li>
  );
}

/** Overview over all bills on this device: lent vs. owed, and the balance with every person. */
export default function Dashboard() {
  const [balances, setBalances] = useState<Balances[] | null>(null);
  const [settle, setSettle] = useState<{ person: PersonBalance; currency: string } | null>(null);

  /** Loads all bills on this device again (those that cannot be loaded, e.g. offline, are left out). */
  const load = useCallback(async () => {
    const snaps = await Promise.all(loadRecent().map((b) => api.getBill(b.id).catch(() => null)));
    const next = computeBalances(snaps.filter((s): s is BillSnapshot => s !== null));
    setBalances(next);
    return next;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page dashboard">
      <Header back="/" title="Dashboard" />
      <main className="content">
        {balances === null ? (
          <div className="scanning creating" role="status">
            <div className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <p className="scan-msg">Deine Rechnungen werden zusammengerechnet</p>
          </div>
        ) : balances.length === 0 ? (
          <p className="muted empty">Noch keine Rechnungen – sobald Du eine erstellst oder scannst, erscheint hier Deine Bilanz.</p>
        ) : (
          balances.map((b) => (
            <section key={b.currency} className="dashboard-section">
              <h3 className="section-title">{balances.length > 1 ? `Bilanz in ${b.currency}` : "Leihen oder schulden?"}</h3>
              <div className="card">
                <BalanceRing balances={b} />
              </div>
              {b.people.length > 0 && (
                <>
                  <h3 className="section-title">Mit wem Du wie stehst</h3>
                  <ul className="person-rings">
                    {b.people.map((p) => (
                      <PersonRing key={p.name} person={p} currency={b.currency} onOpen={() => setSettle({ person: p, currency: b.currency })} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))
        )}
      </main>
      {settle && (
        <SettleSheet
          person={settle.person}
          currency={settle.currency}
          myName={loadOwnProfile().name.trim()}
          reload={async () => {
            const key = settle.person.name.toLocaleLowerCase("de-DE");
            const fresh = (await load()).find((b) => b.currency === settle.currency)?.people.find((p) => p.name.toLocaleLowerCase("de-DE") === key);
            return fresh && fresh.entries.length > 0 ? fresh : null;
          }}
          onClose={(changed) => {
            setSettle(null);
            if (changed) void load();
          }}
        />
      )}
    </div>
  );
}
