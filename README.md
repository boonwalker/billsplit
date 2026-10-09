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
5. Unter der Rechnung siehst du deine Freunde, sobald sie gescannt haben. Hat jemand auf „Bezahlen“ getippt,
   erscheint der Betrag hinter seinem Namen. Diese Angaben gleichst du mit den PayPal-Eingängen ab und hakst
   „erhalten“ an. Unten steht immer, wie viel dir noch fehlt.

**Freunde**

1. QR-Code mit billsplit („QR-Code scannen“) oder mit der Handykamera scannen und den eigenen Namen eingeben.
   Damit tauchen sie beim Rechnungssteller als Schuldner auf.
2. Eigene Positionen abhaken. Bei mehreren Stück wählt man die Anzahl. Wer eine Position übernimmt, steht mit
   Namen in Grün darunter. Ist eine Position vollständig vergeben, wird sie durchgestrichen. Das passiert live
   bei allen.
3. Unten steht der eigene Anteil. „Mit PayPal bezahlen“ öffnet die PayPal-App bzw. -Website mit Empfänger und
   Betrag. Nach dem Login muss man nur noch bestätigen.

Freunde sehen die Schuldnerliste des Rechnungsstellers nicht. Wer was abgehakt hat, sehen sie dagegen schon.

### Wie der PayPal-Link entsteht

Wenn ein Freund scannt, steht sein Betrag noch nicht fest. Erst wenn er auf „Bezahlen“ tippt, baut billsplit
seinen individuellen Link: den Empfänger aus der Rechnung plus den gerade berechneten Anteil, z. B.
`https://www.paypal.com/paypalme/niklas/18.50EUR`.

> **Wichtig: PayPal.Me vs. E-Mail.** PayPal bietet nur über **PayPal.Me** einen dokumentierten Link, der Empfänger
> *und* Betrag vorbelegt. Ist im Profil nur eine E-Mail-Adresse hinterlegt, öffnet billsplit die PayPal-Seite
> „Geld senden“ und kopiert die Adresse. Den Betrag muss der Freund dann selbst eintragen. Deshalb fragt das Profil
> beides ab.

### Trinkgeld

Steht ein Trinkgeld auf dem Beleg, wird es automatisch übernommen. Sonst fragt billsplit vor dem Erstellen des
QR-Codes nach: in Prozent oder als fester Betrag. Ein fester Betrag wird im Verhältnis der Anteile verteilt
(wer 40 % der Rechnung hatte, trägt 40 % des Trinkgelds).

### Geteilte Positionen

Hakt mehr als eine Person dieselbe Position ab (z. B. eine Vorspeisenplatte), wird sie automatisch anteilig
geteilt. Insgesamt wird sie nie mehr als einmal berechnet.

## Technik

| Teil | Umsetzung |
| --- | --- |
| App | React + TypeScript (Vite), installierbar als PWA, mobil optimiert, Hell/Dunkel-Modus |
| Belegerkennung | Claude (Vision + Structured Outputs) auf dem Server. Fallback: Tesseract.js lokal im Browser |
| Live-Sync | Node-Server mit Server-Sent Events. Jede Änderung wird sofort an alle Teilnehmer gepusht |
| Identität | Jedes Gerät hat einen zufälligen geheimen Schlüssel. Andere sehen nur dessen Hash als Teilnehmer-ID |
| Daten | `data/bills.json` auf dem Server. Rechnungen werden nach 60 Tagen gelöscht |
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
| `DATA_DIR` | Ordner für `bills.json` (Standard `data`) |

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
| `POST` | `/api/bills/:id/received` | Zahlungseingang bestätigen (nur Rechnungssteller) |

Geräte authentifizieren sich mit dem Header `x-billsplit-key`. Beim Event-Stream wird er als Query-Parameter `key`
übergeben, weil `EventSource` keine eigenen Header unterstützt.
