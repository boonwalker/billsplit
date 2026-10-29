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

- **Sprache:** Antworten auf Deutsch, den Auftraggeber **duzen** (ausdrücklich gewünscht, 25.10.2026). Knapp, mit Ergebnis zuerst.
- **Name:** In allen App-Texten heißt das Produkt **„klicksplit“** (seit 11.10.2026, Logo B „Beleg mit Tipp“: Beleg
  mit Haken und Tipp-Ring, `src/components/Logo.tsx`, `public/icon.svg`, PNG-Icons mit `e2e/icons.mjs`). Repo, Ordner
  und interne Schlüssel (`billsplit.*`, `x-billsplit-key`, Ereignisnamen, Backup-Dateien) bleiben „billsplit“ – nie
  umbenennen, sonst gehen gespeicherte Daten verloren. Logo-Entwürfe A–C: https://claude.ai/artifact/997z19NSsceErabgCCqXuv
- **Sprachen:** Die App gibt es auf Deutsch (Quelle), Englisch und Spanisch (`docs/i18n.md`). Jeder neue sichtbare
  Text als Literal in `t("…")` (App) bzw. `msg("…")`/Fehlerklasse (Server, gemeinsamer Kern), Übersetzungen in
  `src/i18n/dict/<bereich>.ts`; `test/i18n.test.ts` schlägt fehl, wenn eine fehlt. Gespeicherte Daten nie übersetzen.
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

1. `npm run typecheck` und `npm test` (aktuell 222 Tests, alle grün; 56 Klick-Tests).
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
   - Zuletzt veröffentlicht: `assets/index-BT0EsoHo.js`, `assets/Scan-DtLThanV.js` (Version 192).

## Betrieb

| Was | Wo |
| --- | --- |
| Live-App | **https://www.klicksplit.de** (seit 11.10.2026; Railway, Free-Tarif, ein Service + Volume `/data`). Alte Adresse https://billsplit-production-af2e.up.railway.app bleibt und leitet um – nie löschen |
| Demo (ohne Server) | https://claude.ai/artifact/UDuSsFPTSGVB8QNeGYoGVZ (Daten im Browser, „Ansicht als“ Anna/Ben) |
| Repo | `boonwalker/billsplit`, Branch `main` |
| Railway-Variablen | `ANTHROPIC_API_KEY` gesetzt; `RECEIPT_LIMIT_PER_DAY=20` als Kostenbremse; `PUBLIC_URL=https://www.klicksplit.de`; **kein `DATA_DIR`** (Volume `billsplit-volume` auf `/data`, seit 16.10.2026 geprüft); `ADMIN_TOKEN` gesetzt (nie weitergeben) |
| Domain | `klicksplit.de` registriert bei INWX, **DNS seit 17.10.2026 bei Cloudflare** (Free): CNAME `www` → Railway (grau), Resend-Einträge (grau), `@` → `192.0.2.1` orange mit Redirect Rule `klicksplit.de` → `https://www.klicksplit.de` (301). DNS-Änderungen nur noch bei Cloudflare; Web-Weiterleitung von INWX nie benutzen. Details im README „Umzug auf eine neue Adresse“ |

