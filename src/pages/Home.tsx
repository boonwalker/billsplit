import { useEffect, useState } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { ApiError } from "../lib/apiError";
import { DEMO, getPersona, setPersona } from "../lib/demo";
import { navigate } from "../lib/router";
import { createSampleBill } from "../lib/sampleBill";
import { clearDraft, forgetBill, loadOwnProfile, loadRecent, updateRecent, type RecentBill } from "../lib/storage";
import { setPendingPhoto } from "./Editor";

export default function Home() {
  const [recent, setRecent] = useState<RecentBill[]>(loadRecent);
  // The home screen always belongs to the device owner, also in the demo.
  useEffect(() => {
    if (DEMO && getPersona() !== "me") setPersona("me");
  }, []);
  // Bills the server no longer knows (expired, deleted, broken link) leave the list;
  // for the others the paid status is brought up to date.
  useEffect(() => {
    let cancelled = false;
    for (const b of loadRecent()) {
      api
        .getBill(b.id)
        .then((snap) => {
          if (snap.isOwner || !snap.me) return;
          const markedPaid = Boolean(snap.myPayment?.markedPaidAt);
          if (markedPaid === Boolean(b.markedPaid)) return;
          updateRecent(b.id, { markedPaid });
          if (!cancelled) setRecent(loadRecent());
        })
        .catch((e: unknown) => {
          if (!(e instanceof ApiError && e.status === 404)) return; // offline etc.: keep it
          forgetBill(b.id);
          if (!cancelled) setRecent(loadRecent());
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);
  const profile = loadOwnProfile();
  const ready = Boolean(profile.name.trim() && (profile.paypalMe.trim() || profile.paypalEmail.trim()));

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
          <button className="avatar-btn" aria-label="Profil" onClick={() => navigate("/profile")}>
            {profile.name ? profile.name.slice(0, 1).toUpperCase() : "?"}
          </button>
        }
      />
      <main className="content">
        <section className="hero">
          <p className="eyebrow">{profile.name ? `Hi ${profile.name}!` : "Willkommen bei billsplit"}</p>
          <h2>
            Einer zahlt.
            <br />
            <span className="hl">Alle splitten.</span>
          </h2>
          <p className="muted">
            Rechnung fotografieren, QR-Code zeigen – deine Freunde haken ab, was sie hatten, und zahlen Dir ihren Anteil direkt
            per PayPal.
          </p>
        </section>

        {DEMO && (
          <p className="demo-banner">
            <b>Demo-Version.</b> Alles bleibt in diesem Browser. Auf der Rechnung kannst du oben zwischen Dir und deinen
            Freunden Anna und Ben umschalten und so beide Seiten ausprobieren.
          </p>
        )}

        <section className="actions">
          {ready ? (
            <label className="action-card primary">
              <span className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 10.5 3.5h3a1.5 1.5 0 0 1 1.2.7L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
                  <circle cx="12" cy="12.5" r="3.5" />
                </svg>
              </span>
              <span className="action-text">
                <b>Rechnung fotografieren</b>
                <small>Du hast bezahlt und willst das Geld zurück</small>
              </span>
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          ) : (
            <button className="action-card primary" onClick={() => navigate("/profile?next=new")}>
              <span className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 10.5 3.5h3a1.5 1.5 0 0 1 1.2.7L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
                  <circle cx="12" cy="12.5" r="3.5" />
                </svg>
              </span>
              <span className="action-text">
                <b>Rechnung fotografieren</b>
                <small>Einmalig: Name &amp; PayPal hinterlegen</small>
              </span>
            </button>
          )}

          {/* Digital receipts (app, e-mail, delivery service): pick a screenshot instead of taking a photo. */}
          {ready ? (
            <label className="action-card secondary">
              <span className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                  <path d="M9.5 7.5h5M9.5 10.5h5M9.5 13.5h3" />
                  <path d="M10.5 18.5h3" />
                </svg>
              </span>
              <span className="action-text">
                <b>Screenshot hochladen</b>
                <small>Für digitale Rechnungen aus App oder E-Mail</small>
              </span>
              <input type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          ) : (
            <button className="action-card secondary" onClick={() => navigate("/profile?next=new")}>
              <span className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                  <path d="M9.5 7.5h5M9.5 10.5h5M9.5 13.5h3" />
                  <path d="M10.5 18.5h3" />
                </svg>
              </span>
              <span className="action-text">
                <b>Screenshot hochladen</b>
                <small>Für digitale Rechnungen aus App oder E-Mail</small>
              </span>
            </button>
          )}

          {DEMO ? (
            <button className="action-card" onClick={() => (ready ? navigate(`/b/${createSampleBill()}`) : navigate("/profile?next=sample"))}>
              <span className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 3.5h10v16l-1.7-1.3-1.6 1.3-1.7-1.3-1.7 1.3-1.6-1.3L7 19.5z" />
                  <path d="M9.5 8h5M9.5 11h5M9.5 14h3" />
                </svg>
              </span>
              <span className="action-text">
                <b>Beispielrechnung ansehen</b>
                <small>Mit Anna und Ben – schon teilweise abgehakt</small>
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
              <b>QR-Code scannen</b>
              <small>Ein Freund hat bezahlt – du übernimmst deinen Teil</small>
            </span>
          </button>
          )}
        </section>

        {recent.length > 0 && (
          <section>
            <h3 className="section-title">Deine Rechnungen</h3>
            <ul className="list">
              {recent.map((b) => (
                <li key={b.id} className="list-item">
                  <button className="list-main" onClick={() => navigate(`/b/${b.id}`)}>
                    <span className="list-title">{b.title || "Rechnung"}</span>
                    <span className="muted small">
                      {new Date(b.createdAt).toLocaleDateString("de-DE")} · {b.role === "owner" ? "du hast bezahlt" : b.markedPaid ? <span className="list-paid">✓ als bezahlt markiert</span> : "du schuldest"}
                    </span>
                  </button>
                  <button
                    className="icon-btn subtle"
                    aria-label="Aus Liste entfernen"
                    onClick={() => {
                      forgetBill(b.id);
                      setRecent(loadRecent());
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="how">
          <h3 className="section-title">So funktioniert's</h3>
          <ol className="steps">
            <li>
              <span>1</span>
              <div>
                <b>Foto oder Screenshot.</b> Alle Positionen inkl. Mengen werden automatisch erkannt.
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <b>QR-Code zeigen.</b> Freunde scannen ihn mit billsplit und erscheinen sofort bei Dir.
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <b>Abhaken &amp; zahlen.</b> Jeder sieht live, wer was hat, und zahlt mit einem Tipp per PayPal.
              </div>
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
