import type { ReactNode } from "react";
import Header from "../components/Header";
import { lang, t } from "../lib/i18n";
import { loadOperator, type Operator } from "../lib/operator";
import { navigate } from "../lib/router";

/** Date of the current version of the privacy policy. */
const AS_OF = "21.10.2026";

/** Name, address and contact – or a note that they follow (no OPERATOR_* set, or the demo). */
function OperatorBlock({ operator }: { operator: Operator | null }) {
  if (!operator?.name) return <p className="legal-missing">Angaben zum Betreiber folgen.</p>;
  return (
    <address className="legal-operator">
      {operator.name}
      {operator.address.map((line) => (
        <span key={line}>
          <br />
          {line}
        </span>
      ))}
      {operator.email && (
        <>
          <br />
          E-Mail: <a href={`mailto:${operator.email}`}>{operator.email}</a>
        </>
      )}
    </address>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Imprint({ operator }: { operator: Operator | null }) {
  return (
    <>
      <h2 className="legal-title">Impressum</h2>
      <Section title="Angaben gemäß § 5 DDG">
        <OperatorBlock operator={operator} />
      </Section>
      <Section title="Verantwortlich für den Inhalt">
        <p>{operator?.name || "Der Betreiber (siehe oben)."}</p>
      </Section>
      <Section title="Haftung für Links">
        <p>
          klicksplit verlinkt auf Angebote Dritter (z.B. PayPal, WhatsApp). Für deren Inhalte sind ausschließlich deren Anbieter verantwortlich.
        </p>
      </Section>
    </>
  );
}

function Privacy({ operator }: { operator: Operator | null }) {
  const contact = operator?.email ? <a href={`mailto:${operator.email}`}>{operator.email}</a> : "die oben genannte Adresse";
  return (
    <>
      <h2 className="legal-title">Datenschutzerklärung</h2>
      <p className="muted small">Stand: {AS_OF}</p>

      <Section title="Kurz gesagt">
        <ul>
          <li>klicksplit verarbeitet nur, was zum Aufteilen von Rechnungen nötig ist.</li>
          <li>Keine Werbung, kein Tracking, keine Cookies, keine Analyse-Dienste Dritter.</li>
          <li>Ein Konto ist freiwillig; ohne Konto kennt klicksplit Dich nur über eine zufällige Gerätekennung.</li>
        </ul>
      </Section>

      <Section title="Verantwortlicher">
        <OperatorBlock operator={operator} />
      </Section>

      <Section title="Daten auf Deinem Gerät">
        <p>
          Im Speicher Deines Browsers bzw. der Home-Bildschirm-App liegen eine zufällige Gerätekennung, Dein Profil (Name, Zahlungsdaten,
          Sprache, Heimwährung), die Liste Deiner Rechnungen und einige Einstellungen (z.B. welche Hinweise schon gezeigt wurden). Das ist für
          den Betrieb unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG); es werden keine Cookies gesetzt. Du kannst diese Daten jederzeit über
          die Einstellungen Deines Browsers löschen.
        </p>
      </Section>

      <Section title="Rechnungen">
        <p>
          Wenn Du eine Rechnung erstellst oder einer beitrittst, speichert klicksplit auf dem Server: Titel, Datum, Positionen und Beträge,
          Trinkgeld und Gebühren, die Namen der Beteiligten, wer was übernommen hat, Bezahlt-Vermerke, Erinnerungen und Ausgleichszahlungen
          sowie die Zahlungsdaten des Rechnungsstellers (PayPal.Me-Name oder PayPal-E-Mail, IBAN mit Kontoinhaber, Wero-Handynummer oder
          -E-Mail). Hast Du einen Beleg fotografiert, wird auch das Foto gespeichert, damit alle Beteiligten das Original sehen können.
        </p>
        <p>
          Beteiligte erscheinen nur unter dem Namen, den sie selbst angeben (bzw. den der Rechnungssteller aus einer früheren gemeinsamen
          Rechnung übernimmt), und unter einer pseudonymen Kennung, die aus der Gerätekennung errechnet wird. Eine Rechnung sieht jeder, der
          ihren Link bzw. QR-Code hat – teile ihn deshalb nur mit den Beteiligten.
        </p>
        <p>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Nutzung von klicksplit auf Deinen Wunsch).</p>
      </Section>

      <Section title="Belegerkennung">
        <p>
          Fotografierst Du einen Beleg, wird das Bild (verkleinert) an die Anthropic PBC, USA, übermittelt, die mit ihrem KI-Modell Claude die
          Positionen ausliest. Das Ergebnis kommt zurück an klicksplit. Nach eigenen Angaben verwendet Anthropic Daten aus seiner
          Programmierschnittstelle nicht zum Trainieren seiner Modelle. Ist die KI-Erkennung nicht verfügbar, liest klicksplit den Beleg
          direkt auf Deinem Gerät, ohne Übermittlung. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.{" "}
          <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">
            Datenschutz bei Anthropic
          </a>
        </p>
      </Section>

      <Section title="Konto (freiwillig)">
        <p>
          Legst Du ein Konto an, speichert klicksplit Deine E-Mail-Adresse zusammen mit Deiner Gerätekennung und Deinem Profil, damit Du Deine
          Rechnungen auf jedem Gerät wiederfindest. Zur Anmeldung schicken wir Dir einen sechsstelligen Code (15 Minuten gültig) und nach der
          Anmeldung eine Willkommensmail. Die Mails verschickt die Resend (Plus Five Five, Inc.), USA. Das Konto kannst Du jederzeit im Profil
          löschen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.{" "}
          <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Datenschutz bei Resend
          </a>
        </p>
      </Section>

      <Section title="Mitteilungen (freiwillig)">
        <p>
          Erlaubst Du Mitteilungen, speichert klicksplit die Push-Adresse, die Dein Browser dafür vergibt, und Deine Sprache. Die Mitteilungen
          (z.B. „Anna hat bezahlt“) laufen über den Push-Dienst Deines Browser- bzw. Geräteherstellers (z.B. Apple, Google, Mozilla).
          Rechtsgrundlage ist Deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); Du kannst sie jederzeit im Profil oder in den Einstellungen
          Deines Geräts widerrufen.
        </p>
      </Section>

      <Section title="Betrieb, Sicherheit und Statistik">
        <ul>
          <li>
            Nutzungsstatistik: Pro Gerät (nur über die pseudonyme Kennung) speichert klicksplit ersten und letzten Besuch, Zahl der Besuche,
            ob die Home-Bildschirm-App benutzt wird, und die Sprache – ohne IP-Adresse, höchstens 400 Tage.
          </li>
          <li>Fehlerberichte: Tritt in der App ein Fehler auf, werden die Fehlermeldung, die betroffene Seite und die Browserkennung (User-Agent) gespeichert; es bleiben die letzten 200.</li>
          <li>Für die KI-Erkennung werden pro Tag nur Anzahl, Verbrauch und Kosten gezählt, keine Inhalte (60 Tage).</li>
          <li>
            Deine IP-Adresse wird nur im Arbeitsspeicher verarbeitet: zur Begrenzung von Missbrauch (z.B. zu viele Code-Anforderungen) und für die
            Übergabe von Safari in die Home-Bildschirm-App (gilt nur im selben Netz). Sie wird von klicksplit nicht gespeichert.
          </li>
          <li>Zur Sicherung werden die Daten täglich kopiert; die Sicherungen werden nach 14 Tagen gelöscht.</li>
        </ul>
        <p>Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren, funktionierenden Betrieb (Art. 6 Abs. 1 lit. f DSGVO).</p>
      </Section>

      <Section title="Hosting">
        <p>
          klicksplit läuft bei der Railway Corporation, USA. Dort liegen alle oben genannten Server-Daten; der Anbieter kann zudem technische
          Zugriffsprotokolle führen.{" "}
          <a href="https://railway.com/legal/privacy" target="_blank" rel="noopener noreferrer">
            Datenschutz bei Railway
          </a>
        </p>
        <p>
          Die Namensauflösung der Domain klicksplit.de übernimmt die Cloudflare, Inc., USA. Rufst Du klicksplit.de ohne „www“ auf, leitet
          Cloudflare Dich auf www.klicksplit.de weiter und verarbeitet dafür technisch Deine IP-Adresse und die aufgerufene Adresse.{" "}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">
            Datenschutz bei Cloudflare
          </a>
        </p>
      </Section>

      <Section title="Übermittlung in die USA">
        <p>
          Railway, Cloudflare, Anthropic und Resend sitzen in den USA. Die Übermittlung erfolgt auf Grundlage des EU-US Data Privacy Framework, soweit der
          Anbieter danach zertifiziert ist, und im Übrigen auf Grundlage der Standardvertragsklauseln der EU-Kommission (Art. 46 DSGVO).
        </p>
      </Section>

      <Section title="Links zu anderen Diensten">
        <p>
          Tippst Du auf „Mit PayPal bezahlen“, „Per WhatsApp senden“ oder Ähnliches, öffnet sich der jeweilige Dienst; dabei gelten dessen
          Datenschutzbestimmungen. klicksplit gibt dabei nur das weiter, was im Link steht (z.B. Betrag und PayPal.Me-Name). Die Wechselkurse
          lädt der Server bei der Europäischen Zentralbank, ohne Daten von Dir.
        </p>
      </Section>

      <Section title="Wie lange wir Daten speichern">
        <p>
          Rechnungen bleiben gespeichert, damit alle Beteiligten auch später noch nachsehen und ausgleichen können; sie werden nicht automatisch
          gelöscht. Auf Wunsch löschen wir eine Rechnung (dann für alle Beteiligten), Dein Konto oder alle Deine Angaben – schreib uns an {contact}. Dann steht in allen Rechnungen
          „Gelöscht“ statt Deines Namens, Zahlungsdaten und Belegfotos Deiner Rechnungen werden entfernt; die Beträge bleiben, damit die
          anderen weiter ausgleichen können. Ein Konto bleibt bis zu seiner Löschung, Push-Adressen bis zum Widerruf, Anmelde-Codes 15 Minuten.
        </p>
      </Section>

      <Section title="Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
          Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Eine Einwilligung
          kannst Du jederzeit für die Zukunft widerrufen. Wende Dich dafür an {contact}. Außerdem kannst Du Dich bei einer
          Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).
        </p>
        <p>Es gibt keine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO.</p>
      </Section>
    </>
  );
}

/** Imprint and privacy policy – German only, as required for a German operator. */
export default function Legal({ kind }: { kind: "privacy" | "imprint" }) {
  const operator = loadOperator();
  return (
    <div className="page legal-page">
      <Header back="/" title={kind === "privacy" ? t("Datenschutz") : t("Impressum")} />
      <main className="content legal" lang="de">
        {lang !== "de" && <p className="alert legal-lang" lang={lang}>{t("Diese Seite gibt es nur auf Deutsch.")}</p>}
        {kind === "privacy" ? <Privacy operator={operator} /> : <Imprint operator={operator} />}
        <p className="legal-switch">
          <button type="button" className="link-btn" onClick={() => navigate(kind === "privacy" ? "/impressum" : "/datenschutz")}>
            {kind === "privacy" ? t("Impressum") : t("Datenschutz")}
          </button>
        </p>
      </main>
    </div>
  );
}