**Railway-Vorfall 21.10.2026:** Angreifer suchten in Railway-Variablen nach KI-/Cloud-Schlüsseln; Deploys waren
mehrere Tage pausiert („Limited Access“), Pushes aus dieser Zeit wurden nicht nachgeholt. Danach von Hand deployt
(Railway: Cmd+K → „Deploy Latest Commit“; ggf. GitHub in den Account Settings neu verbinden). `ANTHROPIC_API_KEY`,
`RESEND_API_KEY` und `ADMIN_TOKEN` am 25.10.2026 ausgetauscht, Ausgabenlimit in der Anthropic-Konsole gesetzt. Der Workspace läuft noch im Testzugang (Trial, Ende
etwa 9.11.2026) – vorher auf Hobby wechseln, sonst schaltet Railway ab.

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
  `openShare`). Gebühren über null pro Kopf (`perHeadFees`, `sharedPerPerson`), Rabatte (Gebühren unter null) und
  **Trinkgeld anteilig nach Bestellwert** (`itemShare`; Trinkgeld nur bei Rechnungen mit `tipByShare`, gesetzt seit
  16.10.2026 – ältere behalten Trinkgeld pro Kopf, `tipPerHead`; nie umstellen, sonst ändern sich bezahlte Anteile).
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
- **Monitoring:** `server/monitor.ts` (KI-Aufrufe, Tokens, Kosten, Fehler pro Tag → `monitor.json`), Besuche/Geräte
  `server/visits.ts` (`/api/visit` von `src/lib/visits.ts` → `visits.json`), Betriebsseite
  `server/adminPage.ts` unter `/api/admin` (Token-Formular bzw. `?token=ADMIN_TOKEN`, ≥ 12 Zeichen, `adminSecret`; Nutzung, Konten, Geräte, Rechnungen, KI, Fehler); die App meldet Fehler über `src/lib/errorReport.ts` und
  `ErrorBoundary`. Konten verwalten (`POST /api/admin/account`): „Profil zurücksetzen“, „Konto löschen“, „Alle Daten
  löschen“ (Name → „Gelöscht“ über `BillCore.anonymize`/`BillStore.erase`, Beträge bleiben); gelöschte Konten in
  `accounts-removed.json`, `/api/account` meldet `removed`, die App zeigt einmal einen Hinweis (`billsplit.accountRemoved`).
  Rechnung löschen (`POST /api/admin/bill`, „Endgültig löschen“ ankreuzen): `BillCore.removeBill` (Ausgleichszahlungen
  verlieren den Anteil bzw. fallen weg, wenn sie ohne ihn nicht aufgehen), Kennung in `deleted-bills.json`, Abruf → 410,
  Batch → `deleted`, SSE-Ereignis `deleted`; die App entfernt sie spurlos (`dropDeletedBill`). „Anteil entfernen“
  (`POST /api/admin/share`, `BillCore.removeShare`): Häkchen einer Person bei einer Position heraus, live.
  „Verlauf & Wiederherstellen“ (`/api/admin/restore`, `restorePage`, `BillCore.restoreBill`): Rechnung in jeder
  Tagessicherung ansehen und eine Fassung zurückspielen (nur diese Rechnung) – auch gelöschte (Abschnitt „Gelöschte
  Rechnungen“, `deletedBills`, `restoreFromBackup` nimmt sie aus `deleted-bills.json`). **Protokoll** (`server/audit.ts`,
  `audit.json`): jede Zusammenlegung, Anmeldung auf weiterem Gerät, entfernte Personen/Anteile, Wiederherstellungen –
  neue Stellen, die Teilnehmer entfernen oder Häkchen umschreiben, immer mit `this.audit(…)` protokollieren.
  Gedruckte Kurzlinks (`PRINTED_LINKS` in `server/app.ts`, z.B. `/koeln` auf den Bierdeckeln, QR-Code →
  `https://www.klicksplit.de/koeln`): Aufruf zählt in `visits.json` (`sources`), Weiterleitung auf `/`; Kachel
  „Bierdeckel-Scans“. Bierdeckel-Design: https://claude.ai/artifact/5YfutcV3DZ4ZMaSJgLn1o2
- **Restaurant-Modus** (Stufe 2, ohne Bezahlen): `server/venues.ts` (`venues.json`), Tisch-QR `/t/<id>` → offene
  Rechnung bzw. `#/tisch/<id>` (Warteseite), Ampel `src/pages/Restaurant.tsx` (`#/restaurant`, QR-Druck
  `#/restaurant/qr`, `tableLight` in `src/lib/restaurant.ts` über `ownerSummary`), Rechnung am Tisch anlegen über
  `billsplit.pendingTable` + `attachPendingTable` im Editor. Einstieg im Profil „Für Restaurants“. Konzept mit Stufe 3
  (Stripe Connect/Apple Pay) und 4 (Kassenanbindung): https://claude.ai/artifact/VAoxbJbFbDsPhtcjbcXSCf
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
- **Sprache:** `src/lib/i18n.tsx` (Erkennung: Profil-Wahl `billsplit.lang`, sonst `navigator.languages`, sonst
  Englisch; `t`, `rich`, `formatDate`), gemeinsamer Kern `src/i18n/index.ts` (`translate`, `msg`, Beträge als
  `{ cents, currency }`). Server: `requestLang(req)`, Fehler mit `template`/`vars`, Push-Abos mit `lang`, Mails mit `lang`.
