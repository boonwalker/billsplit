import { useEffect, useState, type FormEvent } from "react";
import BusyScreen from "../components/BusyScreen";
import DivideBy from "../components/DivideBy";
import Header from "../components/Header";
import ProfileWizard from "../components/ProfileWizard";
import { PencilFilter } from "../components/Receipt";
import { api } from "../lib/api";
import { newItemId, type BillData, type Contact } from "../lib/bill";
import { rich, t } from "../lib/i18n";
import { formatMoney, parseMoney } from "../lib/money";
import { paymentFromProfile } from "../lib/payment";
import { navigate } from "../lib/router";
import { loadProfile, profileReady, rememberBill } from "../lib/storage";

/** Quick picks for "Wofür?" – a tap fills in the description. */
const picks = () => [t("Taxi"), t("Tanken"), t("Tickets"), t("Einkauf"), t("Essen"), t("Geschenk")];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** People shown as circles to assign the expense to directly. */
const MAX_PEOPLE = 8;

/**
 * "Ausgabe eingeben": a single expense without a receipt (a taxi, concert tickets, …) – amount,
 * what for, when, and by how many it is split. It becomes a bill with an equal split, shared
 * like any other. Or it goes straight to people from earlier bills: "5 € Taxi → Andy", or
 * shared with Andy ("Du bist auch dabei") – they get it as their share right away.
 */
export default function Expense() {
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [persons, setPersons] = useState(2);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needProfile, setNeedProfile] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [meToo, setMeToo] = useState(false);
  useEffect(() => {
    api
      .contacts()
      .then((list) => setContacts(list.slice(0, MAX_PEOPLE)))
      .catch(() => setContacts([]));
  }, []);
  const toggle = (id: string) => setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const direct = chosen.length > 0;
  const names = contacts.filter((c) => chosen.includes(c.id)).map((c) => c.name);

  const cents = parseMoney(amount);
  const valid = cents !== null && cents > 0 && title.trim() !== "";
  const heads = direct ? chosen.length + (meToo ? 1 : 0) : persons;
  const each = cents ? Math.ceil(cents / heads) : 0;

  async function create() {
    if (cents === null) return;
    setBusy(true);
    setError(null);
    const name = title.trim();
    const itemId = newItemId();
    const data: BillData = {
      title: name,
      date,
      currency: "EUR",
      tipPercent: 0,
      // Always an equal split, also straight to people: they share the expense (with me, if I
      // was there too – otherwise I am not part of the split). Their claims below only matter
      // when the payer switches the equal split off later.
      equalSplit: true,
      ...(direct ? (meToo ? {} : { ownerExcluded: true }) : { tipSplitCount: persons }),
      items: [{ id: itemId, name, qty: 1, total: cents }],
      payment: paymentFromProfile(loadProfile()),
    };
    try {
      let snap = await api.createBill(data, loadProfile().name.trim() || t("Ich"));
      if (direct) {
        const people = [...chosen, ...(meToo && snap.me ? [snap.me] : [])].map((id) => ({ id, claims: { [itemId]: [0] } }));
        snap = await api.assign(snap.id, people);
      }
      rememberBill({ id: snap.id, title: name, role: "owner", createdAt: snap.createdAt });
      navigate(`/b/${snap.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Die Rechnung konnte nicht erstellt werden."));
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    // The first bill on this device: name and how to get paid first.
    if (!profileReady()) setNeedProfile(true);
    else void create();
  }

  if (busy) return <BusyScreen message={t("klicksplit generiert die interaktive Rechnung")} creating />;

  return (
    <div className="page expense-page">
      <Header back="/" title={t("Ausgabe eingeben")} />
      <main className="content">
        <PencilFilter />
        <form className="expense-form" onSubmit={submit} noValidate>
          <label className="expense-amount">
            <span>{t("Betrag")}</span>
            <span className="expense-amount-row">
              <input
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))}
                inputMode="decimal"
                placeholder="0,00"
                aria-invalid={touched && (cents === null || cents <= 0)}
                aria-label={t("Betrag in Euro")}
              />
              <b aria-hidden="true">€</b>
            </span>
          </label>

          <div className="card expense-card">
            <label className="field">
              <span>{t("Wofür?")}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("z. B. Taxi zum Konzert")} maxLength={60} aria-invalid={touched && !title.trim()} />
            </label>
            <div className="expense-picks" role="group" aria-label={t("Schnellauswahl")}>
              {picks().map((pick) => (
                <button key={pick} type="button" className={`chip${title === pick ? " active" : ""}`} onClick={() => setTitle(pick)}>
                  {pick}
                </button>
              ))}
            </div>
            <label className="field">
              <span>{t("Wann?")}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
            </label>
          </div>

          {/* People from earlier bills: tap to give them the expense directly. */}
          {contacts.length > 0 && (
            <div className="card expense-people-card">
              <p className="shop-persons">
                {t("Direkt zuordnen")}
                <span className="shop-persons-hint">{t("an Leute aus Deinen Rechnungen")}</span>
              </p>
              <div className="expense-people" role="group" aria-label={t("Direkt zuordnen")}>
                {contacts.map((c) => (
                  <button key={c.id} type="button" className={`person-pick${chosen.includes(c.id) ? " on" : ""}`} aria-pressed={chosen.includes(c.id)} onClick={() => toggle(c.id)}>
                    <span className="person-pick-avatar" aria-hidden="true">
                      {c.name.trim().slice(0, 1).toUpperCase() || "?"}
                    </span>
                    <span className="person-pick-name">{c.name}</span>
                  </button>
                ))}
              </div>
              {direct && (
                <>
                  <button type="button" className={`chip expense-me${meToo ? " active" : ""}`} aria-pressed={meToo} onClick={() => setMeToo((v) => !v)}>
                    {meToo ? "✓ " : "+ "}
                    {t("Du bist auch dabei")}
                  </button>
                  <p className="expense-each">
                    {cents
                      ? heads === 1
                        ? rich(t("<b>{name}</b> zahlt {amount}", { name: names[0], amount: formatMoney(each, "EUR") }))
                        : rich(t("<b>{amount}</b> pro Person · {count} Personen", { amount: formatMoney(each, "EUR"), count: heads }))
                      : t("Betrag eingeben – dann siehst Du den Anteil pro Person.")}
                  </p>
                </>
              )}
            </div>
          )}

          {!direct && (
          <div className="card expense-split">
            <p className="shop-persons">
              {t("Wie viele teilen sich das?")}
              <span className="shop-persons-hint">{t("inklusive Dir")}</span>
            </p>
            <DivideBy value={persons} onChange={(n) => setPersons(n ?? 2)} label={t("Personen, die sich die Ausgabe teilen")} className="shop-divide" />
            <p className="expense-each">
              {cents ? (
                <>
                  <b>{formatMoney(each, "EUR")}</b> {t("pro Person")}
                </>
              ) : (
                t("Betrag eingeben – dann siehst Du den Anteil pro Person.")
              )}
            </p>
          </div>
          )}

          {touched && !valid && <p className="alert">{cents === null || cents <= 0 ? t("Bitte gib einen Betrag ein.") : t("Wofür war die Ausgabe?")}</p>}
          {error && <p className="alert">{error}</p>}

          <button className="btn btn-primary btn-large">{t("Rechnung erstellen")}</button>
        </form>
      </main>

      {needProfile && (
        <ProfileWizard
          role="payer"
          hint={t("Kurz noch zu Dir, dann ist Deine Rechnung fertig.")}
          onDone={() => {
            setNeedProfile(false);
            if (profileReady()) void create();
          }}
        />
      )}
    </div>
  );
}
