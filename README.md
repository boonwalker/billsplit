# billsplit

**Einer zahlt. Alle splitten.**

billsplit teilt Restaurantrechnungen unter Freunden auf: Wer bezahlt hat, fotografiert den Beleg und zeigt einen
QR-Code. Die Freunde scannen ihn, haken auf der digitalen Rechnung ab, was sie hatten, und zahlen ihren Anteil per
PayPal. Alle sehen live, wer welche Position übernommen hat.

## Ablauf

**Rechnungssteller**

1. Einmalig im Profil Namen, PayPal-E-Mail-Adresse und (empfohlen) PayPal.Me-Namen hinterlegen.
2. „Rechnung fotografieren“: Der Beleg wird analysiert. Alle Positionen werden digitalisiert, auch solche mit
   mehrfacher Anzahl („3x Bier“).
3. Das Ergebnis ist ein großer QR-Code. Er enthält den Link zur Rechnung und deine PayPal-Daten.
4. Weiter unten liegt die digitale Rechnung im Beleg-Design. Dort hakst du deine eigenen Positionen ab.
5. Unter der Rechnung siehst du deine Freunde, sobald sie beigetreten sind. Hat jemand auf „Bezahlen“ getippt,
   erscheint der Betrag hinter seinem Namen. Diese Angaben gleichst du mit den PayPal-Eingängen ab und hakst
   „erhalten“ an. Unten steht immer, wie viel dir noch fehlt.

**Freunde**

1. QR-Code mit billsplit („QR-Code scannen“) oder mit der Handykamera scannen und den eigenen Namen eingeben. Der
   Übergang in die Rechnung wird mit einem kurzen Vibrationsmuster bestätigt (Android über die Vibration-API,
   iPhone ab iOS 18 über die Taptic Engine des Schalter-Elements). „Anteil begleichen“ gibt beim Drücken und Loslassen je einen
   kurzen Tick wie ein Mausklick; der Bezahler spürt einen Stoß, sobald jemand Neues der Rechnung beitritt.
   Damit tauchen sie beim Rechnungssteller als Schuldner auf.
2. Eigene Positionen abhaken. Bei mehreren Stück wählt man die Anzahl. Wer eine Position übernimmt, steht mit
   Namen in Grün darunter. Ist eine Position vollständig vergeben, wird sie durchgestrichen. Das passiert live
   bei allen.
3. Unten steht der eigene Anteil. „Anteil begleichen“ öffnet die PayPal-App bzw. -Website mit Empfänger und
   Betrag. Nach dem Login muss man nur noch bestätigen.

Freunde sehen die Schuldnerliste des Rechnungsstellers nicht. Wer was abgehakt hat, sehen sie dagegen schon.

### Wie der PayPal-Link entsteht

Wenn ein Freund scannt, steht sein Betrag noch nicht fest. Erst wenn er auf „Bezahlen“ tippt, baut billsplit
seinen individuellen Link: den Empfänger aus der Rechnung plus den gerade berechneten Anteil, z. B.
`https://www.paypal.com/paypalme/niklas/18.50EUR`.

Die PayPal-App übernimmt aus diesem Link in der Praxis oft nur den Empfänger. Deshalb kopiert der erste Tipp auf
„Anteil begleichen“ den Betrag in die Zwischenablage, der zweite („Mit PayPal bezahlen · Betrag“) öffnet PayPal. Dort muss
der Betrag nur noch eingefügt werden. Zwei Tipps, weil iOS das Kopieren verwirft, wenn derselbe Tipp die App verlässt.

> **Wichtig: PayPal.Me vs. E-Mail.** PayPal bietet nur über **PayPal.Me** einen dokumentierten Link, der Empfänger
> *und* Betrag vorbelegt. Ist im Profil nur eine E-Mail-Adresse hinterlegt, öffnet billsplit die PayPal-Seite
> „Geld senden“ und kopiert die Adresse. Den Betrag muss der Freund dann selbst eintragen. Deshalb fragt das Profil
> beides ab.

### Überweisung und Wero

Neben PayPal kann der Bezahler im Profil eine **IBAN** (jede Bank, auch Trade Republic, N26 oder Revolut; die
Prüfziffer wird kontrolliert) und eine **Wero**-Handynummer bzw. -E-Mail hinterlegen. Banking-Apps lassen sich nicht
mit vorausgefüllter Überweisung öffnen, deshalb zeigt billsplit Empfänger, IBAN, Betrag und Verwendungszweck
(„billsplit · Titel · Name“) bzw. die Wero-Nummer mit je einem Kopier-Knopf. Hat der Bezahler PayPal hinterlegt,
bleibt „Anteil begleichen“ der PayPal-Weg und darunter steht „Lieber per Überweisung oder Wero“; ohne PayPal öffnet
„Anteil begleichen“ direkt die Überweisungsdaten. Danach geht es wie gewohnt mit „Als bezahlt markieren“ weiter.

