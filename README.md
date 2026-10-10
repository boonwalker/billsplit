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
(z. B. „Kl. Papiertasche“) und das Trinkgeld streichen; Zwischensumme und Summe nicht. Beim ersten Öffnen einer
solchen Rechnung führt eine kurze Animation auf zwei Zeilen vor, wie Antippen durchstreicht.

### Nur einen Teil berechnen

Hält der Bezahler eine Position auf der Rechnung gedrückt, öffnet sich ein Blatt mit großem Bleistift-„/“ und Pfeilen
(/1 bis /5): Vom Liter Milch geht dann z. B. nur die Hälfte in die Aufteilung, die andere Hälfte trägt er selbst. Auf
dem Beleg steht „/2“ hinter dem Namen und der Belegpreis klein durchgestrichen über dem berechneten Teil; /1 stellt die
Position wieder her. Kurzes Antippen hakt (bzw. streicht) wie gewohnt.

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
Lesen markiert, ergänzt um eine Stichwortliste), stehen oben. **Gedrückt halten** öffnet auch hier das „/“-Blatt (nur einen Teil aufteilen, siehe oben); ein Tipp direkt
auf das „/2“ hebt es wieder auf, statt die Zeile zu streichen. Kurze
Animationen führen das zu Beginn vor: erst Durchstreichen und Antippen, dann einmal das Gedrückthalten (ein Ring
füllt sich um den Finger, „/2“ erscheint, eine Comic-Sprechblase erklärt es), danach noch zweimal Streichen und Tippen.

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

## Technik

| Teil | Umsetzung |
| --- | --- |
| App | React + TypeScript (Vite), installierbar als PWA, mobil optimiert, Hell/Dunkel-Modus |
| Belegerkennung | Claude (Vision + Structured Outputs) auf dem Server. Fallback: Tesseract.js lokal im Browser |
| Live-Sync | Node-Server mit Server-Sent Events. Jede Änderung wird sofort an alle Teilnehmer gepusht |
| Identität | Jedes Gerät hat einen zufälligen geheimen Schlüssel. Andere sehen nur dessen Hash als Teilnehmer-ID |
| Daten | `data/bills.json` auf dem Server, Belegfotos in `data/receipts/`. Rechnungen werden nach 60 Tagen gelöscht |
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
npm run build && npm start  # Produktion: ein Node-Prozess liefert App + API aus
```

Ohne `ANTHROPIC_API_KEY` läuft die Belegerkennung komplett im Browser (Tesseract.js). Die dafür nötigen Dateien
liegen nach `npm run dev`/`npm run build` unter `public/ocr` und werden selbst ausgeliefert.

Für die Kamera (Foto und QR-Scanner) muss die App über **HTTPS** laufen (oder `localhost`).


Beim ersten Öffnen einer Rechnung (ohne Gleichverteilung) führt eine kurze Animation auf den ersten Zeilen vor, wie
man abhakt („Antippen = abhaken“), ein Stück mit jemandem teilt („Namen antippen = mit Anna teilen“, mit dem Namen einer Person aus der Rechnung) und die Hälfte des
eigenen Stücks zum Teilen anbietet („Eigenen Namen antippen = Du willst mit jemandem teilen“). Sie läuft zweimal, einmal pro
Rechnung und Gerät, endet beim ersten eigenen Antippen und verändert nichts an der Rechnung.
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

### Live stellen (Render)

Das Repo enthält eine fertige `render.yaml`:

1. Auf [render.com](https://render.com) ein Konto anlegen und GitHub verbinden.
2. Im Dashboard **New → Blueprint** wählen und dieses Repo auswählen. Render liest `render.yaml` und legt den
   Web Service samt 1-GB-Speicher (`/var/data`) in Frankfurt an.
3. Wenn Render nach `ANTHROPIC_API_KEY` fragt: Schlüssel eintragen, um die KI-Belegerkennung zu nutzen, oder
   leer lassen. Dann erkennt das Handy den Beleg selbst.
4. Nach dem ersten Build ist die App unter `https://<name>.onrender.com` erreichbar. Die QR-Codes zeigen
   automatisch auf diese Adresse. Jeder Push auf `main` wird automatisch neu ausgerollt.

Hinweise:
- Persistenter Speicher erfordert einen bezahlten Tarif (`plan: starter`). Ohne Speicher gehen die Rechnungen bei
  jedem Neustart verloren.
- Es darf nur **eine** Instanz laufen. Live-Updates und Rechnungen liegen im Speicher dieses Servers.
- Missbrauchsschutz: Belegfotos sind pro Gerät/IP und Stunde (`RECEIPT_LIMIT_PER_HOUR`) und insgesamt pro Tag
  (`RECEIPT_LIMIT_PER_DAY`) begrenzt. Ist das Limit erreicht, liest das Handy den Beleg selbst. Neue Rechnungen
  sind pro Gerät/IP und Stunde begrenzt (`BILL_LIMIT_PER_HOUR`).

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
| `DATA_DIR` | Ordner für `bills.json` und die Belegfotos (Standard `data`) |
| `TRUST_PROXY` | `1` hinter einem Reverse-Proxy: Client-Adresse aus `X-Forwarded-For` lesen |
| `RECEIPT_LIMIT_PER_HOUR` | Belegfotos pro Gerät/IP und Stunde (Standard 10) |
| `RECEIPT_LIMIT_PER_DAY` | Belegfotos insgesamt pro Tag (Standard 300) |
| `BILL_LIMIT_PER_HOUR` | Neue Rechnungen pro Gerät/IP und Stunde (Standard 30) |

## API

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `POST` | `/api/parse-receipt` | Belegfoto → Positionen |
| `POST` | `/api/bills` | Rechnung anlegen (Ersteller wird Rechnungssteller) |
| `GET` | `/api/bills/:id` | Rechnung aus Sicht des Geräts |
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

Geräte authentifizieren sich mit dem Header `x-billsplit-key`. Beim Event-Stream wird er als Query-Parameter `key`
übergeben, weil `EventSource` keine eigenen Header unterstützt.
