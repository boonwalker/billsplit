# billsplit – Arbeitsgrundlage für Claude

Diese Datei wird von Claude Code in jeder neuen Sitzung automatisch gelesen. Sie hält fest, **wie** wir an billsplit
arbeiten und **was** bisher entschieden wurde, damit eine neue Sitzung (oder ein neues Projekt) nahtlos weitermachen
kann. Weitere Quellen:

- `README.md` – alle Funktionen aus Nutzersicht, Technik, Konfiguration, API
- `docs/verlauf-anforderungen.md` – sämtliche Wünsche des Auftraggebers chronologisch im Wortlaut (das „Warum“)
- `e2e/README.md` – Klick-Tests mit Playwright/Chromium

Beim Einstieg in eine neue Sitzung: diese Datei und das README lesen, `git log --oneline | head -30` ansehen, dann
`npm install && npm test` laufen lassen.

## Zusammenarbeit (verbindlich)

- **Sprache:** Antworten auf Deutsch, den Auftraggeber mit **„Sie“** ansprechen. Knapp, mit Ergebnis zuerst.
- **Name:** In allen App-Texten heißt das Produkt **„klicksplit“** (seit 11.10.2026, Logo B „Beleg mit Tipp“: Beleg
  mit Haken und Tipp-Ring, `src/components/Logo.tsx`, `public/icon.svg`, PNG-Icons mit `e2e/icons.mjs`). Repo, Ordner
  und interne Schlüssel (`billsplit.*`, `x-billsplit-key`, Ereignisnamen, Backup-Dateien) bleiben „billsplit“ – nie
  umbenennen, sonst gehen gespeicherte Daten verloren. Logo-Entwürfe A–C: https://claude.ai/artifact/997z19NSsceErabgCCqXuv
- **App-Texte:** „Dir“ wird in der gesamten App **immer großgeschrieben** (ausdrücklich gewünscht). Ebenso werden
  „Du“, „Dein“, „Deine“ in neuen Texten großgeschrieben.
- **Fragen sind Fragen:** Fragt der Auftraggeber etwas („Kannst Du …?“, „Was wäre, wenn …?“), erst antworten bzw.
  vorschlagen, nicht ungefragt umsetzen.
- **Git:** Alles geht **direkt auf `main`** – keine Pull Requests, keine Feature-Branches (so gewünscht). Der alte
  Branch `claude/bill-split-qr-app-lsufvh` liegt noch auf GitHub und wird nicht mehr benutzt.
  Railway deployt jeden Push auf `main` automatisch.
- **Commits:** deutsche, kurze, beschreibende Betreffzeile (z. B. „Ladebildschirme ohne Trennlinie unter der
  Kopfzeile“). Die Attribution-Zeilen am Ende gemäß Vorgabe der jeweiligen Sitzung. **Keine Modellbezeichnungen** in
  Commits, Code-Kommentaren oder sonstigen Repo-Inhalten.
- **Kein Prettier** (würde das ganze Projekt umformatieren). Stil der umgebenden Datei übernehmen: Code-Kommentare
  auf Englisch, UI-Texte auf Deutsch, Kommentardichte wie im Umfeld.
- **Modelleinstellungen der Belegerkennung nicht ändern** (Entscheidung vom 10.10.2026): Standardmodell in
  `server/parseReceipt.ts`, `effort: "medium"`, kein Fast Mode. Nur auf ausdrücklichen Wunsch anfassen.

### Ablauf nach jeder Änderung