### Trinkgeld

Steht ein Trinkgeld auf dem Beleg, wird es automatisch übernommen. Sonst fragt billsplit vor dem Erstellen des
QR-Codes nach: absolut (der Trinkgeldbetrag selbst), in Prozent oder als Endbetrag, also was Du insgesamt bezahlt
hast. Beim Endbetrag ist das Trinkgeld die Differenz zum Rechnungsbetrag.

Das Trinkgeld wird gleichmäßig pro Person verteilt. Gezählt wird automatisch, wer der Rechnung per QR-Code
beigetreten ist, plus der Rechnungssteller. Optional gibt der Rechnungssteller eine erwartete Personenzahl an,
vorab im Trinkgeld-Schritt oder später direkt unter der Rechnung. Sie gilt, solange noch nicht alle beigetreten sind,
etwa wenn jemand erst am nächsten Tag scannt. Treten mehr Personen bei als erwartet, zählen alle.

### Liefer- und Servicegebühren

Liefergebühren, Servicegebühren, Mindestbestellwert-Zuschläge und ähnliche Gebühren erkennt billsplit getrennt
von den Positionen. Sie werden wie das Trinkgeld gleichmäßig pro Person verteilt. Erkennt billsplit eine Liefer-
oder Abholbestellung (Gebühren auf dem Beleg oder typische Liefer-App), fragt es vor dem QR-Code:
„Wie viele haben mitbestellt?“. Gebühren lassen sich im Editor ergänzen oder korrigieren.

### Gleichverteilung

Für Rechnungen, bei denen niemand einzelne Positionen zuordnen will (z. B. ein gemeinsamer Supermarkt-Einkauf),
schaltet der Rechnungssteller oberhalb der Rechnung die **Gleichverteilung** ein. Dann kann niemand abhaken; vor
jedem Preis steht klein der Anteil pro Person, und unter der Summe wird sie durch die Personenzahl geteilt. Gezählt
wird wie beim Trinkgeld: alle Beigetretenen plus Rechnungssteller, oder die erwartete Personenzahl, solange noch
jemand fehlt.

Vergessene Artikel, die nicht für alle waren, kann der Rechnungssteller in der Gleichverteilung noch **antippen**:
Die Zeile wird eingedrückt, ploppt beim Loslassen wieder auf und wird durchgestrichen. Gestrichene Artikel bleiben
auf dem Beleg sichtbar, zählen aber nicht mehr zur Summe; nochmal antippen nimmt sie wieder auf. Bei mehreren Stück
streicht jedes Antippen eins mehr („2x“ → „1x“), nach dem letzten kommen alle zurück. Genauso lassen sich Gebühren
(z. B. „Kl. Papiertasche“) und das Trinkgeld streichen; Zwischensumme und Summe nicht. Ein Wisch seitlich über eine
Zeile streicht sie ebenso. Beim ersten Öffnen einer solchen Rechnung läuft dieselbe Anfangsanimation wie bei
„Manches nicht“ (siehe unten), bis der Bezahler eine Zeile berührt.

### Nur einen Teil berechnen

Hält der Bezahler eine Position auf der Rechnung gedrückt, öffnet sich ein Blatt mit großem Bleistift-„/“ und Pfeilen
(/1 bis /5): Vom Liter Milch geht dann z. B. nur die Hälfte in die Aufteilung, die andere Hälfte trägt er selbst. Auf
dem Beleg steht „/2“ hinter dem Namen und der Belegpreis klein durchgestrichen über dem berechneten Teil; /1 stellt die
Position wieder her, ebenso ein Tipp direkt auf das „/2“. Kurzes Antippen anderswo auf der Zeile streicht wie gewohnt.
Das gibt es nur mit Gleichverteilung – bei „Jeder selber abhaken“ hakt jeder ab, was er hatte.

### Supermarkt-Einkäufe

