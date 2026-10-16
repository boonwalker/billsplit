import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import InstallHint from "../components/InstallHint";
import ProfileWizard from "../components/ProfileWizard";
import { ownerStatus } from "../components/OwnerPanel";
import { guestStatus, stillOpen } from "../lib/balances";
import { billUrl } from "../lib/bill";
import { isIosBrowser } from "../lib/handoff";
import { formatDate, rich, t } from "../lib/i18n";
import { formatMoney } from "../lib/money";
import { ASK_PROFILE_AFTER_MS, takeStartPageQuestion } from "../lib/onboarding";
import { api } from "../lib/api";
import { DEMO, getPersona, setPersona } from "../lib/demo";
import { navigate } from "../lib/router";
import { createSampleBill } from "../lib/sampleBill";
import { accountsAvailable, refreshAccount } from "../lib/account";
import { reportError } from "../lib/errorReport";
import { useBillChanges } from "../lib/liveEvents";
import { clearDraft, hasPaymentMethod, hideBill, markGone, loadAccountEmail, loadAccountLost, loadOwnProfile, loadRecent, syncRecentBills, updateRecent, type RecentBill } from "../lib/storage";
import { setPendingPhoto } from "./Editor";

/** Bills shown before "Ältere anzeigen". */
const LIST_PAGE = 20;