- **Währungen:** Dashboard rechnet mehrere Währungen in die Heimwährung um (`src/lib/currency.ts`, Profil
  „Heimwährung“, Standard nach Geräteregion; `mergeBalances`), Kurse = EZB-Referenzkurse über `server/rates.ts`
  (`/api/rates`, `rates.json`). Ausgleichszahlungen bleiben in der Währung der Rechnung.
- **Belegerkennung:** `server/parseReceipt.ts` (Claude, Structured Outputs, Summenprüfung mit Wiederholung, Bild
  max. 2000 px Kantenlänge; „Rückgeld“ bei Kartenzahlung = Trinkgeld, in `RECEIPT_INSTRUCTIONS` und im OCR-Parser). Fallback: Tesseract.js im Browser. In der Demo über `window.claude` (`claudeRuntime.ts`).
- **Seiten:** `Home`, `Expense` (Ausgabe zuweisen), `Scan`, `Editor` (Prüfen, Trinkgeld, Supermarkt-Frage, „Manches nicht“; Entwurfs-Modell in
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
- **Rundung:** „Dir fehlen noch“ = Summe der Anteile der Freunde (wie sie sie sehen und zahlen) + Unzugeordnetes, nie
  „Gesamt − eigener Anteil“; den Rundungscent trägt der Rechnungssteller (`ownerSummary`, Vorfall 16.10.2026: 3,27 € statt 3,28 €).
- **Überzahlung:** Wird ein Anteil nach dem Bezahlen kleiner, schuldet der Rechnungssteller die Differenz zurück
  (`overpaidShare`, `BillCore.refundOf`, umgekehrte Kante im `network`, Rückzahlung als Allocation mit
  `debtorId = ownerId`). Anteile deshalb immer über `billId:debtorId:creditorId` schlüsseln. Vorher fragt
  `RefundConfirm` (`src/lib/refunds.ts`). Was sich geändert hat, merkt `noteShareChanges` als `shareChange` beim Gast
  (Snapshot `myShareChange`, nur solange ein Guthaben besteht); „Stimmt nicht?“ → `contestShare` entfernt nur die
  überschneidenden Stücke des Mitteilenden in genau diesen Zeilen.
- **Nachzahlung:** Wächst ein Anteil nach dem Bezahlen (markiert oder „erhalten“), wird der Unterschied eine eigene
  Zahlung (`TopUp` in `topUps`, zählt in `settledInBill`). `recordPayClick`/`setMarkedPaid` greifen dann auf die
  letzte Nachzahlung, `setReceived(…, topUp)` bestätigt sie einzeln; die erste Zahlung (`payAmount`) nie überschreiben.
- **Gespeicherte Daten nie ohne Migration umbauen:** `server/store.ts` liest noch das alte Dateiformat (reine
  Rechnungsliste); Stück-genaue Zuordnungen werden beim Laden aus alten Mengen umgestellt. Rechnungen werden **nie**
  automatisch gelöscht (60-Tage-Frist am 16.10.2026 auf Wunsch entfernt) – keine Frist wieder einbauen; nur von Hand auf
  der Betriebsseite („Rechnung löschen“).
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
  Rechnung werden nie zusammengelegt (`mergeParticipant` lässt solche Rechnungen aus), ebenso nie zwei Einträge einer
  Rechnung, die beide schon bezahlt haben (`hasPaid`). Vorfall 27.10.2026: bei „C.C. Kowalski“ fehlten nach einer
  Anmeldung im Browser alle Gäste außer Peter, ihre Häkchen standen beim Rechnungssteller – Ursache noch offen, darum
  Protokoll + Wiederherstellen aus Sicherung.
- **Rechnungsliste** (`billsplit.recent`) liegt auf dem Gerät, immer nach Datum sortiert (neueste oben, `newestFirst` –
  Öffnen verschiebt nichts), ohne Obergrenze (20 sichtbar, dann „Ältere anzeigen“); die Startseite ergänzt beim Öffnen und bei Live-Änderungen
  fehlende Rechnungen aus `/api/my-bills` (`syncRecentBills`, z. B. zugeordnete Ausgaben) – als ungelesen (`unread`, grün
  umrandet, pulsierend mit Lichtreflex, bis sie in der Liste angetippt bzw. geöffnet wird). Mit ✕ entfernte bleiben über
  `billsplit.hidden` draußen – ✕ immer über `hideBill`, nie nur `forgetBill`.
  Rechnungen mit offenem Geld oder ausstehender Bestätigung lassen sich nicht entfernen (`stillOpen`). Das Dashboard
  rechnet mit allen Rechnungen vom Server (lokale Liste ∪ `/api/my-bills`), sonst widerspricht der Ring dem Planer.
- **Datenverlust 16.10.2026:** Railway-Variable `DATA_DIR=data` → Daten im Container statt auf dem Volume, nach jedem
  Deploy leer (Konten weg, Listen geleert). Seitdem: Server startet auf Railway nur mit Daten auf dem Volume
  (`server/dataDir.ts`), die App löscht unbekannte Rechnungen nicht (`markGone`, „nicht mehr verfügbar“) und meldet
  nicht still ab (`billsplit.accountLost`, Hinweis auf Startseite/Profil). Beides meldet sie an die Betriebsseite.
- **Lange Drücken** nur für den Rechnungssteller: öffnet `DivisorSheet` mit „Wer hatte das?“ (Personenkreise,
  `assignPeople` in `BillPage`) und „/ N“. Mit Abhaken: `api.assign` mit den vollständigen Häkchen der Person (`assign`
  ersetzt sie). In der Gleichverteilung: `BillItem.for` (zählt nur dort, Häkchen zählen in der Gleichverteilung nie –
  sonst änderten sich alte Rechnungen). Ein präziser Tipp auf „/2“ hebt den Teiler auf, statt die
  Zeile zu streichen. **Namen gedrückt halten** (Rechnungssteller, Abhaken): „Anteil von … entfernen?“
  (`RemoveShareConfirm`, `BillCore.removeGuestShare`, `/unclaim`) – Häkchen eines Gastes an einer Position, immer
  möglich, Gast bekommt eine Mitteilung; der Klick nach dem Halten darf nicht teilen (`onClickCapture`).
- **Rechnungslinks** sind echte Pfade `/b/<id>?to=…` (`billUrl`, für die WhatsApp-Vorschau aus `server/preview.ts`);
  die App biegt sie beim Start auf `/#/b/…` um (`openPathLink` in `main.tsx`). `billIdFromUrl` liest beide Formen –
  alte QR-Codes nie brechen. In der Demo `billUrl(…, DEMO)` → Hash-Form. Vorschau nie mit Beträgen.
- **Schmale Bildschirme** (iPhone mini, große Schrift, Vorfall 29.10.2026: Freundesliste zu einer Wortspalte gequetscht,
  Betrag darüber): Zeilen mit Text links und Betrag/Knöpfen rechts brauchen eine Mindestbreite für den Text und einen
  Block rechts, der als Ganzes umbricht (`.debtor-main`/`.debtor-side`). `e2e/specs/ownerLayout.e2e.ts` prüft
  Freundesliste (320–768 px, 125 % Schrift) und Hauptseiten auf seitliches Überstehen – neue Zeilen dort mitprüfen.
- **Auf der Rechnungsseite scrollt nur der Mittelteil** (`.bill-scroll`). Alles, was darüber liegt (Leisten unten,
  Bon-Schnipsel), braucht `useScrollThrough`, sonst bewegt ein Wisch darauf nichts (Vorfall 21.10.2026, Safari).
- **Datenschutzerklärung** (`src/pages/Legal.tsx`, Stand `AS_OF`): bei jedem neuen Datenfluss (neuer externer Dienst,
  neue gespeicherte Angaben, andere Speicherdauer) mit anpassen. Betreiberangaben nur über `OPERATOR_*`, nie ins Repo.
- **Klick-Tests:** Alte Testserver vom selben Port verfälschen Ergebnisse. Beenden mit
  `ps -eo pid,comm,args | awk '$2=="node" && /dist-server/ {print $1}' | xargs -r kill` – **nicht** `pkill -f …` und
  nicht `grep` auf die Kommandozeile im selben Befehl wie den Teststart (trifft die eigene Shell). Temporäre vitest-Tests in `test/` anlegen (`vitest --root /` hängt).
- **Diagramm-Farben** (Dashboard) sind auf Farbenblindheit geprüft: hell `--lent #0f7a4d` / `--owed #f76707`,
  dunkel `#22a86a` / `#e8590c`. Nicht ohne erneute Prüfung ändern.

## Feste Formulierungen (vom Auftraggeber so gewünscht)

- „Dir fehlen noch“ (nicht „Fehlt Dir noch“) · „beigetreten“ (nicht „gescannt“) · in App-Texten immer „z.B.“ ohne Leerzeichen
- Bezahl-Knopf „Anteil begleichen · Betrag“, danach „Mit PayPal bezahlen · Betrag“, darunter „Als bezahlt markieren“
- PayPal-Hinweis zweizeilig: „xx,xx € in die Zwischenablage kopiert –“ / kleiner, einzeilig: „in PayPal ins
  Betragsfeld tippen und „Einfügen“ wählen.“
- „Rechnung erstellen“ (nie „QR-Code erstellen“) · Scan: „klicksplit analysiert den Beleg“ · nach „Rechnung erstellen“
  nur drei Punkte + „klicksplit generiert die interaktive Rechnung“
- Startseite: „Du hast bezahlt und willst anteilig Geld zurück“, „Für digitale Rechnungen aus App oder Mail“,
  „Anteil“ statt „Teil“
- Rechnungsliste: „Du schuldest · Betrag“ (immer der aktuell noch offene), „✓ als bezahlt markiert“, „✓ beglichen“,
  „Du leihst · Betrag“ (immer der aktuell noch offene), „Du leihst · ✓ ausgeglichen“ (grün mit Haken)
- Trinkgeld-Reiter: „absolut“ (voreingestellt), „in Prozent“, „als Endbetrag“ (Endbetrag → Trinkgeld = Differenz, Feld leer mit „Was hast Du bezahlt?“ – nie den
  Rechnungsbetrag als Platzhalter, sah gesperrt aus); bei
  Lieferbestellungen unter „absolut“ Schnellknöpfe „0,50 €“, „1 €“, „2 €“
- Supermarkt-Frage: „Soll etwas nicht oder nur teilweise in Rechnung gestellt werden?“ / kleiner „z.B. Gewürze,
  Duschgel, Pfand?“; Knöpfe „Alles aufteilen“, „Manches nicht“, „Jeder selber abhaken“; Personenzahl „inklusive Dir“
- Sprechblasen: „Antippen = abhaken“, „Namen antippen = mit Anna teilen“, „„Du“ antippen = Du willst mit
  jemandem teilen“, „Gedrückt halten = nur einen Teil in Rechnung stellen“
- Teilen: „Du wartest auf jemanden“ / „wartet auf jemanden“; „geteilt“ erst, wenn wirklich vollständig geteilt
- Kassenbon-Vorschau: „Deine interaktive Rechnung ist fertig ↓“ (für den Rechnungssteller immer „interaktive“; für
  Freunde bei Gleichverteilung „digitale“)
- Dashboard: „Dashboard · Deine Bilanz“ (Knopf über „Deine Rechnungen“, immer sichtbar – auch ohne Rechnungen); Personen-Ringe
  immer antippbar („Verlauf ansehen ›“, Fenster „Du und Anna“ mit „Gemeinsame Rechnungen“), ebenso die Gesamtbilanz
  (Ring-Mitte bzw. „Alle Rechnungen ansehen ›“, Fenster „Deine Bilanz“: links „Du leihst“, rechts „Du schuldest“, Rechnung
  für Rechnung, `BalanceSheet`), „Du leihst“ (grün) / „Du schuldest“
  (orange), „N Eingang bestätigen“; erledigte Ausgleichs-Meldungen („… alles ausgeglichen.“) nur einmal (`billsplit.seenTransfers`)
- ✕ in der Rechnungsliste: „Bist Du sicher, dass Du diese Rechnung löschen möchtest?“ mit „Löschen“ / „Abbrechen“
- Profil-Assistent: „Wie heißt Du?“, dann „Wie willst Du bezahlt werden?“ mit PayPal / Überweisung / Wero – immer mit
  Ausweg („Überspringen“ beim Rechnungssteller, „Später“ beim Gast; kein Fenster ohne Ausgang)
- Nachträglich mitgeteilt (Bezahl-Leiste, orange): „Andy hat „Pommes“ nachträglich mit Dir geteilt – darum schuldet Dir
  Peter jetzt wieder 2,19 € zurück. Das wird im Dashboard vermerkt und gerät nicht in Vergessenheit!“, darunter
  „Stimmt nicht?“ → „Tippe in der Rechnung bei „Pommes“ auf Andy, um den Anteil wegzuklicken.“
- Nachzahlung (Bezahl-Leiste): „✓ 4,10 € bezahlt – von Peter bestätigt“, orange „Dein Anteil ist nach Deiner Zahlung
  gestiegen – es fehlen noch 5,00 €.“, „Anteil begleichen · 5,00 €“; beim Rechnungssteller eigene Zeile „Niklas ·
  Nachzahlung“ mit eigenem „erhalten“, Mitteilung „Niklas hat nachgezahlt“
- Rechnungsliste beim Gast: „Du schuldest · Betrag“ · Rückkehr von PayPal: „Hast Du xx,xx € an Name gesendet?“
  · vor dem PayPal-Absprung Sprechblase über der Leiste: „↩ Danach wieder zurück in die App kommen und die Zahlung bestätigen“
  – erst nach dem ersten Tipp auf „Anteil begleichen“, auch bei PayPal nur per E-Mail (dort ebenfalls zwei Tipps:
  Betrag kopieren, dann „In PayPal bezahlen“; „Adresse kopieren“ als eigener Tipp)
  (springt bei jedem Erscheinen wie iMessage „auffällig senden“ groß auf, rumpelt, knallt zurück – `paybar-bubble-in`,
  Größe per `fitPop`, nie aus dem Bild)
  · nach dem Bezahlen unter dem Beleg „Nächstes Mal bezahlst Du?“ / „Mit klicksplit fotografierst Du den Beleg und bekommst
  alles zurück.“ / „So geht's“ · WhatsApp-Text endet mit „_mit klicksplit geteilt_“, Beleg-Fuß „mit klicksplit geteilt · klicksplit.de“
  · ohne Zahlungsdaten: „… hat keine Zahlungsdaten hinterlegt. Gib den Betrag direkt, z.B. bar – und markiere ihn dann als
  bezahlt.“ + „Als bezahlt markieren“; beim Rechnungssteller steht der Anteil jedes Freundes immer rechts in der Freundesliste, daneben
  immer „erhalten“ (sobald er etwas zu zahlen hat, nicht erst nach „Bezahlen“)
- Supermarkt „Alles aufteilen“: „Wie viele teilen sich den Einkauf?“, „/ N“-Stepper, „Abgerechnet werden“; auf der
  Rechnung oben „Vielleicht nicht für alle?“
- „Ausgabe zuweisen“ (bis 16.10.2026 „Ausgabe eingeben“; Startseite, Karte wie die anderen direkt unter „QR-Code scannen“,
  Untertitel „Ohne Beleg – z.B. Taxi oder Kiosk, auch direkt an Freunde“, `src/pages/Expense.tsx`, `#/ausgabe`): Betrag,
  „Wofür?“ mit Schnellauswahl, „Wann?“, „Direkt zuordnen“ (runde Knöpfe der Kontakte, „Du bist auch dabei“, „Andy zahlt
  5,00 €“) bzw. „Wie viele teilen sich das?“ / „inklusive Dir“, „Rechnung erstellen“; ergibt **immer eine Rechnung mit
  Gleichverteilung** (ohne „Du bist auch dabei“ mit `ownerExcluded`: „… – Du bist nicht dabei“)
- „Erinnern“ (Knopf heißt immer nur so): Push-Mitteilung „Niklas erinnert Dich“, wenn der Freund Benachrichtigungen
  hat (bevorzugt), sonst bzw. innerhalb von 12 h danach WhatsApp; auch bei Freunden ohne Häkchen („Bitte hake in … ab,
  was Du hattest.“) und im Dashboard („Carl hat noch nicht bezahlt?“). Status „per Mitteilung erinnert vor …“.
  Regeln in `BillCore.remind`/`remindPerson` (`REMIND_COOLDOWN_MS`), Knopf `RemindButton`.
- Code-Mail: Kassenbon mit Zacken (fährt in Apple Mail herein), „Hi Name,“ bzw. „Hi,“ / „hier ist Dein Code für
  klicksplit:“, Code ohne Leerzeichen in Mint-Box; Schluss nach 3 Leerzeilen: „klicksplit •“, darunter groß „Einer
  zahlt.“ / „Alle splitten.“ (noch auf dem Bon, „Alle splitten.“ mint, kein dunkler Kasten). Willkommensmail „Willkommen bei klicksplit!“ nach Kontoanlage, mit Bon „So einfach geht's“ (Animation Durchstreichen/„/2“, Zeilen antippbar in Apple Mail; `demoReceipt` in `server/mail.ts`).
- Konto: „Deine E-Mail-Adresse“, „Code senden“, „Code eingeben“, „Überspringen“, Startseite „Schon ein Konto?
  Anmelden“ – ebenso unter jedem „Wie heißt Du?“ (Beitreten und Profil-Assistent), solange nicht angemeldet; danach
  ohne weitere Frage weiter (`signedIn` in `BillPage`), Profil ganz oben „Konto“: „● Angemeldet“ + Adresse bzw. „Nicht angemeldet“ + „Anmelden oder Konto
  anlegen“, „Abmelden“, „Konto löschen“; grüner Haken am Profil-Knopf der Startseite; einmalige Fenster „Warst Du schon mal bei
  klicksplit?“ („Anmelden“ / „Ich bin neu hier“, leerer Speicher auf der Startseite) und „Sichere Deine Rechnungen“
  („Konto anlegen“ / „Später“, zweite Nutzung ohne Konto mit Rechnungen)

## Offene Ideen / Backlog (noch nicht beauftragt)

- Railway vor Ende des Testzugangs (etwa 9.11.2026) auf Hobby umstellen (Aufgabe des Auftraggebers).

- Railway-Variablen `OPERATOR_NAME`, `OPERATOR_ADDRESS`, `OPERATOR_EMAIL` setzen (Impressum/Datenschutz zeigen sonst
  „Angaben zum Betreiber folgen.“).

- Erledigt 17.10.2026: `klicksplit.de` ohne www leitet über Cloudflare auf www um. Umzug auf www.klicksplit.de,
  Umbenennung in „klicksplit“ und Logo B sind erledigt (11.10.2026).

Erledigt am 11.10.2026: optionales E-Mail-Konto. Erledigt am 11.10.2026 (Bedienbarkeits-Analyse vom 10.10.2026 komplett umgesetzt):
Safari- und App-Identität zusammenführen (`?von=`-Code, `mergeParticipant`), „Hast Du … gesendet?“ nach Rückkehr von
PayPal, „Erinnern“ per WhatsApp, erst fotografieren – Profil-Assistent (`ProfileWizard`) während der Erkennung bzw.
für Gäste nach dem Bezahlen, Gesten-Legende („?“, `GestureHelp`), Pfeile im Gesamtausgleich, Du/Dein/Dir überall groß,
`prefers-reduced-motion` für alles (`src/lib/motion.ts`, `27-motion.css`), stärkerer Kontrast blasser Hinweise,
Betrag bei „Du schuldest“, Push und Listen führen direkt an die Stelle (`?an=`, `?zurueck=`, `?zahlung=`),
Supermarkt „Alles aufteilen“ mit „/ N“-Stepper und „Vielleicht nicht für alle?“.

Erledigt am 10.10.2026: einheitlicher Ausgleich über bestätigte Zahlungen, Gerät übertragen/Wiederherstellungs-Code,
Web-Push, zweizeiliger PayPal-Hinweis im Ausgleichs-Fenster.