Die Erkennung merkt anhand des Geschäftsnamens und der Produkte, ob es ein Supermarkt- oder Drogerie-Einkauf ist.
Dann fragt billsplit vor dem QR-Code, ob etwas nicht oder nur teilweise abgerechnet werden soll: „Alles aufteilen“,
„Manches nicht“ oder „Jeder selber abhaken“ (führt direkt zur fertigen Rechnung ohne Gleichverteilung).
Komplett weggestrichene Positionen stehen auf der fertigen Rechnung ganz unten. Bei „Manches nicht“ füllt der Beleg im Stil der digitalen Rechnung (mit Belegkopf) den
Bildschirm bis zum oberen Rand, ohne App-Kopfzeile; unten bleibt nur eine schmale Leiste mit Personenzahl, Summe, Zurück und „Rechnung
erstellen“. Eine Zeile mit
dem Finger **durchstreichen oder antippen** nimmt den Artikel aus der Rechnung, nochmal holt ihn zurück (bei
mehreren Stück streicht jedes Antippen eins mehr, z. B. „3x“ → „2x“, nach dem letzten kommen alle zurück; Gebühren
wie eine Papiertasche stehen nach einer Zwischensumme und lassen sich ebenso antippen); hoch und
runter wischen scrollt. Alles Übrige wird durch die unten eingestellte Personenzahl geteilt. Die Fingerstriche sind
sofort zu sehen und verblassen in den Durchstreich-Strich, angetippte Zeilen werden kurz „eingedrückt“. Artikel, die
wahrscheinlich keine Gemeinschaftsausgabe sind (Drogerie, Haushalt, Vorräte wie Milch oder Gewürze – von der KI beim
Lesen markiert, ergänzt um eine Stichwortliste), stehen oben. **Gedrückt halten** öffnet auch hier das „/“-Blatt (nur einen Teil in Rechnung stellen, siehe oben); ein Tipp direkt
auf das „/2“ hebt es wieder auf, statt die Zeile zu streichen. Eine
Anfangsanimation zeigt das im Loop, bis der Beleg berührt wird: eine Zeile wird mit dem Finger durchgestrichen, eine
zweite angetippt und dann durchgestrichen, eine dritte gedrückt gehalten (ein Ring füllt sich um den Finger, „/2“
erscheint, eine Comic-Sprechblase erklärt es). Die Animation nutzt nur Positionen mit einem Stück.

### Dashboard

Unter „Deine Rechnungen“ auf der Startseite führt „Dashboard · Deine Bilanz“ zu einer Übersicht über alle Rechnungen
auf dem Gerät. Ein Ringdiagramm zeigt, wie viel Du insgesamt leihst (grün: was Freunde Dir aus Deinen Rechnungen noch
schulden, bis Du es als erhalten markierst) und wie viel Du schuldest (orange: Dein Anteil an Rechnungen anderer, bis Du
ihn als bezahlt markierst); in der Mitte steht die Bilanz, ein Tipp auf einen Ring-Teil oder die Legende zeigt dessen
Betrag und Anteil. Darunter stehen die Einzelbilanzen mit jeder Person als kleine Ringe in
Kacheln (über alle Rechnungen zusammengefasst – zugeordnet über die Gerätekennung der Person, nicht über den Namen, sodass zwei Annas nie verrechnet werden; grün, was die Person Dir schuldet, orange, was Du ihr schuldest). Grün und Orange sind für Hell- und Dunkelmodus auf Farbenblindheit geprüft; bei mehreren Währungen
gibt es je Währung eine eigene Übersicht.

**Ausgleichen mit einer Person:** Ein Tipp auf die Kachel einer Person mit offenen Beträgen zeigt alle offenen
Beträge Rechnung für Rechnung und den Saldo (z. B. 36,90 € geschuldet − 12,84 € geliehen = 24,06 €). Alles wird als
**eine Ausgleichszahlung** eingetragen – derselbe Mechanismus wie beim Gesamtausgleich (siehe unten), also nie halb:

- **Du schuldest unterm Strich etwas:** „Betrag an … zahlen“ öffnet PayPal mit genau diesem Betrag (vorher in die
  Zwischenablage kopiert) bzw. die Überweisungs-/Wero-Daten. Nach „✓ Gesendet – … bestätigen lassen“ wartet die
  Zahlung auf die Person; bis dahin gelten die Anteile als bezahlt, nach ihrer Bestätigung sind sie in allen
  Rechnungen beglichen.
- **Die Person schuldet Dir unterm Strich etwas:** Sobald das Geld da ist, trägst Du es mit „✓ Betrag erhalten –
  eintragen“ ein. Das gilt sofort als bestätigt (Du bist ja der Empfänger); die Person sieht es im Dashboard.
- **Es gleicht sich genau aus:** „Gegenseitig verrechnen“ schlägt die Verrechnung vor, die Person bestätigt sie im
  Dashboard („✓ Einverstanden“).

Vor dem Eintragen werden die offenen Beträge neu geladen; hat sich einer geändert, wird nichts eingetragen und die
neue Aufstellung gezeigt. In den Rechnungen steht bei den betroffenen Anteilen ein Hinweis (z. B. „24,06 € per
Ausgleich Niklas → Anna ✓“ oder „25,34 € gegenseitig verrechnet (Niklas ↔ Ben) ✓“). Eigene Ausgleichszahlungen
bleiben nach der Bestätigung noch drei Tage im Dashboard sichtbar („✓ Anna hat 24,06 € erhalten“).

### Kassenbon-Vorschau

