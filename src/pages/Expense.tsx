import { useState, type FormEvent } from "react";
import BusyScreen from "../components/BusyScreen";
import DivideBy from "../components/DivideBy";
import Header from "../components/Header";
import ProfileWizard from "../components/ProfileWizard";
import { PencilFilter } from "../components/Receipt";
import { api } from "../lib/api";
import { newItemId, type BillData } from "../lib/bill";
import { t } from "../lib/i18n";
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

/**
 * "Ausgabe eingeben": a single expense without a receipt (a taxi, concert tickets, …) – amount,
 * what for, when, and by how many it is split. It becomes a bill with an equal split, shared
 * like any other.
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

  const cents = parseMoney(amount);
  const valid = cents !== null && cents > 0 && title.trim() !== "";
  const each = cents ? Math.ceil(cents / persons) : 0;

  async function create() {
    if (cents === null) return;
    setBusy(true);
    setError(null);
    const name = title.trim();
    const data: BillData = {
      title: name,
      date,
      currency: "EUR",
      tipPercent: 0,
      equalSplit: true,
      tipSplitCount: persons,
      items: [{ id: newItemId(), name, qty: 1, total: cents }],
      payment: paymentFromProfile(loadProfile()),
    };
    try {
      const snap = await api.createBill(data, loadProfile().name.trim() || t("Ich"));
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