export default function Home() {
  const [recent, setRecent] = useState<RecentBill[]>(loadRecent);
  /**
   * Right after a friend paid for the first time (see lib/onboarding): a moment on the start
   * page, then the profile assistant – and in Safari afterwards the way onto the home screen.
   */
  const [onboarding, setOnboarding] = useState<{ step: "profile" | "install"; billId: string } | null>(null);
  useEffect(() => {
    const billId = takeStartPageQuestion();
    if (!billId) return;
    const timer = window.setTimeout(() => setOnboarding({ step: "profile", billId }), ASK_PROFILE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);
  /** The list has no limit: the newest LIST_PAGE first, the older ones on request. */
  const [showAll, setShowAll] = useState(false);
  /** The bill whose ✕ was tapped: asked once more before it leaves the list. */
  const [removing, setRemoving] = useState<RecentBill | null>(null);
  // The home screen always belongs to the device owner, also in the demo.
  useEffect(() => {
    if (DEMO && getPersona() !== "me") setPersona("me");
  }, []);
  // Bills the server no longer knows (expired, deleted, broken link) leave the list;
  // for the others the paid status is brought up to date. Bills I take part in but never
  // opened on this device (an expense a friend assigned to me) are added first.
  const refresh = useCallback(async () => {
    await api
      .myBills()
      .then(syncRecentBills)
      .catch(() => {}); // offline, older server: keep the list as it is
    const list = loadRecent();
    const [snaps, transfers] = await Promise.all([api.getBills(list.map((b) => b.id)), api.transfers().catch(() => null)]);
    // Settlement payments to me that wait for my confirmation keep their bills in the list, too.
    const toConfirm = new Set(
      (transfers?.transfers ?? []).filter((tr) => tr.toId === transfers?.me && tr.status === "pending").flatMap((tr) => tr.allocations.map((a) => a.billId)),
    );
    let gone = 0;
    for (const b of list) {
      const snap = snaps[b.id];
      if (snap === null) {
        if (markGone(b.id)) gone++;
      } else if (!snap) continue;
      else {
        const status = {
          ...(snap.isOwner ? ownerStatus(snap) : snap.me ? guestStatus(snap) : {}),
          open: stillOpen(snap) || toConfirm.has(b.id),
          // Known again (e.g. the server's data came back).
          gone: undefined,
        };
        if (Object.entries(status).some(([k, v]) => (b as unknown as Record<string, unknown>)[k] !== v)) updateRecent(b.id, status);
      }
    }
    // Bills vanishing from the server is never normal: it shows on the admin page.
    if (gone > 0) reportError(new Error("Rechnungen auf dem Server nicht gefunden"), `${gone} von ${list.length} in der Liste`);
  }, []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    refresh()
      .then(() => mounted.current && setRecent(loadRecent()))
      .catch(() => {}); // offline etc.: keep the list as it is
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  // Live: a bill changed – also one that is new for me (assigned while the app is open).
  const onBillChanged = useCallback(() => {
    refresh()
      .then(() => mounted.current && setRecent(loadRecent()))
      .catch(() => {});
  }, [refresh]);
  useBillChanges(onBillChanged);
  // Settlement payments sent to me that wait for my confirmation (shown on the dashboard button).
  const [toConfirm, setToConfirm] = useState(0);
  useEffect(() => {
    api
      .transfers()
      .then((list) => setToConfirm(list.transfers.filter((tr) => tr.toId === list.me && tr.status === "pending").length))
      .catch(() => {});
  }, []);
  // Is this device still signed in? If the server lost the account, the start page says so.
  const [lostAccount, setLostAccount] = useState(loadAccountLost);
  useEffect(() => {
    if (!accountsAvailable || !loadAccountEmail()) return;
    void refreshAccount().then(() => setLostAccount(loadAccountLost()));
  }, []);
  const profile = loadOwnProfile();
  const account = loadAccountEmail();
  const ready = Boolean(profile.name.trim() && hasPaymentMethod(profile));

  function onPhoto(file: File | undefined) {
    if (!file) return;
    clearDraft();
    setPendingPhoto(file);
    navigate("/new");
  }

  return (
    <div className="page home">
      <Header
        action={
          <button className="avatar-btn" aria-label={account ? t("Profil – angemeldet als {account}", { account }) : t("Profil")} onClick={() => navigate("/profile")}>
            {profile.name.trim() ? profile.name.trim().slice(0, 1).toUpperCase() : "?"}
            {/* Signed in with the e-mail account: a small tick on the avatar. */}
            {account && (
              <span className="avatar-badge" aria-hidden="true">
                <svg viewBox="0 0 12 12">
                  <path d="M3 6.2l2 2 4-4.2" />
                </svg>
              </span>
            )}
          </button>
        }
      />
      <main className="content">
        <section className="hero">
          <p className="eyebrow">{profile.name ? t("Hi {name}!", { name: profile.name }) : t("Willkommen bei klicksplit")}</p>
          <h2>
            {t("Einer zahlt.")}
            <br />
            <span className="hl">{t("Alle splitten.")}</span>
          </h2>
          <p className="muted">
            {t("Rechnung fotografieren, QR-Code zeigen – Deine Freunde haken ab, was sie hatten, und zahlen Dir ihren Anteil direkt per PayPal.")}
          </p>
        </section>

        {DEMO && (
          <p className="demo-banner">
            {rich(
              t(
                "<b>Demo-Version.</b> Alles bleibt in diesem Browser. Auf der Rechnung kannst Du oben zwischen Dir und Deinen Freunden Anna und Ben umschalten und so beide Seiten ausprobieren.",
              ),
            )}
          </p>
        )}

        <section className="actions">
          {/* Always straight to the camera: a first-time payer is asked for name and payment while the receipt is read. */}
          <label className="action-card primary">
            <span className="action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 10.5 3.5h3a1.5 1.5 0 0 1 1.2.7L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
                <circle cx="12" cy="12.5" r="3.5" />
              </svg>
            </span>
            <span className="action-text">
              <b>{t("Rechnung fotografieren")}</b>
              <small>{t("Du hast bezahlt und willst anteilig Geld zurück")}</small>
            </span>
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>

          {/* Digital receipts (app, e-mail, delivery service): pick a screenshot instead of taking a photo. */}
          <label className="action-card secondary">
            <span className="action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                <path d="M9.5 7.5h5M9.5 10.5h5M9.5 13.5h3" />
                <path d="M10.5 18.5h3" />
              </svg>
            </span>
            <span className="action-text">
              <b>{t("Screenshot hochladen")}</b>
              <small>{t("Für digitale Rechnungen aus App oder Mail")}</small>
            </span>
            <input type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>

          {DEMO ? (
            <button className="action-card" onClick={() => (ready ? navigate(`/b/${createSampleBill()}`) : navigate("/profile?next=sample"))}>
              <span className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 3.5h10v16l-1.7-1.3-1.6 1.3-1.7-1.3-1.7 1.3-1.6-1.3L7 19.5z" />
                  <path d="M9.5 8h5M9.5 11h5M9.5 14h3" />
                </svg>
              </span>
              <span className="action-text">
                <b>{t("Beispielrechnung ansehen")}</b>
                <small>{t("Mit Anna und Ben – schon teilweise abgehakt")}</small>
              </span>
            </button>
          ) : (
          <button className="action-card" onClick={() => navigate("/scan")}>
            <span className="action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15M4 12h16" />
              </svg>
            </span>
            <span className="action-text">
              <b>{t("QR-Code scannen")}</b>
              <small>{t("Ein Freund hat bezahlt – Du übernimmst Deinen Anteil")}</small>
            </span>
          </button>
          )}

          {/* A single expense without a receipt (taxi, tickets, …), right below the ways to start a bill. */}
          <button type="button" className="action-card" onClick={() => navigate("/ausgabe")}>
            <span className="action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="2.5" y="6" width="13" height="9" rx="2" />
                <circle cx="9" cy="10.5" r="2" />
                <path d="M15.5 17.5h6M18.5 14.5l3 3-3 3" />
              </svg>
            </span>
            <span className="action-text">
              <b>{t("Ausgabe zuweisen")}</b>
              <small>{t("Ohne Beleg – z.B. Taxi oder Kiosk, auch direkt an Freunde")}</small>
            </span>
          </button>
        </section>

        {/* A new device (or a wiped browser): the bills come back with the e-mail account. */}
        {lostAccount && !account && (
          <div className="card account-lost" role="status">
            <p>{t("Du wurdest abgemeldet: Der Server kannte Dein Konto {email} nicht mehr. Melde Dich bitte noch einmal an.", { email: lostAccount })}</p>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/anmelden")}>
              {t("Wieder anmelden")}
            </button>
          </div>
        )}

        {recent.length === 0 && accountsAvailable && !loadAccountEmail() && (
          <button type="button" className="btn btn-ghost signin-link" onClick={() => navigate("/anmelden")}>
            {rich(t("Schon ein Konto? <b>Anmelden</b>"))}
          </button>
        )}

        {/* Over all bills: lent vs. owed, and the balance with every person – always there (also before the first bill on
          this device), above the list, so many bills never push it out of sight. */}
        <button type="button" className="btn btn-secondary dashboard-btn" onClick={() => navigate("/dashboard")}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <g transform="rotate(-90 12 12)">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray="29 50.3" />
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray="17.3 50.3" strokeDashoffset="-31" opacity="0.4" />
            </g>
          </svg>
          {t("Dashboard · Deine Bilanz")}
          {toConfirm > 0 && <span className="badge">{toConfirm === 1 ? t("1 Eingang bestätigen") : t("{n} Eingänge bestätigen", { n: toConfirm })}</span>}
        </button>

        {recent.length > 0 && (
          <section>
            <h3 className="section-title">{t("Deine Rechnungen")}</h3>
            <ul className="list">
              {(showAll ? recent : recent.slice(0, LIST_PAGE)).map((b) => (
                <li key={b.id} className={`list-item${b.gone ? " gone" : ""}`}>
                  <button className="list-main" onClick={() => navigate(`/b/${b.id}`)}>
                    <span className="list-title">{b.title || t("Rechnung")}</span>
                    <span className="muted small">
                      {formatDate(b.createdAt)} · {b.gone ? (
                        t("nicht mehr verfügbar")
                      ) : b.role === "owner" ? (
                        <>
                          {t("Du leihst")}
                          {b.settled ? (
                            <>
                              {" "}
                              · <span className="list-paid">{t("✓ ausgeglichen")}</span>
                            </>
                          ) : (
                            b.missing !== undefined && b.missing > 0 && <> · {formatMoney(b.missing, b.currency ?? "EUR")}</>
                          )}
                        </>
                      ) : b.settled ? (
                        <span className="list-paid">{t("✓ beglichen")}</span>
                      ) : b.markedPaid ? (
                        <span className="list-paid">{t("✓ als bezahlt markiert")}</span>
                      ) : (
                        <>
                          {t("Du schuldest")}
                          {b.owed !== undefined && b.owed > 0 && <> · {formatMoney(b.owed, b.currency ?? "EUR")}</>}
                        </>
                      )}
                    </span>
                  </button>
                  <button
                    className="icon-btn subtle"
                    aria-label={t("Aus Liste entfernen")}
                    onClick={() => {
                      // Gone anyway: nothing to ask.
                      if (b.gone) {
                        hideBill(b.id);
                        setRecent(loadRecent());
                      } else setRemoving(b);
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {!showAll && recent.length > LIST_PAGE && (
              <button type="button" className="btn btn-ghost list-more" onClick={() => setShowAll(true)}>
                {t("Ältere anzeigen ({n})", { n: recent.length - LIST_PAGE })}
              </button>
            )}
          </section>
        )}

        <section className="how">
          <h3 className="section-title">{t("So funktioniert's")}</h3>
          <ol className="steps">
            <li>
              <span>1</span>
              <div>
                {rich(t("<b>Foto oder Screenshot.</b> Alle Positionen inkl. Mengen werden automatisch erkannt."))}
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                {rich(t("<b>QR-Code zeigen.</b> Freunde scannen ihn mit klicksplit und erscheinen sofort bei Dir."))}
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                {rich(t("<b>Abhaken & zahlen.</b> Jeder sieht live, wer was hat, und zahlt mit einem Klick."))}
              </div>
            </li>
          </ol>
        </section>
      </main>

      {onboarding?.step === "profile" && (
        <ProfileWizard
          role="guest"
          onDone={(saved) => {
            // Signing in to an existing account may have brought more bills.
            setRecent(loadRecent());
            setOnboarding(saved && isIosBrowser() ? { step: "install", billId: onboarding.billId } : null);
          }}
        />
      )}
      {onboarding?.step === "install" && <InstallHint url={billUrl(onboarding.billId, window.location.href)} onClose={() => setOnboarding(null)} />}

      {/* Money still open or a payment to confirm: the bill stays in the list until then. */}
      {removing?.open && (
        <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setRemoving(null)}>
          <div className="sheet confirm-sheet" role="alertdialog" aria-labelledby="keep-title" aria-describedby="keep-text">
            <h2 id="keep-title">{t("Diese Rechnung ist noch offen")}</h2>
            <p id="keep-text" className="muted">
              {t("Solange in „{title}“ noch Geld offen ist oder Du einen Zahlungseingang bestätigen musst, bleibt sie in Deiner Liste.", {
                title: removing.title || t("Rechnung"),
              })}
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={() => navigate(`/b/${removing.id}`)}>
              {t("Rechnung öffnen")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setRemoving(null)}>
              {t("OK")}
            </button>
          </div>
        </div>
      )}

      {removing && !removing.open && (
        <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setRemoving(null)}>
          <div className="sheet confirm-sheet" role="alertdialog" aria-labelledby="remove-title" aria-describedby="remove-text">
            <h2 id="remove-title">{t("Bist Du sicher, dass Du diese Rechnung löschen möchtest?")}</h2>
            <p id="remove-text" className="muted">
              {t("„{title}“ verschwindet aus Deiner Liste. Für die anderen Teilnehmer bleibt sie erhalten.", { title: removing.title || t("Rechnung") })}
            </p>
            <button
              type="button"
              className="btn btn-danger btn-large"
              onClick={() => {
                hideBill(removing.id);
                setRecent(loadRecent());
                setRemoving(null);
              }}
            >
              {t("Löschen")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setRemoving(null)}>
              {t("Abbrechen")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