Beim ersten Öffnen einer neu erstellten Rechnung schiebt sich – während der Rechnungssteller oben bei QR-Code und
WhatsApp-Button ist – der obere Rand des Kassenbons (Zacken, Titel, „Deine interaktive Rechnung ist fertig ↓“ – für
den Rechnungssteller ist jede Rechnung interaktiv) hinter der unteren Leiste hoch ins Bild und zupft alle paar Sekunden kurz nach
oben. Der Schnipsel hat genau Breite, Schrift und Papier des echten Bons: Beim ersten Runterscrollen bleibt er stehen,
bis der echte Bon ihn erreicht, und geht dort in ihn über. Danach (und bei jedem weiteren Öffnen dieser Rechnung)
erscheint er nicht mehr. Ein Tipp auf den Schnipsel scrollt zum Bon.

### Live-Anzeige und Echtzeit

Solange die App im Vordergrund ist, hält sie eine Verbindung zum Server offen. Darüber zählt das Gerät als online:
Oben rechts in jeder Rechnung steht „● LIVE · 👤 3“ – so viele Personen dieser Rechnung haben die App gerade offen,
egal in welcher Ansicht. Geht die App in den Hintergrund, zählt die Person nach etwa 12 Sekunden nicht mehr mit.
Über dieselbe Verbindung meldet der Server Änderungen an allen Rechnungen der Person: Das Dashboard rechnet dann
sofort neu (streicht der Rechnungssteller z. B. die Creme Brulée, sinkt der geschuldete Betrag beim Schuldner live).

### Gesamtausgleich mit möglichst wenigen Zahlungen

Oben im Dashboard (unter dem Ring) steht ein Zahlungsplan: „Alles ausgleichen mit einer Zahlung statt 3“. Er wird aus
allen offenen Anteilen der Rechnungen berechnet, an denen Du teilnimmst (nur gemeinsame Rechnungen – andere bleiben
privat):

1. Mit jeder Person werden Schulden in beide Richtungen gegeneinander verrechnet.
2. Was Du jemandem schuldest, wird entlang dessen eigener offener Schulden weitergereicht: Schuldest Du Andy 5 € und
   Andy schuldet Katia 5 €, zahlst Du die 5 € direkt an Katia – eine Zahlung begleicht beides. Weitergereicht wird nur,
   wenn dadurch kein zusätzlicher Empfänger entsteht.
3. Alles an dieselbe Person wird zu einer Zahlung gebündelt.

Jede geplante Zahlung listet genau, welche Anteile in welchen Rechnungen sie begleicht. Der Server prüft beim
Eintragen, dass sie für alle Beteiligten aufgeht (niemand gewinnt oder verliert etwas) und nur offene Anteile aus
Rechnungen des Zahlenden betrifft. Bezahlt wird per PayPal (Betrag vorher in der Zwischenablage), Überweisung oder
Wero; nach „Gesendet“ wartet die Zahlung auf den Empfänger. Bis dahin gelten die Anteile als bezahlt (niemand zahlt
doppelt), und alle Beteiligten sehen in ihren Rechnungen einen Hinweis („5,00 € per Ausgleich Niklas → Katia“).
Der Empfänger bestätigt den Eingang im Dashboard (auf der Startseite steht dann „1 Eingang bestätigen“) – erst dann
ist alles in allen Rechnungen beglichen; „Nicht erhalten“ gibt die Anteile wieder frei, und solange sie wartet, kann
der Zahlende die Zahlung zurückziehen. Wer nur mittelbar beteiligt ist (Andy), sieht im Dashboard, was für ihn
beglichen wurde. Der Empfänger sieht nur Anteile aus Rechnungen, an denen er selbst teilnimmt.

### Benachrichtigungen

billsplit kann per Push Bescheid sagen, wenn etwas auf einen wartet – auch wenn die App zu ist:

- „Niklas hat Dir 8,00 € gesendet“ (bitte Eingang bestätigen) bzw. „Niklas möchte gegenseitig verrechnen“
- „Katia hat 8,00 € erhalten ✓“ / „… nicht erhalten“ / „Katia hat Deinen Ausgleich eingetragen“
- „Anna hat bezahlt“ (in Deiner Rechnung als bezahlt markiert – bitte Eingang prüfen)
- „Niklas hat die Zahlung zurückgezogen“

Ein Tipp auf die Benachrichtigung öffnet das Dashboard bzw. die Rechnung. Einschalten lässt es sich im Dashboard
(„Benachrichtigen, wenn Geld eingeht?“, einmalig) und jederzeit im Profil. Auf dem iPhone geht das nur in der App vom
Home-Bildschirm (iOS 16.4 oder neuer); in Safari steht dort ein Hinweis. Technisch: Web Push mit einem Service Worker
(`public/sw.js`, er speichert nichts zwischen) und VAPID-Schlüsseln, die der Server beim ersten Start erzeugt und
neben den Rechnungen ablegt (`vapid.json`, Abos in `push.json`); gesendet wird nur an die Push-Dienste von Apple,
Google, Mozilla und Microsoft.