1. `npm run typecheck` und `npm test` (aktuell 146 Tests, alle grün).
2. `npm run build` und `npm run test:e2e` (feste Klick-Tests, `e2e/specs`; lokal mit
   `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Bei UI-Änderungen zusätzlich passende Skripte
   aus `e2e/*.mjs` laufen lassen und Screenshots ansehen (siehe `e2e/README.md`). Neue Abläufe bekommen einen
   Klick-Test in `e2e/specs`. Die CI (`.github/workflows/ci.yml`) prüft dasselbe bei jedem Push.
3. README anpassen, wenn sich Verhalten ändert (Abschnitte sind nach Funktionen gegliedert).
4. Commit und Push auf `main`.
5. **Demo-Artifact aktualisieren:** `npm run build:demo`, dann das Artifact
   **https://claude.ai/artifact/UDuSsFPTSGVB8QNeGYoGVZ** neu veröffentlichen:
   - `file_path`: `dist-demo/artifact.html`, `url`: die Artifact-URL oben, `label`: kurzer Name der Änderung
   - `files`: die neuen `assets/index-*.js` und `assets/Scan-*.js` aus `dist-demo/assets/` hinzufügen, die zuvor
     veröffentlichten Versionen auf `null` setzen. (Weitere Chunks wie `src-*.js` und `rolldown-runtime-*.js` nur
     mitgeben, wenn sich ihr Hash geändert hat.)
   - In einer **neuen Sitzung** das Artifact vorher einmal mit `action: "read"` lesen (sonst wird der Publish
     abgelehnt) und mit `action: "list", scope: "files"` nachsehen, welche Asset-Namen aktuell veröffentlicht sind.
   - Zuletzt veröffentlicht: `assets/index-CjkrlHwY.js`, `assets/Scan-bJLkgpgz.js` (Version 140).

## Betrieb

| Was | Wo |
| --- | --- |
| Live-App | **https://www.klicksplit.de** (seit 11.10.2026; Railway, Free-Tarif, ein Service + Volume `/data`). Alte Adresse https://billsplit-production-af2e.up.railway.app bleibt und leitet um – nie löschen |
| Demo (ohne Server) | https://claude.ai/artifact/UDuSsFPTSGVB8QNeGYoGVZ (Daten im Browser, „Ansicht als“ Anna/Ben) |
| Repo | `boonwalker/billsplit`, Branch `main` |
| Railway-Variablen | `ANTHROPIC_API_KEY` gesetzt; `RECEIPT_LIMIT_PER_DAY=20` als Kostenbremse; `PUBLIC_URL=https://www.klicksplit.de` |
| Domain | `klicksplit.de` bei INWX: CNAME `www` → Railway (Hauptdomain ohne www geht bei INWX nicht, Web-Weiterleitung von INWX nie benutzen – löscht alle CNAMEs). Einrichtung im README „Umzug auf eine neue Adresse“ |

Render wird nicht mehr benutzt (zu teuer, `render.yaml` ist entfernt). Der Auftraggeber nutzt die App vor
allem auf dem **iPhone**, in Safari und als Home-Bildschirm-App – iOS-Eigenheiten haben Vorrang.

## Architektur in Kürze

- **Stack:** React 19 + TypeScript + Vite (PWA), Node-HTTP-Server ohne Framework (`server/app.ts`, Validierung mit
  zod), vitest. Daten in SQLite (`node:sqlite`, `server/persistence.ts`; Fallback JSON), alles im Speicher gehalten,
  geschrieben werden nur geänderte Rechnungen; tägliche Backups in `DATA_DIR/backups`. Server wird mit esbuild zu `dist-server/index.js` gebündelt (wenig RAM auf Railway).
- **Geld immer in ganzen Cent** (`src/lib/money.ts`), nie Fließkomma-Euro.
- **`src/lib/billCore.ts`** enthält alle fachlichen Regeln (Beitreten, Abhaken, Bezahlen, Ausgleichszahlungen,
  Snapshot pro Betrachter). Server (`server/store.ts`, JSON-Datei) und Demo (`src/lib/localApi.ts`, localStorage)
  nutzen denselben Kern – Regeln dort ändern, nicht doppelt.
- **`src/lib/bill.ts`:** Datenmodell + Berechnungen (Anteile, Trinkgeld, Gebühren, Gleichverteilung, Teiler,
  `openShare`).
- **Identität:** Jedes Gerät hat einen geheimen Schlüssel (`localStorage billsplit.deviceKey`, Header
  `x-billsplit-key`, beim SSE-Stream Query-Parameter `key`). Teilnehmer-ID = sha256-Hash des Schlüssels → dasselbe
  Gerät hat in allen Rechnungen dieselbe ID (Grundlage für Dashboard und Ausgleich, nie über Namen zuordnen).
- **Live:** SSE pro Rechnung (`/api/bills/:id/events`) und app-weit (`/api/events`, Ereignisse `data`/`presence`).
  Online-Zählung im Arbeitsspeicher mit 12 s Karenz → **nur eine Server-Instanz** möglich.
- **Ausgleichszahlungen** sind der einzige Weg, über Rechnungen hinweg auszugleichen – Gesamtausgleich (Planer) und
  Ausgleich mit einer Person (`SettleSheet`, `src/lib/settle.ts`) erzeugen beide eine Zahlung über
  `createTransfer`: vom Zahler (wartet auf Bestätigung), vom Empfänger mit `fromId` (sofort bestätigt) oder mit
  Betrag 0 als gegenseitige Verrechnung (Gegenseite bestätigt).
- **Benachrichtigungen:** Der Kern ruft `notify(participantId, notice)` auf (bezahlt markiert, Ausgleich gesendet/
  bestätigt/abgelehnt/zurückgezogen); der Server schickt das per Web Push (`server/push.ts`, `public/sw.js`,
  `src/lib/push.ts`). VAPID-Schlüssel und Abos liegen in `DATA_DIR` (`vapid.json`, `push.json`).
- **Monitoring:** `server/monitor.ts` (KI-Aufrufe, Tokens, Kosten, Fehler pro Tag → `monitor.json`), Betriebsseite
  `server/adminPage.ts` unter `/api/admin?token=ADMIN_TOKEN`; die App meldet Fehler über `src/lib/errorReport.ts` und
  `ErrorBoundary`.
- **Gerät wechseln:** Einmal-Code (`server/deviceLink.ts`, Route `#/geraet/<code>`) bzw. Wiederherstellungs-Code
  (= Gerätekennung); die Rechnungsliste kommt dann von `/api/my-bills`.
- **Konto (optional):** E-Mail-Adresse ↔ Gerätekennung (`server/accounts.ts`, `DATA_DIR/accounts.json`), Anmeldung
  ohne Passwort per 6-stelligem Code (kein Link – der öffnet auf dem iPhone immer Safari). Versand über Resend
  (`server/mail.ts`, `RESEND_API_KEY`, `MAIL_FROM`; ohne nur Log, in Klick-Tests Datei `MAIL_OUTBOX`). Anmelden auf einem
  anderen Gerät übernimmt dessen Teilnahmen ins Konto (`mergeParticipant`) und gibt ihm Schlüssel, Profil, Rechnungen
  (`src/lib/account.ts`, `AccountForm`, `AccountSection`, Seite `#/anmelden`). Absender-Domain `klicksplit.de` (INWX,
  DNS-Einträge für Resend), `MAIL_FROM=klicksplit <code@klicksplit.de>`.
- **Safari → App:** „In der App öffnen“ hängt `?von=<Einmal-Code>` an den kopierten Link; die App ruft
  `/api/merge-device` auf, `mergeParticipant` legt die Safari-Identität mit der App-Identität zusammen.
- **Umzug der Adresse:** `PUBLIC_URL` ist die maßgebliche Adresse (Meta-Tag `klicksplit-home`, `src/lib/move.ts`).
  Browser an anderen Adressen springen mit Einmal-Code (`#/umzug/<code>?ziel=…`, `/api/move`) dorthin, die alte
  Home-Bildschirm-App zeigt `MovedNotice`. Seit 11.10.2026 aktiv (`PUBLIC_URL=https://www.klicksplit.de`).
- **Belegerkennung:** `server/parseReceipt.ts` (Claude, Structured Outputs, Summenprüfung mit Wiederholung, Bild
  max. 2000 px Kantenlänge). Fallback: Tesseract.js im Browser. In der Demo über `window.claude` (`claudeRuntime.ts`).
- **Seiten:** `Home`, `Expense` (Ausgabe eingeben), `Scan`, `Editor` (Prüfen, Trinkgeld, Supermarkt-Frage, „Manches nicht“; Entwurfs-Modell in
  `src/lib/draft.ts`, Wartebildschirme in `BusyScreen`), `BillPage` (fertige Rechnung; Teile in
  `src/components/bill/`: `QrHero`, `LiveBadge`, `ReceiptPeek`, `OwnerBar`; Streichen/„/2“ als reine Funktionen in
  `src/lib/billEdits.ts`), `Dashboard`, `Profile`, `DeviceLink`, `OriginalReceipt`.
- **CSS:** `src/styles.css` importiert die Teile in `src/styles/NN-name.css` in fester Reihenfolge (spätere Regeln
  gewinnen) – neue Regeln in die Datei ihres Bereichs oder eine neue Datei am Ende.
- **Wichtige Komponenten:** `Receipt` (Beleg mit Abhaken/Streichen), `ClaimDemo`/`ReceiptDemo` (Erklär-Animationen
  mit Sprechblasen), `SupermarketSheet`, `DivisorSheet` („/2“–„/5“), `PayBar`, `PayButtons`, `OwnerPanel`,
  `SettleSheet` (Ausgleich mit einer Person), `SettlementPanel` (Gesamtausgleich, Eingangs-Bestätigung).
- **Ausgleich:** `src/lib/balances.ts` (Bilanzen je Person), `src/lib/simplify.ts` (Planer: gegenseitig verrechnen →
  Schuldketten weiterreichen, max. 4 Schritte, nur ohne neuen Empfänger → je Empfänger bündeln), `src/lib/settle.ts`.

## Invarianten und Fallstricke

- **Ausgleichszahlungen (Transfers):** Zuordnung `{billId, debtorId, creditorId, amount}`; für jede Person muss die
  Summe aufgehen (Zahler `+amount`, Empfänger `−amount`, alle anderen 0). Nur der Empfänger bestätigt/lehnt ab, nur
  der Zahler zieht zurück. Wartende Zahlungen zählen bereits als beglichen. Jeder sieht nur Zuordnungen aus
  Rechnungen, an denen er selbst teilnimmt (Datenschutz).
- **Gespeicherte Daten nie ohne Migration umbauen:** `server/store.ts` liest noch das alte Dateiformat (reine
  Rechnungsliste); Stück-genaue Zuordnungen werden beim Laden aus alten Mengen umgestellt. Rechnungen werden nach
  60 Tagen gelöscht.
- **iPhone:** Safari und Home-Bildschirm-App haben getrennte Speicher (→ Weiterleitung über `server/handoff.ts`).
  In die Zwischenablage kopieren klappt nur, wenn derselbe Tipp die App nicht verlässt → PayPal in zwei Tipps.
  Haptik auf iOS 18 über den Schalter-Trick (`src/lib/haptics.ts`). Langes Drücken darf keine Textauswahl auslösen.
- **Erklär-Animationen:** Sprechblasen zeigen nie auf Positionen ohne Abhak-Kreis oder mit mehrfacher Menge; keine
  Sprechblasen, solange die Gleichverteilung an ist; laufen nur einmal pro Rechnung und Gerät (Flags in
  localStorage, z. B. `billsplit.claimDemo.<id>`, `billsplit.peekShown.<id>`), enden beim ersten Berühren.
- **Rechnungssteller-Rolle** (`ownerId`) wandert nur über einen Nachweis derselben Person: Konto (E-Mail-Code),
  „Gerät wechseln“ oder Wiederherstellungs-Code. Der Safari→App-Code (`?von=`) nie: `mergeParticipant(…, { ownership:
  false })`, gilt nur im selben Netz (`networkKey`), und Rechnungssteller bekommen keinen `?von=` in kopierte Links
  (Vorfall 11.10.2026: Einladung führte in die Rechnungssteller-Ansicht – Ursache war ein Testhandy, das mit dem
  Konto des Rechnungsstellers angemeldet war; Lücke trotzdem geschlossen). Rechnungssteller und Gast derselben
  Rechnung werden nie zusammengelegt (`mergeParticipant` lässt solche Rechnungen aus).
- **Lange Drücken („/2“)** nur für den Rechnungssteller und nicht im Modus „Jeder selber abhaken“; ein präziser Tipp
  auf „/2“ hebt den Teiler auf, statt die Zeile zu streichen.
- **Klick-Tests:** Alte Testserver vom selben Port verfälschen Ergebnisse. Beenden mit
  `ps -eo pid,comm,args | awk '$2=="node" && /dist-server/ {print $1}' | xargs -r kill` – **nicht** `pkill -f …` und
  nicht `grep` auf die Kommandozeile im selben Befehl wie den Teststart (trifft die eigene Shell). Temporäre vitest-Tests in `test/` anlegen (`vitest --root /` hängt).
- **Diagramm-Farben** (Dashboard) sind auf Farbenblindheit geprüft: hell `--lent #0f7a4d` / `--owed #f76707`,
  dunkel `#22a86a` / `#e8590c`. Nicht ohne erneute Prüfung ändern.

## Feste Formulierungen (vom Auftraggeber so gewünscht)

- „Dir fehlen noch“ (nicht „Fehlt Dir noch“) · „beigetreten“ (nicht „gescannt“)
- Bezahl-Knopf „Anteil begleichen · Betrag“, danach „Mit PayPal bezahlen · Betrag“, darunter „Als bezahlt markieren“
- PayPal-Hinweis zweizeilig: „xx,xx € in die Zwischenablage kopiert –“ / kleiner, einzeilig: „in PayPal ins
  Betragsfeld tippen und „Einfügen“ wählen.“
- „Rechnung erstellen“ (nie „QR-Code erstellen“) · Scan: „klicksplit analysiert den Beleg“ · nach „Rechnung erstellen“
  nur drei Punkte + „klicksplit generiert die interaktive Rechnung“
- Startseite: „Du hast bezahlt und willst anteilig Geld zurück“, „Für digitale Rechnungen aus App oder Mail“,
  „Anteil“ statt „Teil“
- Rechnungsliste: „Du schuldest · Betrag“ (immer der aktuell noch offene), „✓ als bezahlt markiert“, „✓ beglichen“,
  „Du leihst · Betrag“ (immer der aktuell noch offene), „Du leihst · ✓ ausgeglichen“ (grün mit Haken)
- Trinkgeld-Reiter: „absolut“, „in Prozent“, „als Endbetrag“ (Endbetrag → Trinkgeld = Differenz)
- Supermarkt-Frage: „Soll etwas nicht oder nur teilweise in Rechnung gestellt werden?“ / kleiner „z.B. Gewürze,
  Duschgel, Pfand?“; Knöpfe „Alles aufteilen“, „Manches nicht“, „Jeder selber abhaken“; Personenzahl „inklusive Dir“
- Sprechblasen: „Antippen = abhaken“, „Namen antippen = mit Anna teilen“, „„Du“ antippen = Du willst mit
  jemandem teilen“, „Gedrückt halten = nur einen Teil in Rechnung stellen“
- Teilen: „Du wartest auf jemanden“ / „wartet auf jemanden“; „geteilt“ erst, wenn wirklich vollständig geteilt
- Kassenbon-Vorschau: „Deine interaktive Rechnung ist fertig ↓“ (für den Rechnungssteller immer „interaktive“; für
  Freunde bei Gleichverteilung „digitale“)
- Dashboard: „Dashboard · Deine Bilanz“ (Knopf über „Deine Rechnungen“), „Du leihst“ (grün) / „Du schuldest“
  (orange), „N Eingang bestätigen“
- ✕ in der Rechnungsliste: „Bist Du sicher, dass Du diese Rechnung löschen möchtest?“ mit „Löschen“ / „Abbrechen“
- Profil-Assistent: „Wie heißt Du?“, dann „Wie willst Du bezahlt werden?“ mit PayPal / Überweisung / Wero
- Rechnungsliste beim Gast: „Du schuldest · Betrag“ · Rückkehr von PayPal: „Hast Du xx,xx € an Name gesendet?“
- Supermarkt „Alles aufteilen“: „Wie viele teilen sich den Einkauf?“, „/ N“-Stepper, „Abgerechnet werden“; auf der
  Rechnung oben „Vielleicht nicht für alle?“
- „Ausgabe eingeben“ (Startseite, vorerst unter der Rechnungsliste, `src/pages/Expense.tsx`, `#/ausgabe`): Betrag,
  „Wofür?“ mit Schnellauswahl, „Wann?“, „Wie viele teilen sich das?“ / „inklusive Dir“, „Rechnung erstellen“
- „Erinnern“ (Knopf heißt immer nur so): Push-Mitteilung „Niklas erinnert Dich“, wenn der Freund Benachrichtigungen
  hat (bevorzugt), sonst bzw. innerhalb von 12 h danach WhatsApp; auch bei Freunden ohne Häkchen („Bitte hake in … ab,
  was Du hattest.“) und im Dashboard („Carl hat noch nicht bezahlt?“). Status „per Mitteilung erinnert vor …“.
  Regeln in `BillCore.remind`/`remindPerson` (`REMIND_COOLDOWN_MS`), Knopf `RemindButton`.
- Code-Mail: Kassenbon mit Zacken (fährt in Apple Mail herein), „Hi Name,“ bzw. „Hi,“ / „hier ist Dein Code für
  klicksplit:“, Code ohne Leerzeichen in Mint-Box; Schluss nach 3 Leerzeilen: „klicksplit •“, darunter groß „Einer
  zahlt.“ / „Alle splitten.“ (noch auf dem Bon, „Alle splitten.“ mint, kein dunkler Kasten). Willkommensmail „Willkommen bei klicksplit!“ nach Kontoanlage, mit Bon „So einfach geht's“ (Animation Durchstreichen/„/2“, Zeilen antippbar in Apple Mail; `demoReceipt` in `server/mail.ts`).
- Konto: „Deine E-Mail-Adresse“, „Code senden“, „Code eingeben“, „Überspringen“, Startseite „Schon ein Konto?
  Anmelden“, Profil ganz oben „Konto“: „● Angemeldet“ + Adresse bzw. „Nicht angemeldet“ + „Anmelden oder Konto
  anlegen“, „Abmelden“, „Konto löschen“; grüner Haken am Profil-Knopf der Startseite

## Offene Ideen / Backlog (noch nicht beauftragt)

- Datenschutzerklärung und Impressum (nötig, sobald die App öffentlich E-Mail-Adressen sammelt; braucht Name/Anschrift
  des Betreibers).
- `klicksplit.de` ohne www (bei INWX nicht möglich): einzelner DNS-Eintrag vom Typ URL oder Nameserver zu Cloudflare.
  Umzug auf www.klicksplit.de, Umbenennung in „klicksplit“ und Logo B sind erledigt (11.10.2026).

Erledigt am 11.10.2026: optionales E-Mail-Konto. Erledigt am 11.10.2026 (Bedienbarkeits-Analyse vom 10.10.2026 komplett umgesetzt):
Safari- und App-Identität zusammenführen (`?von=`-Code, `mergeParticipant`), „Hast Du … gesendet?“ nach Rückkehr von
PayPal, „Erinnern“ per WhatsApp, erst fotografieren – Profil-Assistent (`ProfileWizard`) während der Erkennung bzw.
für Gäste nach dem Bezahlen, Gesten-Legende („?“, `GestureHelp`), Pfeile im Gesamtausgleich, Du/Dein/Dir überall groß,
`prefers-reduced-motion` für alles (`src/lib/motion.ts`, `27-motion.css`), stärkerer Kontrast blasser Hinweise,
Betrag bei „Du schuldest“, Push und Listen führen direkt an die Stelle (`?an=`, `?zurueck=`, `?zahlung=`),
Supermarkt „Alles aufteilen“ mit „/ N“-Stepper und „Vielleicht nicht für alle?“.

Erledigt am 10.10.2026: einheitlicher Ausgleich über bestätigte Zahlungen, Gerät übertragen/Wiederherstellungs-Code,
Web-Push, zweizeiliger PayPal-Hinweis im Ausgleichs-Fenster.
