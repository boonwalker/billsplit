import { useEffect, useState } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { computeBalances, type Balances, type PersonBalance } from "../lib/balances";
import type { BillSnapshot } from "../lib/bill";
import { formatMoney } from "../lib/money";
import { loadRecent } from "../lib/storage";

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
  // Both slices, each shortened by the gap; a slice with nothing in it is left out.
  const slices: { key: Slice; value: number; offset: number }[] = [];
  if (lent > 0) slices.push({ key: "lent", value: lent, offset: 0 });
  if (owed > 0) slices.push({ key: "owed", value: owed, offset: (lent / total) * CIRCUMFERENCE });
  const gap = slices.length > 1 ? GAP : 0;
  const label: Record<Slice, string> = { lent: "Du leihst", owed: "Du schuldest" };

  return (
    <figure className="balance-ring">
      <div className="balance-ring-chart">
        <svg viewBox="0 0 200 200" role="img" aria-label={`Du leihst ${formatMoney(lent, currency)}, Du schuldest ${formatMoney(owed, currency)}`}>
          {/* Only when nothing is open; otherwise the gaps between the slices show the card. */}
          {total === 0 && <circle className="ring-track" cx="100" cy="100" r={RADIUS} />}
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
                onPointerEnter={(e) => e.pointerType === "mouse" && setActive(s.key)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
                onClick={() => setActive((a) => (a === s.key ? null : s.key))}
              >
                <title>{`${label[s.key]}: ${formatMoney(s.value, currency)} (${share(s.value)} %)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="balance-ring-centre" aria-live="polite">
          {active ? (
            <>
              <small>{label[active]}</small>
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
            <span>{label[key]}</span>
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

function PersonRow({ person, currency }: { person: PersonBalance; currency: string }) {
  const net = person.lent - person.owed;
  return (
    <li className="person-balance">
      <span className="avatar" aria-hidden="true">
        {person.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="person-balance-text">
        <b>{person.name}</b>
        <small className="muted">
          {person.bills} {person.bills === 1 ? "Rechnung" : "Rechnungen"}
          {person.lent > 0 && person.owed > 0 && (
            <>
              {" "}
              · Dir geschuldet {formatMoney(person.lent, currency)} · Du schuldest {formatMoney(person.owed, currency)}
            </>
          )}
        </small>
      </span>
      <span className="person-balance-amount">
        {net === 0 ? (
          <span className="list-paid">✓ ausgeglichen</span>
        ) : (
          <>
            <b>
              <i className={`swatch ${net > 0 ? "lent" : "owed"}`} aria-hidden="true" />
              {formatMoney(Math.abs(net), currency)}
            </b>
            <small className="muted">{net > 0 ? "schuldet Dir" : "schuldest Du"}</small>
          </>
        )}
      </span>
    </li>
  );
}

/** Overview over all bills on this device: lent vs. owed, and the balance with every person. */
export default function Dashboard() {
  const [balances, setBalances] = useState<Balances[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Bills that cannot be loaded (offline, deleted) are left out.
    Promise.all(loadRecent().map((b) => api.getBill(b.id).catch(() => null))).then((snaps) => {
      if (!cancelled) setBalances(computeBalances(snaps.filter((s): s is BillSnapshot => s !== null)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
                  <ul className="card person-balances">
                    {b.people.map((p) => (
                      <PersonRow key={p.name} person={p} currency={b.currency} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