### Gerät wechseln und sichern

Rechnungen, Bilanz und Ausgleichszahlungen hängen an der Gerätekennung (einem geheimen Schlüssel im Browser-Speicher).
Damit sie bei einem neuen Handy oder gelöschtem Browser-Speicher nicht verloren gehen, gibt es im Profil unter
„Gerät wechseln & sichern“:

- **Auf neues Gerät übertragen:** zeigt einen QR-Code, der 10 Minuten und nur einmal gilt. Auf dem neuen Gerät in
  billsplit „QR-Code scannen“ (oder den kopierten Link unter „Oder Link einfügen“ einfügen) und „Übernehmen“
  tippen. Das neue Gerät bekommt Gerätekennung, Profil und alle Rechnungen (die Liste kommt vom Server, ist also
  vollständig); das alte funktioniert weiter. Wird der Link in Safari geöffnet, bietet die Seite „In der App öffnen“
  an, denn Safari und Home-Bildschirm-App haben getrennte Speicher.
- **Wiederherstellungs-Code anzeigen:** die Gerätekennung selbst, zum Kopieren in einen Passwort-Manager. Mit
  „Wiederherstellungs-Code eingeben“ holt man die Rechnungen auf jedes Gerät zurück, auch wenn das alte weg ist.
  Wer den Code hat, kann in Deinem Namen abhaken und Zahlungen bestätigen – deshalb steht ein Hinweis dabei.

Rechnungen, die vorher auf dem neuen Gerät lagen, werden dabei ersetzt (die Seite sagt das vorher). In der Demo gibt
es die Übertragung nicht.

### Originalbeleg

Das Foto bzw. der Screenshot, aus dem die Rechnung erkannt wurde, wird mit der Rechnung gespeichert. Ganz unten
auf der digitalen Rechnung führt „Zum Originalbeleg“ dorthin – für alle, die an der Rechnung teilnehmen.

### Links auf dem iPhone

Auf dem iPhone öffnen geteilte Links immer Safari, nie die Web-App auf dem Home-Bildschirm, und beide haben getrennte
Speicher. Wer eine Rechnung in Safari öffnet, wird deshalb nicht automatisch beigetreten, sondern gefragt; darunter
steht „billsplit auf dem Home-Bildschirm? In der App öffnen“. Das kopiert den Link und vermerkt die Weiterleitung für
ein paar Minuten auf dem Server (zur Netzwerkadresse des Handys, nicht zum Link). Nur dann zeigt die App beim Öffnen
„Aus Safari weitergeleitet – Kopierten Link öffnen“; iOS fragt einmal mit „Einfügen“ nach, dann ist man in der
Rechnung. Ist iCloud Private Relay aktiv, haben Safari und App verschiedene Adressen und der Hinweis erscheint nicht.

Weil Safari und App getrennte Speicher haben, wären es für billsplit zwei verschiedene Personen: Wer in Safari
beigetreten ist und abgehakt oder bezahlt hat, fände das in der App nicht wieder. Deshalb nimmt „In der App öffnen“
die Safari-Identität per Einmal-Code (10 Minuten gültig) im kopierten Link mit. Beim Öffnen in der App übernimmt
billsplit alles, was in Safari entstanden ist – beigetretene Rechnungen, Häkchen, Zahlungen und Ausgleichszahlungen,
bei derselben Rechnung zusammengeführt – samt Namen, falls die App noch keinen hat.
Auf Android landen Links dank `handle_links`/`launch_handler` im Manifest bevorzugt direkt in der installierten App.

### Geteilte Positionen

Hakt mehr als eine Person dieselbe Position ab (z. B. eine Vorspeisenplatte), wird sie automatisch anteilig
geteilt. Insgesamt wird sie nie mehr als einmal berechnet.

Bei Positionen mit mehreren Stück (z. B. 3x Bier) kann jeder höchstens so viele Stück übernehmen, wie noch frei
sind. Hat Anna schon 1 von 3 abgehakt, kann Ben maximal die restlichen 2 nehmen.

Einzelne Stücke lassen sich gezielt teilen: Ein Tipp auf einen Namen unter der Position (z. B. „Ben ×1“) teilt
eines von Bens Stücken mit dir – Ben und du zahlen dann je die Hälfte davon, alle anderen Stücke bleiben
unverändert. Ein zweiter Tipp hebt das Teilen wieder auf.

Wer zuerst abhakt, muss nicht warten: Ein Tipp auf den eigenen Eintrag („Du ×1“) gibt das Stück zum Teilen frei.
Man zahlt sofort nur die Hälfte, die andere Hälfte bleibt offen. Die anderen sehen den Hinweis und übernehmen
sie mit einem Tipp auf den Namen.

