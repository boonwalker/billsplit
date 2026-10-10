# Klick-Tests (Playwright, Chromium)

Hier liegen die Skripte, mit denen während der Entwicklung jede Änderung in einem echten Browser (iPhone-große
Ansicht, 390 × 844, deutsch) durchgeklickt wurde. Sie geben Beobachtungen auf der Konsole aus und legen Screenshots
ab – sie sind **Werkzeuge zum Nachprüfen**, noch kein automatischer Test-Satz mit Soll/Ist-Vergleich (das steht im
Backlog in `CLAUDE.md`).

## Einrichten

```bash
cd e2e && npm install && cd ..   # nur playwright-core, eigener kleiner Unterordner
npm run build                    # die meisten Skripte starten dist-server/index.js selbst
```

Chromium: In der Claude-Code-Cloud-Umgebung liegt es unter `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(Standard in den Skripten). Woanders den Pfad per `CHROMIUM_PATH=/pfad/zu/chrome` setzen.

## Ausführen

```bash
OUT=/tmp/e2e-out && mkdir -p $OUT/shots
node e2e/triangle.mjs $OUT       # Beispiel: Gesamtausgleich Niklas/Andy/Katia
```

Das erste Argument ist ein Arbeitsordner: Dort landen die Testdaten (`data-*`) und Screenshots (`shots/`).

- **Skripte mit eigenem Server** (die meisten): starten `node dist-server/index.js` aus der Repo-Wurzel mit eigenem
  Port und eigenem `DATA_DIR` und beenden ihn am Ende.
- **Skripte ohne eigenen Server** (`aitip`, `blocked`, `copy`, `copy2`, `demo`, `equal`, `fees`, `flow`, `home`,
  `layout`, `limit`, `markpaid`, `paysync`, `profile`, `screenshot`, `share`, `share2`, `split`, `strike`,
  `tiptotal`, `units`): erwarten einen laufenden Server auf dem im Skript genannten Port, z. B.
  `PORT=8812 DATA_DIR=$OUT/data node dist-server/index.js`. Einige davon (`demo`, `split`, `tiptotal`, …) prüfen die
  Demo-Variante – dafür `npm run build:demo` und `dist-demo/` statisch auf dem Port ausliefern
  (z. B. `cd dist-demo && python3 -m http.server 8790`).

Hängt ein Test oder sieht man doppelte Daten: alte Testserver beenden mit
`ps aux | grep "[d]ist-server/index.js" | awk '{print $2}' | xargs -r kill` (nicht `pkill -f`, das beendet die
eigene Shell).

## Was wo geprüft wird (Auswahl)

| Bereich | Skripte |
| --- | --- |
| Grundablauf Rechnung → Beitreten → Abhaken → Bezahlen | `flow`, `create`, `live`, `paysync`, `markpaid`, `paidlist` |
| Teilen von Stücken, Teilungsangebot | `share`, `share2`, `split`, `offer`, `ownoffer*`, `taken`, `waitnote` |
| Trinkgeld und Gebühren | `tip`, `tiptotal`, `aitip`, `fees`, `feestrike`, `sheetfee` |
| Supermarkt / „Manches nicht“ / Gleichverteilung | `shop*`, `equal`, `toggle`, `strike`, `tapstrike`, `units`, `partial*`, `fullpaper`, `write`, `touch` |
| „/2“-Teiler (gedrückt halten) | `hold*`, `divisor`, `undiv`, `billdiv` |
| Erklär-Animationen und Sprechblasen | `claimdemo`, `ownerdemo`, `billdemo`, `loop`, `tail`, `demo*` |
| PayBar, PayPal, Überweisung/Wero | `bar`, `paybar`, `copy*`, `transfer`, `oneline` |
| Dashboard, Ausgleich, Eingangsbestätigung | `dash`, `settle`, `settled`, `triangle`, `inbox`, `tri-debug` |
| Live-Anzeige, Kassenbon-Vorschau | `live`, `tickserver`, `peek`, `peek2` |
| Safari → Home-Bildschirm-App, WhatsApp | `handoff`, `wa` |
| Scan, Originalbeleg, Profil, Startseite | `scanview`, `screenshot`, `original*`, `origlink`, `profile`, `home`, `icons` |
| Limits, Neuladen nach Deploy | `limit`, `blocked`, `reload` |

Viele Skripte sind für eine bestimmte Änderung entstanden; Texte und Selektoren können inzwischen veraltet sein. Bei
Abweichungen erst prüfen, ob sich die App bewusst geändert hat (README, `docs/verlauf-anforderungen.md`).
