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

1. `npm run typecheck` und `npm test` (aktuell 100 Tests, alle grün).
2. Bei UI-/Ablaufänderungen: `npm run build` und passende Klick-Tests aus `e2e/` laufen lassen, Screenshots ansehen
   (siehe `e2e/README.md`).
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
   - Zuletzt veröffentlicht: `assets/index-DkjmNYv7.js`, `assets/Scan-DyebuKI1.js` (Version 125).

## Betrieb

| Was | Wo |
| --- | --- |
| Live-App | https://billsplit-production-af2e.up.railway.app (Railway, Free-Tarif, ein Service + Volume `/data`) |
| Demo (ohne Server) | https://claude.ai/artifact/UDuSsFPTSGVB8QNeGYoGVZ (Daten im Browser, „Ansicht als“ Anna/Ben) |
| Repo | `boonwalker/billsplit`, Branch `main` |
| Railway-Variablen | `ANTHROPIC_API_KEY` gesetzt; `RECEIPT_LIMIT_PER_DAY=20` als Kostenbremse empfohlen und gesetzt |

`render.yaml` ist ein Überbleibsel (Render war zu teuer) und wird nicht benutzt. Der Auftraggeber nutzt die App vor
allem auf dem **iPhone**, in Safari und als Home-Bildschirm-App – iOS-Eigenheiten haben Vorrang.

## Architektur in Kürze

- **Stack:** React 19 + TypeScript + Vite (PWA), Node-HTTP-Server ohne Framework (`server/app.ts`, Validierung mit
  zod), vitest. Server wird mit esbuild zu `dist-server/index.js` gebündelt (wenig RAM auf Railway).
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
- **Belegerkennung:** `server/parseReceipt.ts` (Claude, Structured Outputs, Summenprüfung mit Wiederholung, Bild
  max. 2000 px Kantenlänge). Fallback: Tesseract.js im Browser. In der Demo über `window.claude` (`claudeRuntime.ts`).
- **Seiten:** `Home`, `Scan`, `Editor` (Prüfen, Trinkgeld, Supermarkt-Frage, „Manches nicht“), `BillPage` (fertige
  Rechnung, QR-Code, Beleg, PayBar/OwnerPanel), `Dashboard`, `Profile`, `OriginalReceipt`.
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
- **Lange Drücken („/2“)** nur für den Rechnungssteller und nicht im Modus „Jeder selber abhaken“; ein präziser Tipp
  auf „/2“ hebt den Teiler auf, statt die Zeile zu streichen.
- **Klick-Tests:** Alte Testserver vom selben Port verfälschen Ergebnisse. Beenden mit
  `ps aux | grep "[d]ist-server/index.js" | awk '{print $2}' | xargs -r kill` – **nicht** `pkill -f …` (beendet die
  eigene Shell). Temporäre vitest-Tests in `test/` anlegen (`vitest --root /` hängt).
- **Diagramm-Farben** (Dashboard) sind auf Farbenblindheit geprüft: hell `--lent #0f7a4d` / `--owed #f76707`,
  dunkel `#22a86a` / `#e8590c`. Nicht ohne erneute Prüfung ändern.

## Feste Formulierungen (vom Auftraggeber so gewünscht)

- „Dir fehlen noch“ (nicht „Fehlt Dir noch“) · „beigetreten“ (nicht „gescannt“)
- Bezahl-Knopf „Anteil begleichen · Betrag“, danach „Mit PayPal bezahlen · Betrag“, darunter „Als bezahlt markieren“
- PayPal-Hinweis zweizeilig: „xx,xx € in die Zwischenablage kopiert –“ / kleiner, einzeilig: „in PayPal ins
  Betragsfeld tippen und „Einfügen“ wählen.“
- „Rechnung erstellen“ (nie „QR-Code erstellen“) · Scan: „billsplit analysiert den Beleg“ · nach „Rechnung erstellen“
  nur drei Punkte + „billsplit generiert die interaktive Rechnung“
- Startseite: „Du hast bezahlt und willst anteilig Geld zurück“, „Für digitale Rechnungen aus App oder Mail“,
  „Anteil“ statt „Teil“
- Rechnungsliste: „Du schuldest“, „als bezahlt markiert“, „Du leihst · Betrag“ (immer der aktuell noch offene),
  „Du leihst · ausgeglichen“ (grün mit Haken)
- Trinkgeld-Reiter: „absolut“, „in Prozent“, „als Endbetrag“ (Endbetrag → Trinkgeld = Differenz)
- Supermarkt-Frage: „Soll etwas nicht oder nur teilweise in Rechnung gestellt werden?“ / kleiner „z.B. Gewürze,
  Duschgel, Pfand?“; Knöpfe „Alles aufteilen“, „Manches nicht“, „Jeder selber abhaken“; Personenzahl „inklusive Dir“
- Sprechblasen: „Antippen = abhaken“, „Namen antippen = mit Anna teilen“, „Eigenen Namen antippen = Du willst mit
  jemandem teilen“, „Gedrückt halten = nur einen Teil in Rechnung stellen“
- Teilen: „Du wartest auf jemanden“ / „wartet auf jemanden“; „geteilt“ erst, wenn wirklich vollständig geteilt
- Kassenbon-Vorschau: „Deine interaktive Rechnung ist fertig ↓“ (für den Rechnungssteller immer „interaktive“; für
  Freunde bei Gleichverteilung „digitale“)
- Dashboard: „Dashboard · Deine Bilanz“, „Du leihst“ (grün) / „Du schuldest“ (orange), „N Eingang bestätigen“

## Offene Ideen / Backlog (noch nicht beauftragt)

Aus der Verbesserungsanalyse vom 10.10.2026, empfohlene Reihenfolge:

1. **CI:** GitHub Action mit `typecheck` + `test` bei jedem Push; Railway erst nach grüner CI deployen lassen.
   Die wichtigsten Klick-Tests aus `e2e/` zu einem festen Test-Satz (z. B. `@playwright/test`) ausbauen.
2. **Datensicherheit:** Backup von `bills.json` bzw. Umstieg auf SQLite auf dem Railway-Volume (aktuell wird die
   ganze JSON-Datei bei jeder Änderung neu geschrieben).
3. **Einheitlicher Ausgleich:** Den Ausgleich mit einer Person (`SettleSheet`, bucht direkt Rechnung für Rechnung,
   ohne Bestätigung, ggf. halb) auf dieselben bestätigten Ausgleichszahlungen umstellen wie den Gesamtausgleich.
4. **Gerät übertragen / Schlüssel sichern** (z. B. per QR-Code) – sonst gehen bei Gerätewechsel oder gelöschtem
   Safari-Speicher alle Rechnungen verloren.
5. **Web-Push** für „Eingang bestätigen“ und neue Zahlungen.
6. Dashboard: ein Server-Endpunkt „meine Bilanz“ statt jede Rechnung einzeln zu laden.
7. Aufräumen: `styles.css` (~4.200 Zeilen), `Editor.tsx`, `BillPage.tsx` aufteilen; `render.yaml` entfernen.
8. Kleinigkeiten: PayPal-Hinweis in `PayButtons.tsx` (Ausgleichs-Fenster) noch einzeilig im alten Wortlaut;
   Großschreibung von „deine/deiner“ uneinheitlich (z. B. „Hake deine Positionen ab“, „in deiner PayPal-App“) – mit
   dem Auftraggeber klären, ob die Regel für „Dir“ auch für Du/Dein gelten soll; README-Abschnitt „Ausgleichen mit
   einer Person“ und API-Tabelle bei Änderungen nachziehen.