### Erklär-Animation

Beim ersten Öffnen einer Rechnung (ohne Gleichverteilung) führt eine kurze Animation auf den ersten Zeilen vor, wie
man abhakt („Antippen = abhaken“), ein Stück mit jemandem teilt („Namen antippen = mit Anna teilen“, mit dem Namen einer Person aus der Rechnung) und die Hälfte des
eigenen Stücks zum Teilen anbietet („Eigenen Namen antippen = Du willst mit jemandem teilen“). Sie läuft zweimal, einmal pro
Rechnung und Gerät, endet beim ersten eigenen Antippen und verändert nichts an der Rechnung.

## Technik

| Teil | Umsetzung |
| --- | --- |
| App | React + TypeScript (Vite), installierbar als PWA, mobil optimiert, Hell/Dunkel-Modus |
| Belegerkennung | Claude (Vision + Structured Outputs) auf dem Server. Fallback: Tesseract.js lokal im Browser |
| Live-Sync | Node-Server mit Server-Sent Events. Jede Änderung wird sofort an alle Teilnehmer gepusht |
| Identität | Jedes Gerät hat einen zufälligen geheimen Schlüssel. Andere sehen nur dessen Hash als Teilnehmer-ID |
| Daten | SQLite-Datenbank `billsplit.db` (eingebautes `node:sqlite`, nur geänderte Rechnungen werden geschrieben), Belegfotos in `receipts/`, tägliche Sicherung in `backups/` (14 Tage). Rechnungen werden nach 60 Tagen gelöscht |
| QR-Code | `qrcode`, Scanner in der App mit `jsQR` |
| Schriften | Space Grotesk & JetBrains Mono, selbst gehostet (keine Google-Fonts-Anfragen) |

Nach erfolgreicher KI-Erkennung (Summe passt zum Beleg) geht es direkt zum QR-Code. Bei unsicherer Erkennung
erscheint erst der Editor. Positionen lassen sich jederzeit über „Positionen bearbeiten“ korrigieren. Bereits
abgehakte Positionen bleiben dabei erhalten.

## Entwicklung

```bash
npm install
cp .env.example .env      # optional: ANTHROPIC_API_KEY für die KI-Belegerkennung
npm run dev               # Vite (http://localhost:5173) + API-Server (Port 8787)
npm test                  # Unit- und API-Tests
npm run test:e2e          # Klick-Tests (Playwright/Chromium), vorher `npm run build`
npm run build && npm start  # Produktion: ein Node-Prozess liefert App + API aus
```

Ohne `ANTHROPIC_API_KEY` läuft die Belegerkennung komplett im Browser (Tesseract.js). Die dafür nötigen Dateien
liegen nach `npm run dev`/`npm run build` unter `public/ocr` und werden selbst ausgeliefert.

Für die Kamera (Foto und QR-Scanner) muss die App über **HTTPS** laufen (oder `localhost`).

### Tests und CI

- `npm test`: Unit- und API-Tests (vitest, `test/`).
- `npm run test:e2e`: feste Klick-Tests in einem Handy-großen Chromium (`e2e/specs/*.e2e.ts`, Playwright) gegen den
  gebauten Server mit leerem Datenordner: Beleg fotografieren (Erkennung simuliert) mit Trinkgeld; Rechnung beitreten,
  abhaken, per PayPal zahlen, „erhalten“; Mehrfach-Positionen; Positionen bearbeiten; Gesamtausgleich mit Bestätigung;
  Ausgleich mit einer Person; Gerät wechseln; Wiederherstellungs-Code; Safari → App mit Übernahme.
  Weitere Prüfskripte für einzelne Funktionen liegen in `e2e/*.mjs` (siehe `e2e/README.md`).
- **GitHub Actions** (`.github/workflows/ci.yml`) führt bei jedem Push auf `main` Typecheck, Tests, Build und
  Klick-Tests aus. Damit Railway nur grüne Stände ausrollt: im Railway-Service unter **Settings → Source** „Wait
  for CI“ einschalten.

### Live stellen (Railway)

Das Repo enthält eine `railway.json` mit Build- und Startbefehl und Health-Check.

1. Auf [railway.com](https://railway.com) ein Konto anlegen (Free-Tarif, keine Kreditkarte nötig) und GitHub
   verbinden.
2. **New Project → Deploy from GitHub repo** wählen und `billsplit` auswählen.
3. Am Service ein **Volume** anlegen (Rechtsklick auf den Service bzw. „+ New → Volume“), z. B. mit Mount-Pfad
   `/data`. billsplit erkennt das Volume automatisch über `RAILWAY_VOLUME_MOUNT_PATH`.
4. Unter **Settings → Networking → Generate Domain** eine öffentliche Adresse erzeugen.
5. Optional: Unter **Variables** `ANTHROPIC_API_KEY` setzen (KI-Belegerkennung).
6. Optional, aber empfohlen im Free-Tarif: Unter **Settings** „Serverless“ (App Sleeping) einschalten. Der
   Server schläft dann nach etwa 10 Minuten ohne aktive Nutzer und spart Guthaben. Die Rechnungen bleiben auf
   dem Volume erhalten. Beim ersten Aufruf danach dauert es einen Moment.

Kosten: Nach dem Testmonat enthält der Free-Tarif 1 $ Guthaben pro Monat. Abgerechnet wird vor allem der
Arbeitsspeicher. Der Server läuft deshalb als einzelne gebündelte Datei (`node dist-server/index.js`, im Test
ca. 70 MB). Ist das Guthaben aufgebraucht, stoppt Railway den Dienst bis zum nächsten Monat. Die Daten auf dem
Volume bleiben erhalten. Den Verbrauch zeigt Railway unter „Usage“.

Hinweise:
- Es darf nur **eine** Instanz laufen (`railway.json` legt das fest): Live-Updates, Online-Zählung und die
  Rechnungen im Arbeitsspeicher gehören zu diesem einen Server.
- Missbrauchsschutz: Belegfotos sind pro Gerät/IP und Stunde (`RECEIPT_LIMIT_PER_HOUR`) und insgesamt pro Tag
  (`RECEIPT_LIMIT_PER_DAY`) begrenzt. Ist das Limit erreicht, liest das Handy den Beleg selbst. Neue Rechnungen
  sind pro Gerät/IP und Stunde begrenzt (`BILL_LIMIT_PER_HOUR`).

### Daten und Backups

Alles liegt im Datenordner (auf Railway das Volume):

| Datei | Inhalt |
| --- | --- |
| `billsplit.db` | Rechnungen und Ausgleichszahlungen (SQLite). Eine ältere `bills.json` wird beim ersten Start übernommen und als `bills.json.imported` aufbewahrt. Hat die Node-Version kein SQLite, bleibt es bei `bills.json` |
| `backups/billsplit-JJJJ-MM-TT.db` | eine Sicherung pro Tag (beim Start und alle 6 Stunden geprüft), die letzten 14 Tage |
| `receipts/` | Belegfotos (nicht in den Backups) |
| `vapid.json`, `push.json` | Push-Schlüssel und -Abos |

Zurückspielen: Dienst stoppen, die gewünschte Sicherung als `billsplit.db` in den Datenordner kopieren (vorhandene
`billsplit.db-wal`/`-shm` löschen), Dienst starten. Eine Kopie zum Herunterladen gibt es über die Admin-Seite (siehe
„Monitoring“).

### Monitoring

Setzt man auf Railway unter **Variables** `ADMIN_TOKEN` (ein langes Zufallswort, mindestens 12 Zeichen), gibt es die
Betriebsseite `https://<adresse>/api/admin?token=<ADMIN_TOKEN>` (ohne gültiges Token: „Not found“):

- **pro Tag:** Belegfotos, KI-Aufrufe und -Fehler, Tokens und geschätzte Kosten (Listenpreise in
  `server/monitor.ts`), Server- und App-Fehler; oben die Summen des laufenden Monats
- **letzte Fehler:** Serverfehler (mit Stacktrace), fehlgeschlagene Belegerkennungen und Abstürze in der App auf den
  Handys der Nutzer (die App meldet unbehandelte Fehler selbst; ein abgestürzter Bildschirm zeigt „Da ist etwas
  schiefgelaufen“ mit „Neu laden“ statt einer weißen Seite)
- **„Datenbank herunterladen“:** eine aktuelle Kopie aller Rechnungen als zusätzliches Backup außerhalb von Railway

Die Zahlen liegen in `monitor.json` im Datenordner (60 Tage, 200 Fehler).

### Demo ohne Server

```bash
npm run build:demo        # schreibt dist-demo/ inkl. dist-demo/artifact.html
```

Die Demo-Variante (`VITE_DEMO=true`, siehe `.env.demo`) braucht keinen Server und ist für die Veröffentlichung als
claude.ai-Artifact gedacht:
- Rechnungen werden im Browser gespeichert (`localStorage`).
- Über „Ansicht als“ wechselt man auf einem Gerät zwischen sich selbst (zahlt) und den Freunden Anna und Ben.
- Die Belegerkennung fragt Claude über die claude.ai-Umgebung, mit dem Konto der Person, die die Seite ansieht.
- Echtzeit-Sync zwischen verschiedenen Geräten gibt es in der Demo nicht. Der QR-Code öffnet auf anderen Handys
  deshalb noch keine Rechnung.

### Konfiguration

| Variable | Bedeutung |
| --- | --- |
| `ANTHROPIC_API_KEY` | aktiviert die KI-Belegerkennung |
| `BILLSPLIT_MODEL` | anderes Claude-Modell (Standard: `claude-opus-5-5`) |
| `PORT` | Port des Servers (Standard 8787) |
| `DATA_DIR` | Ordner für Datenbank, Belegfotos, Backups und Push-Schlüssel (Standard `data`; auf Railway das Volume) |
| `TRUST_PROXY` | `1` hinter einem Reverse-Proxy: Client-Adresse aus `X-Forwarded-For` lesen |
| `RECEIPT_LIMIT_PER_HOUR` | Belegfotos pro Gerät/IP und Stunde (Standard 10) |
| `RECEIPT_LIMIT_PER_DAY` | Belegfotos insgesamt pro Tag (Standard 300) |
| `BILL_LIMIT_PER_HOUR` | Neue Rechnungen pro Gerät/IP und Stunde (Standard 30) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | optional: eigene Schlüssel für Push (sonst einmal erzeugt und in `DATA_DIR/vapid.json` gespeichert) |
| `VAPID_SUBJECT` | optional: Kontakt für die Push-Dienste (Standard `mailto:hallo@billsplit.app`) |
| `ADMIN_TOKEN` | optional: schaltet die Betriebsseite `/api/admin?token=…` frei (Nutzung, Kosten, Fehler, Datenbank-Download) |

## API

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `POST` | `/api/parse-receipt` | Belegfoto → Positionen |
| `POST` | `/api/bills` | Rechnung anlegen (Ersteller wird Rechnungssteller) |
| `GET` | `/api/bills/:id` | Rechnung aus Sicht des Geräts |
| `POST` | `/api/bills/batch` | Mehrere Rechnungen auf einmal (Startseite, Dashboard); `null` für unbekannte |
| `GET` | `/api/bills/:id/events` | Live-Updates (Server-Sent Events) |
| `PUT` | `/api/bills/:id` | Positionen bearbeiten (nur Rechnungssteller) |
| `POST` | `/api/bills/:id/join` | Beitreten (QR-Code gescannt) |
| `PUT` | `/api/bills/:id/claims` | eigene Positionen setzen |
| `POST` | `/api/bills/:id/pay` | Tipp auf „Bezahlen“ inkl. Betrag vermerken |
| `POST` | `/api/bills/:id/paid` | Freund markiert seinen Anteil als bezahlt (oder nimmt es zurück) |
| `PUT` | `/api/bills/:id/receipt-image` | Belegfoto (JPEG) speichern – nur Rechnungssteller |
| `GET` | `/api/bills/:id/receipt-image` | Belegfoto abrufen |
| `POST` | `/api/bills/:id/received` | Zahlungseingang bestätigen (nur Rechnungssteller) |
| `POST`/`GET`/`DELETE` | `/api/handoff` | Weiterleitung Safari → Home-Bildschirm-App vermerken / abfragen / erledigen |
| `GET` | `/api/events` | App-weiter Live-Stream: Änderungen an allen eigenen Rechnungen, Online-Status |
| `GET` | `/api/network` | Offene Anteile aller eigenen Rechnungen (Grundlage für den Zahlungsplan) |
| `GET`/`POST` | `/api/transfers` | Eigene Ausgleichszahlungen abrufen / neue eintragen |
| `POST` | `/api/transfers/:id/(confirm\|reject\|cancel)` | Eingang bestätigen bzw. ablehnen (Empfänger) oder zurückziehen (Zahler) |
| `GET` | `/api/my-bills` | Rechnungen, an denen das Gerät teilnimmt (für die Übertragung auf ein neues Gerät) |
| `POST` | `/api/device-link` | Einmal-Code für die Übertragung auf ein neues Gerät (10 Minuten gültig) |
| `POST` | `/api/device-link/:code` | Code einlösen: Gerätekennung und Profil (nur einmal) |
| `POST` | `/api/merge-device` | App übernimmt mit einem Einmal-Code aus Safari dessen Teilnahmen |
| `GET` | `/api/push/key` | Öffentlicher VAPID-Schlüssel für Push-Benachrichtigungen |
| `POST` | `/api/push/subscribe` / `/api/push/unsubscribe` | Push-Abo des Geräts eintragen / entfernen |

Geräte authentifizieren sich mit dem Header `x-billsplit-key`. Bei den Event-Streams wird er als Query-Parameter `key`
übergeben, weil `EventSource` keine eigenen Header unterstützt.

## Weiterentwickeln

`CLAUDE.md` hält Arbeitsweise, Entscheidungen, feste Formulierungen und Backlog fest, `docs/verlauf-anforderungen.md`
alle bisherigen Wünsche im Wortlaut, `e2e/README.md` die Klick-Tests.

