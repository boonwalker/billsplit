# billsplit

**Einer zahlt. Alle splitten.**

> In der App heißt das Produkt seit dem 11.10.2026 **klicksplit** (Name, Logo „Beleg mit Tipp“, Mails von
> `klicksplit.de`). Repo, Ordner und interne Schlüssel (`billsplit.*` im Browser-Speicher, Header `x-billsplit-key`,
> Backup-Dateien) heißen bewusst weiter billsplit – sonst gingen gespeicherte Daten verloren.

billsplit teilt Restaurantrechnungen unter Freunden auf: Wer bezahlt hat, fotografiert den Beleg und zeigt einen
QR-Code. Die Freunde scannen ihn, haken auf der digitalen Rechnung ab, was sie hatten, und zahlen ihren Anteil per
PayPal. Alle sehen live, wer welche Position übernommen hat.

## Ablauf

**Rechnungssteller**

1. Gleich „Rechnung fotografieren“ – beim allerersten Mal fragt billsplit, während der Beleg gelesen wird, wie
   ein Assistent nach dem Namen und dann „Wie willst Du bezahlt werden?“ (PayPal, Überweisung oder Wero – nur die
   gewählte Angabe wird eingetragen). Weitere Zahlungswege lassen sich später im Profil ergänzen. Die Zahlungsart lässt
   sich auch hier „Überspringen“ (auch bei „Ausgabe zuweisen“) – dann entsteht die Rechnung trotzdem, Freunde markieren
   ihren Anteil als bezahlt, und die Frage kommt nicht wieder (`profileDue`, Merker `billsplit.asked.payment`).
2. „Rechnung fotografieren“: Der Beleg wird analysiert. Alle Positionen werden digitalisiert, auch solche mit
   mehrfacher Anzahl („3x Bier“).
3. Das Ergebnis ist ein großer QR-Code. Er enthält den Link zur Rechnung und deine PayPal-Daten.
4. Weiter unten liegt die digitale Rechnung im Beleg-Design. Dort hakst du deine eigenen Positionen ab.
5. Unter der Rechnung siehst du deine Freunde, sobald sie beigetreten sind. Hat jemand auf „Bezahlen“ getippt,
   erscheint der Betrag hinter seinem Namen. Diese Angaben gleichst du mit den PayPal-Eingängen ab und hakst
   „erhalten“ an. Unten steht immer, wie viel dir noch fehlt.
   Wer noch etwas offen hat – oder beigetreten ist, aber noch nichts abgehakt hat –, bekommt einen Knopf „Erinnern“.
   Hat der Freund Benachrichtigungen eingeschaltet, schickt er eine Push-Mitteilung („Niklas erinnert Dich – Für
   „Trattoria“ sind bei Dir noch 9,50 € offen.“ bzw. „Bitte hake in „Trattoria“ ab, was Du hattest.“; ein Tipp führt
   zu seinem Anteil). Sonst – und in den 12 Stunden nach einer Mitteilung – öffnet er WhatsApp mit derselben Nachricht
   samt Link. In der Zeile steht danach „per Mitteilung erinnert vor 2 Std.“. Im Dashboard gibt es „Erinnern“ im
   Ausgleich mit einer Person, die Dir etwas schuldet („Carl hat noch nicht bezahlt?“), mit dem Betrag aus allen
   Deinen Rechnungen.

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
   Kurz vor dem Absprung zu PayPal ploppt über der Bezahlleiste die Sprechblase „↩ Danach wieder zurück in die App
   kommen und die Zahlung bestätigen“ auf (`paybar-bubble`).
   Kommt man danach in die App zurück, fragt sie gleich „Hast Du 11,80 € an Niklas gesendet?“ – ein Tipp auf
   „✓ Ja, gesendet“ markiert den Anteil als bezahlt (auch nach Überweisung oder Wero).

Neue Freunde landen meist im Browser (WhatsApp-Link oder Kamera-App). Dort geben sie ihren Namen ein. Nach dem
ersten „✓ Ja, gesendet“ (bzw. „Als bezahlt markieren“) sehen sie die Bestätigung eine Sekunde lang, dann öffnet sich
die Startseite (der Profil-Knopf zeigt schon ihre Initiale) und 1,5 Sekunden später einmalig der Profil-Assistent:
E-Mail-Adresse für das Konto und „Wie willst Du bezahlt werden?“ (beides überspringbar). In
Safari auf dem iPhone folgt die Anleitung „klicksplit auf Deinen Home-Bildschirm“ – mit „In der App öffnen“, sodass die
Rechnung samt Häkchen in die App mitkommt.

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
(„klicksplit · Titel · Name“) bzw. die Wero-Nummer mit je einem Kopier-Knopf. Hat der Bezahler PayPal hinterlegt,
bleibt „Anteil begleichen“ der PayPal-Weg und darunter steht „Lieber per Überweisung oder Wero“; ohne PayPal öffnet
„Anteil begleichen“ direkt die Überweisungsdaten. Danach geht es wie gewohnt mit „Als bezahlt markieren“ weiter.

**Ohne Zahlungsdaten** (der Rechnungssteller hat „Wie willst Du bezahlt werden?“ übersprungen) sehen Freunde „Niklas hat
keine Zahlungsdaten hinterlegt. Gib den Betrag direkt, z.B. bar – und markiere ihn dann als bezahlt.“ mit dem Knopf
„Als bezahlt markieren“ (vermerkt den Betrag und markiert ihn, `paidInPerson`). Der Rechnungssteller sieht unter dem
Beleg wie immer, wer beigetreten ist, und bei jedem Freund seinen Anteil – das gilt jetzt für alle Rechnungen: rechts
steht der aktuelle Anteil, sobald jemand etwas hat (nach „Bezahlen“ der dabei vermerkte Betrag), und „ist beigetreten ·
wählt noch aus …“ nur, solange noch nichts abgehakt ist. „erhalten“ erscheint nach dem Markieren wie gewohnt.

### Trinkgeld

Steht ein Trinkgeld auf dem Beleg, wird es automatisch übernommen – auch wenn es nur als Differenz erkennbar ist: Wurde
mit Karte mehr als die Summe gezahlt, ist die Differenz Trinkgeld, selbst wenn die Kasse sie als „Rückgeld“ druckt
(„Summe 208,00 · Kreditkarte 230,00 · Rückgeld 22,00“ → 22,00 € Trinkgeld; mit Karte gibt es kein Rückgeld). Nur bei
Barzahlung ist Rückgeld wirklich Rückgeld. Sonst fragt billsplit vor dem Erstellen des
QR-Codes nach: absolut (der Trinkgeldbetrag selbst, voreingestellt), in Prozent oder als Endbetrag, also was Du insgesamt bezahlt
hast. Beim Endbetrag ist das Trinkgeld die Differenz zum Rechnungsbetrag; das Feld ist leer und fragt „Was hast Du
bezahlt?“ (früher stand dort grau der Rechnungsbetrag, der auf dem iPhone wie ein gesperrtes Feld aussah). Bei einer erkannten Lieferbestellung stehen unter
„absolut“ Schnellknöpfe für den Fahrer: 0,50 €, 1 €, 2 €.

Das Trinkgeld wird **anteilig nach dem verteilt, was jeder hatte** (seit 16.10.2026, `BillData.tipByShare`,
`itemShare` in `src/lib/bill.ts`): Es erhöht jede Position um denselben Prozentsatz – wie ein Rabatt, nur umgekehrt.
Beispiel C.C. Kowalski: 22 € Trinkgeld auf 208 € sind +10,6 %; wer ein Schnitzel für 31,50 € hatte, zahlt 34,83 €. Auf
dem Beleg steht dazu „Trinkgeld auf jede Position +10,6 %“, im Trinkgeld-Schritt „Das Trinkgeld geht anteilig auf die
Positionen …“. Der Anteil des Trinkgelds an noch nicht abgehakten Positionen bleibt mit diesen offen. Bei
Gleichverteilung zahlt ohnehin jeder dasselbe, Trinkgeld eingeschlossen.

Ältere Rechnungen (ohne `tipByShare`) behalten ihr Trinkgeld pro Kopf – sonst würden sich bezahlte Anteile nachträglich
ändern. Pro Kopf zählt dort (und für Gebühren über null) automatisch, wer der Rechnung per QR-Code beigetreten ist,
plus der Rechnungssteller. Optional gibt der Rechnungssteller eine erwartete Personenzahl an, vorab im Trinkgeld-Schritt
(nur noch gefragt, wenn es Gebühren pro Kopf gibt) oder später direkt unter der Rechnung. Sie gilt, solange noch nicht
alle beigetreten sind, etwa wenn jemand erst am nächsten Tag scannt. Treten mehr Personen bei als erwartet, zählen alle.

### Liefer- und Servicegebühren

Liefergebühren, Servicegebühren, Mindestbestellwert-Zuschläge und ähnliche Gebühren erkennt billsplit getrennt
von den Positionen. Sie werden wie das Trinkgeld gleichmäßig pro Person verteilt. Erkennt billsplit eine Liefer-
oder Abholbestellung (Gebühren auf dem Beleg oder typische Liefer-App), fragt es vor dem QR-Code:
„Wie viele haben mitbestellt?“. Gebühren lassen sich im Editor ergänzen oder korrigieren.

Rabatte (Gebühren unter null, z. B. „Rabatte -5,00 €“ oder „Gratis Lieferung -2,99 €“) werden dagegen nicht pro Kopf,
sondern anteilig nach Bestellwert verteilt: Jede Position wird um denselben Prozentsatz günstiger (auf dem Beleg
„Rabatt auf jede Position -25 %“). So kann kein Anteil unter null fallen, und „Dir fehlen noch“ liegt nie über der
Rechnungssumme. „N von M haben auf Bezahlen getippt“ erscheint erst, wenn jemand beigetreten ist.

**Rundung:** „Dir fehlen noch“ ist immer genau die Summe dessen, was die Freunde laut ihrer Rechnung zahlen (plus was noch
niemand hat) – nie „Gesamt minus eigener Anteil“. Bei 6,55 € für zwei zahlt der Freund 3,28 €, also fehlen 3,28 €;
den Rundungscent trägt der Rechnungssteller, „Dein eigener Anteil“ zeigt 3,27 € (`ownerSummary` in `OwnerPanel.tsx`).

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

### Direkt zuordnen (Rechnungssteller)

Bei Rechnungen mit Abhaken öffnet langes Drücken auf eine Position dasselbe Blatt, oben zusätzlich mit **„Wer hatte
das?“**: runde Knöpfe wie bei „Ausgabe zuweisen“ – „Du“, alle Beigetretenen und bis zu zehn Personen aus früheren
Rechnungen. Antippen gibt der Person die ganze Position (alle Stücke), nochmal antippen nimmt sie ihr wieder weg;
mehrere Personen teilen sich die Position zu gleichen Teilen. Wer noch nicht in der Rechnung war, kommt dazu
(„von Dir zugeordnet“) und bekommt eine Mitteilung wie bei „Ausgabe zuweisen“ (`BillCore.assign`, die App schickt die
vollständigen Häkchen der Person). Nimmt der Rechnungssteller einer so hinzugefügten Person alles wieder weg, bevor sie selbst
etwas getan hat (abgehakt, auf Bezahlen getippt, als bezahlt markiert, Ausgleich), verlässt sie die Rechnung wieder –
aus der Freundesliste und aus ihrer eigenen Rechnungsliste (`untouchedAssignee`; Listeneinträge vom Server tragen
`synced` und fallen weg, wenn die Rechnung noch existiert, man aber nicht mehr dabei ist). Darunter „Nur einen Teil aufteilen“ mit dem „/ N“ wie oben; „Übernehmen“ speichert
nur, wenn sich der Teiler geändert hat. Die Gesten-Hilfe „?“ nennt dafür „Gedrückt halten“.

**In der Gleichverteilung** gibt es dieselben Kreise. Eine so zugeordnete Position (z.B. das Duschgel für Andy) zahlen
nur die gewählten Personen, zu gleichen Teilen; alles andere wird weiter gleich auf alle verteilt. Auf dem Beleg steht
dann in Bleistift der Name statt des Betrags pro Person, unten „SUMME“ (alles) und „Für alle“ mit dem Bruch nur über
den geteilten Rest; über der Rechnung „Rechnung … aufteilen auf“ ebenfalls nur der Rest. Gespeichert wird das an der
Position (`BillItem.for`, `lineFor`/`personalShare`/`poolTotal` in `src/lib/bill.ts`, `setItemFor` in `billEdits.ts`) –
nicht über die Häkchen, damit sich ältere Rechnungen nie ändern. Freunde, die noch nicht dabei waren, kommen über
`BillCore.assign` dazu (mit der Position als Häkchen, damit beim Umschalten auf Abhaken alles stimmt) und gehen beim
Zurücknehmen wie oben wieder. Eine „Du“-Position trägt der Rechnungssteller selbst. Wer die Rechnung verlässt, dessen
Positionen werden wieder geteilt.

### Supermarkt-Einkäufe

Die Erkennung merkt anhand des Geschäftsnamens und der Produkte, ob es ein Supermarkt- oder Drogerie-Einkauf ist.
Dann fragt billsplit vor dem QR-Code, ob etwas nicht oder nur teilweise abgerechnet werden soll: „Alles aufteilen“,
„Manches nicht“ oder „Jeder selber abhaken“ (führt direkt zur fertigen Rechnung ohne Gleichverteilung). Bei
„Alles aufteilen“ wählt man mit demselben Bleistift-„/ N“ wie auf dem Beleg, durch wie viele geteilt wird; darunter
steht, was abgerechnet wird. Auf der fertigen Rechnung stehen dann für den Rechnungssteller die Artikel, die
wahrscheinlich nicht für alle sind, oben unter „Vielleicht nicht für alle?“ – zum nachträglichen Antippen und Streichen.
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

### Ausgabe zuweisen

Für eine einzelne Ausgabe ohne Beleg (Taxi, Konzertkarten, Tanken …) gibt es auf der Startseite direkt unter
„QR-Code scannen“ den Knopf **„Ausgabe zuweisen“** (`#/ausgabe`). Die Eingabemaske fragt nur das Nötigste: den Betrag (groß,
mit Zahlentastatur), „Wofür?“ (frei oder per Schnellauswahl Taxi, Tanken, Tickets, Einkauf, Essen, Geschenk), „Wann?“
(heute vorbelegt) und „Wie viele teilen sich das?“ (inklusive Dir, mit dem Bleistift-„/ N“ wie auf dem Beleg);
darunter steht sofort der Anteil pro Person. „Rechnung erstellen“ macht daraus eine Rechnung mit Gleichverteilung,
die wie jede andere per QR-Code oder Link geteilt wird. Fehlt noch das Profil, fragt vorher der Profil-Assistent nach
Name und Bezahlweg.

**Direkt zuordnen:** Darunter stehen als runde Knöpfe (Anfangsbuchstabe) die Leute, mit denen man schon in Rechnungen
war – die häufigsten und jüngsten zuerst (`/api/contacts`, `BillCore.contacts`). Antippen ordnet die Ausgabe direkt
zu: „5 € · Taxi · Andy“ → Andy zahlt 5,00 €; mit „Du bist auch dabei“ wird geteilt (10 € mit Andy → je 5,00 €), mehrere
Personen teilen sich den Betrag. Die Rechnung entsteht wie gewohnt, die Gewählten stehen sofort mit ihrem Anteil drin
(`/api/bills/:id/assign`, nur für den Rechnungssteller und nur mit bekannten Personen), bekommen eine Push-Mitteilung
„Niklas hat Dir 5,00 € zugeordnet“ und sehen den Betrag in Rechnung und Dashboard. Beim Rechnungssteller steht „von Dir
zugeordnet · 5,00 € offen“.

Auch zugeordnete Ausgaben sind immer Rechnungen mit **Gleichverteilung** (keine Abhak-Rechnung). Ohne „Du bist auch
dabei“ zählt der Rechnungssteller dabei nicht mit (`BillData.ownerExcluded`, `splitPeople` in `src/lib/bill.ts`): Andy
zahlt die ganzen 5,00 €, über der Rechnung steht „5,00 € für eine Person – Du bist nicht dabei“. Schaltet der
Rechnungssteller die Gleichverteilung später aus, gelten die Zuordnungen von vorher (Andy hat das Taxi abgehakt).

**Reihenfolge:** „Deine Rechnungen“ ist immer nach Datum sortiert, die neueste oben – eine erneut geöffnete Rechnung
rutscht nicht mehr nach oben. Die Liste hat keine Obergrenze: Die neuesten 20 stehen da, „Ältere anzeigen (N)“ zeigt
den Rest.

**In der Rechnungsliste des Empfängers:** Die Liste „Deine Rechnungen“ liegt auf dem Gerät (`billsplit.recent`). Damit
zugeordnete Rechnungen dort sofort auftauchen, ohne dass man sie erst über Push oder Dashboard öffnet, holt die
Startseite beim Öffnen und bei jeder Live-Änderung `/api/my-bills` und ergänzt fehlende Rechnungen (`syncRecentBills`).
So ergänzte Rechnungen sind **ungelesen**: grün umrandet, sanft pulsierend und mit einem Lichtreflex, der ab und zu
über den Rand läuft (bei „Bewegung reduzieren“ still), bis man sie auf dem Gerät einmal öffnet (`unread` in
`billsplit.recent`).
Mit ✕ entfernte Rechnungen merkt sich das Gerät (`billsplit.hidden`) und holt sie nicht zurück, bis man sie wieder öffnet.
Das gilt mit und ohne Konto.

Kennt der Server eine Rechnung nicht mehr, verschwindet sie nicht einfach: Sie bleibt ausgegraut mit „nicht mehr
verfügbar“ stehen (`markGone`), bis man sie mit ✕ entfernt (ohne Rückfrage), und die App meldet das an die
Betriebsseite. Rechnungen laufen nicht ab – der Server löscht keine Rechnung nach einer bestimmten Zeit. Ebenso meldet die App
nicht still ab, wenn der Server das Konto nicht mehr kennt: Startseite und Profil sagen „Du wurdest abgemeldet: Der
Server kannte Dein Konto … nicht mehr“, „Wieder anmelden“ hat die Adresse schon eingetragen (`billsplit.accountLost`).

### Dashboard

Über „Deine Rechnungen“ auf der Startseite (damit er bei vielen Rechnungen nicht nach unten rutscht) – und auch ohne
eine einzige Rechnung auf dem Gerät – führt „Dashboard · Deine Bilanz“ zu einer Übersicht über alle Rechnungen, an denen Du beteiligt bist – auch über solche, die
nicht (mehr) in der Liste auf dem Gerät stehen (`/api/my-bills`), damit Ring, Personen und Gesamtausgleich immer
dasselbe zeigen. Das ✕ an einer Rechnung in der Liste fragt erst „Bist Du sicher, dass Du diese Rechnung löschen
möchtest?“; „Löschen“ nimmt sie nur aus der eigenen Liste, für die anderen Teilnehmer bleibt sie erhalten. Solange in
der Rechnung noch Geld offen ist (in eine der beiden Richtungen) oder Du einen Zahlungseingang bestätigen musst
(„erhalten“ bzw. eine Ausgleichszahlung), geht das nicht: Dann erklärt „Diese Rechnung ist noch offen“, warum sie
bleibt, mit „Rechnung öffnen“ (`stillOpen` in `src/lib/balances.ts`, Merker `open` in der Liste). Ein Ringdiagramm zeigt, wie viel Du insgesamt leihst (grün: was Freunde Dir aus Deinen Rechnungen noch
schulden, bis Du es als erhalten markierst) und wie viel Du schuldest (orange: Dein Anteil an Rechnungen anderer, bis Du
ihn als bezahlt markierst); in der Mitte steht die Bilanz, ein Tipp auf einen Ring-Teil oder die Legende zeigt dessen
Betrag und Anteil. Darunter stehen die Einzelbilanzen mit jeder Person als kleine Ringe in
Kacheln (über alle Rechnungen zusammengefasst – zugeordnet über die Gerätekennung der Person, nicht über den Namen, sodass zwei Annas nie verrechnet werden; grün, was die Person Dir schuldet, orange, was Du ihr schuldest). Grün und Orange sind für Hell- und Dunkelmodus auf Farbenblindheit geprüft; bei mehreren Währungen
gibt es je Währung eine eigene Übersicht.

Jede Kachel lässt sich antippen – auch bei „✓ ausgeglichen“ („Verlauf ansehen ›“). Das Fenster zeigt oben, was offen
ist, und darunter immer **„Gemeinsame Rechnungen“**: jede Rechnung mit der Person, neueste zuerst, mit Datum, wer bezahlt
hat, dem Anteil und „x,xx € offen“ bzw. „✓ beglichen“ (`PersonBalance.history` in `src/lib/balances.ts`). Ist alles
beglichen, heißt das Fenster „Du und Anna“ mit „✓ Mit Anna ist alles ausgeglichen.“

Genauso lässt sich die **Gesamtbilanz** immer antippen – die Mitte des großen Rings oder „Alle Rechnungen ansehen ›“
unter der Legende. Das Fenster „Deine Bilanz“ stellt in zwei Spalten gegenüber: links „Du leihst“ (Rechnungen, die Du
bezahlt hast, mit den Anteilen der anderen), rechts „Du schuldest“ (Rechnungen anderer mit Deinem Anteil), oben je die
offene Summe wie im Ring. Jede Rechnung steht als Karte mit Datum, Anteil und „x,xx € offen“ bzw. „✓ beglichen“ –
auch die beglichenen, neueste zuerst; Rückzahlungen aus Überzahlungen stehen als eigene Karte („Rückzahlung“).
Ein Tipp öffnet die Rechnung, „Zurück“ führt wieder in das Fenster (`Balances.bills` in `src/lib/balances.ts`,
`BalanceSheet`). Bei mehreren Währungen stehen alle Rechnungen in ihrer eigenen Währung in einem Fenster.

**Rechnungen in den Listen:** In allen Aufstellungen des Dashboards (Ausgleich mit einer Person, Zahlungsplan,
Eingänge) öffnet ein Tipp auf eine Rechnung diese direkt an der Stelle mit dem Betrag – beim eigenen Beleg bei der
Person in der Freundesliste, beim fremden am Ende des Belegs mit dem eigenen Anteil. „Zurück“ führt wieder zur Liste,
die vorher offen war.

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


**Mehrere Währungen:** Gibt es Rechnungen in verschiedenen Währungen, rechnet das Dashboard alles in die Heimwährung
um und zeigt oben eine gemeinsame Bilanz samt „Mit wem Du wie stehst“ („Alle Währungen in EUR umgerechnet – mit den
Referenzkursen der Europäischen Zentralbank vom …“). Darunter steht je Währung „Ausgleichen in USD“ usw. – bezahlt wird
in der Währung der Rechnung. Die Kurse holt der Server werktäglich von der EZB (`server/rates.ts`, `/api/rates`,
gespeichert als `rates.json` im Datenordner; ist die EZB nicht erreichbar, gelten die letzten). Die Heimwährung folgt
der Region des Geräts (z. B. en-US → USD, sonst Euro) und lässt sich im Profil unter „Heimwährung“ festlegen.

### Kassenbon-Vorschau

Beim ersten Öffnen einer neu erstellten Rechnung schiebt sich – während der Rechnungssteller oben bei QR-Code und
WhatsApp-Button ist – der obere Rand des Kassenbons (Zacken, Titel, „Deine interaktive Rechnung ist fertig ↓“ – für
den Rechnungssteller ist jede Rechnung interaktiv) hinter der unteren Leiste hoch ins Bild und zupft alle paar Sekunden kurz nach
oben. Der Schnipsel hat genau Breite, Schrift und Papier des echten Bons: Beim ersten Runterscrollen bleibt er stehen,
bis der echte Bon ihn erreicht, und geht dort in ihn über. Danach (und bei jedem weiteren Öffnen dieser Rechnung)
erscheint er nicht mehr. Ein Tipp auf den Schnipsel scrollt zum Bon. Weil er über der Seite liegt, würde ein Wisch,
der auf ihm beginnt, die Seite sonst nicht bewegen (auf dem iPhone passierte gar nichts): Wischen und Mausrad auf dem
Schnipsel scrollen deshalb die Seite (mit Schwung beim Loslassen, `touch-action: none`); übernimmt der echte Bon mitten
im Wischen, bleibt der Schnipsel unsichtbar, bis der Finger loslässt.

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

Gesparte Umwege zeigt der Plan mit Pfeilen: ~~Du → Andy → Katia~~ **Du → Katia**, darunter ein kurzer Satz, warum.

Jede geplante Zahlung listet genau, welche Anteile in welchen Rechnungen sie begleicht. Der Server prüft beim
Eintragen, dass sie für alle Beteiligten aufgeht (niemand gewinnt oder verliert etwas) und nur offene Anteile aus
Rechnungen des Zahlenden betrifft. Bezahlt wird per PayPal (Betrag vorher in der Zwischenablage), Überweisung oder
Wero; nach „Gesendet“ wartet die Zahlung auf den Empfänger. Bis dahin gelten die Anteile als bezahlt (niemand zahlt
doppelt), und alle Beteiligten sehen in ihren Rechnungen einen Hinweis („5,00 € per Ausgleich Niklas → Katia“).
Der Empfänger bestätigt den Eingang im Dashboard (auf der Startseite steht dann „1 Eingang bestätigen“) – erst dann
ist alles in allen Rechnungen beglichen; „Nicht erhalten“ gibt die Anteile wieder frei, und solange sie wartet, kann
der Zahlende die Zahlung zurückziehen. Wer nur mittelbar beteiligt ist (Andy), sieht im Dashboard, was für ihn
beglichen wurde. Der Empfänger sieht nur Anteile aus Rechnungen, an denen er selbst teilnimmt.
Ergebnisse („Katia hat 8,00 € erhalten – alles ausgeglichen.“, „… als erhalten eingetragen“, „… nicht erhalten“) stehen
nur beim ersten Öffnen des Dashboards danach oben – beim nächsten Mal sind sie weg (Merker `billsplit.seenTransfers`);
führt eine Mitteilung zu so einer Zahlung, erscheint sie trotzdem. Wartende Zahlungen stehen immer da.

### Nachträglich geändert, schon bezahlt

Streicht der Rechnungssteller eine Position, nachdem jemand schon bezahlt hat (oder ändert er die Rechnung so, dass ein
Anteil kleiner wird), fragt die App vorher: „Anna hat schon 10,00 € bezahlt – danach wären es nur 6,00 €. Die 4,00 €
werden Anna gutgeschrieben …“ mit „Trotzdem ändern“ / „Abbrechen“ (auf der Rechnung und unter „Positionen
bearbeiten“). Die Differenz zählt dann als Schuld des Rechnungsstellers: in der Rechnung („Du schuldest Anna 4,00 €
zurück“ bzw. bei Anna „Niklas schuldet Dir 4,00 €“), im Dashboard und im Gesamtausgleich, wo sie mit anderen offenen
Beträgen verrechnet wird (`BillCore.refundOf`, Rückzahlung als Ausgleichszahlung vom Rechnungssteller an den Gast).
Hakt der Rechnungssteller „erhalten“ ab, ohne dass vorher jemand auf Bezahlen getippt hat, merkt sich die App den
damals offenen Betrag (`receivedAmount`), damit eine spätere Änderung erkennbar bleibt.

### Benachrichtigungen

billsplit kann per Push Bescheid sagen, wenn etwas auf einen wartet – auch wenn die App zu ist:

- „Niklas hat Dir 8,00 € gesendet“ (bitte Eingang bestätigen) bzw. „Niklas möchte gegenseitig verrechnen“
- „Katia hat 8,00 € erhalten ✓“ / „… nicht erhalten“ / „Katia hat Deinen Ausgleich eingetragen“
- „Anna hat bezahlt“ (in Deiner Rechnung als bezahlt markiert – bitte Eingang prüfen)
- „Niklas hat die Zahlung zurückgezogen“
- „Niklas erinnert Dich“ (über „Erinnern“, höchstens einmal in 12 Stunden pro Rechnung)

Ein Tipp auf die Benachrichtigung führt direkt dorthin, wo als Nächstes etwas zu tun ist: bei „Anna hat bezahlt“ in
die Rechnung, heruntergescrollt zu Anna in der Freundesliste (kurz hervorgehoben), um den Eingang zu prüfen und
„erhalten“ anzuhaken; bei Ausgleichszahlungen ins Dashboard zur betreffenden Zahlung. Einschalten lässt es sich im Dashboard
(„Benachrichtigen, wenn Geld eingeht?“, einmalig) und jederzeit im Profil. Auf dem iPhone geht das nur in der App vom
Home-Bildschirm (iOS 16.4 oder neuer); in Safari steht dort ein Hinweis. Technisch: Web Push mit einem Service Worker
(`public/sw.js`, er speichert nichts zwischen) und VAPID-Schlüsseln, die der Server beim ersten Start erzeugt und
neben den Rechnungen ablegt (`vapid.json`, Abos in `push.json`); gesendet wird nur an die Push-Dienste von Apple,
Google, Mozilla und Microsoft.

### Konto mit E-Mail-Adresse (optional)

Wer möchte, verbindet seine Gerätekennung mit einer E-Mail-Adresse – ohne Passwort. billsplit schickt einen
6-stelligen Code per Mail, der dort eingetippt wird, wo man gerade ist (ein Link in der Mail würde sich auf dem iPhone
immer in Safari öffnen, nie in der Home-Bildschirm-App).

- **Wo gefragt wird:** im Profil-Assistenten direkt nach dem Namen – beim Rechnungssteller während der Beleg gelesen
  wird, bei Freunden nach dem Bezahlen („✓ Erledigt. Damit Du Deine Rechnungen überall wiederfindest:“). Immer mit
  „Überspringen“. Außerdem ganz oben im Profil unter „Konto“: dort steht „● Angemeldet“ mit der Adresse (oder „Nicht
  angemeldet“ mit „Anmelden oder Konto anlegen“), daneben „Abmelden“ und „Konto löschen“. Auf der Startseite trägt der
  Profil-Knopf oben rechts einen kleinen grünen Haken, solange das Gerät angemeldet ist.
- **Neues Gerät:** auf der Startseite „Schon ein Konto? Anmelden“ (solange dort noch keine Rechnungen sind) oder im
  Profil. Nach dem Code hat das Gerät die Gerätekennung des Kontos, das Profil und alle Rechnungen. Was das Gerät
  vorher schon hatte (z. B. eine Rechnung, der man im Browser beigetreten ist), wird ins Konto übernommen.
- **Einmal nachfragen:** Öffnet jemand die Startseite mit leerem Speicher (neues Handy, neue Home-Bildschirm-App,
  Browser hat die Daten gelöscht – nicht über einen Rechnungslink, da soll der Gast erst zahlen), fragt klicksplit
  einmal „Warst Du schon mal bei klicksplit?“ mit „Anmelden“ / „Ich bin neu hier“. Wer klicksplit zum zweiten Mal nutzt
  (Start oder Rückkehr nach mindestens 30 Minuten, `countSession`), noch kein Konto hat und Rechnungen in der Liste,
  bekommt einmal „Sichere Deine Rechnungen“ mit „Konto anlegen“ / „Später“ (`startedFresh`, `billsplit.sessions`,
  `billsplit.asked.*` in `src/lib/storage.ts`).
- **Abmelden** (Profil): das Gerät startet leer, im Konto bleibt alles. **Konto löschen**: die Adresse wird
  gelöscht, die Rechnungen bleiben auf dem Gerät.
- **Schutz:** Codes gelten 15 Minuten und einmal, nach 5 falschen Versuchen ist ein Code ungültig; höchstens 5 Codes
  pro Adresse und 15 pro Gerät/IP und Stunde. Ein Gerät gehört zu höchstens einem Konto.
- **Versand:** über Resend (`RESEND_API_KEY`, `MAIL_FROM`, z. B. `klicksplit <code@klicksplit.de>`; der Name vor der
  Adresse steht auch im Mail-Text). Die Mails sehen aus wie der digitale Kassenbon der App: Logo und Wortmarke, darunter
  ein Bon mit abgerissenen Zacken oben und unten, der in Apple Mail wie aus dem Drucker hereinfährt (andere
  Mail-Programme zeigen ihn ruhig, ohne Zacken, wo sie keine Verläufe können). Anrede „Hi Niklas,“ mit dem Profilnamen,
  sofern schon einer eingegeben ist, sonst „Hi,“. Der Code steht groß in einer Mint-Box, ohne Leerzeichen, damit das
  iPhone ihn zum Einfügen vorschlägt. Am Ende stehen nach drei Leerzeilen „klicksplit •“ und darunter groß „Einer zahlt.“ /
  „Alle splitten.“ in der Schrift der Startseite („Alle splitten.“ in Mint) – alles noch auf dem Kassenbon, kein dunkler Kasten.
- **Willkommensmail:** Nach der ersten erfolgreichen Code-Eingabe, wenn das Konto neu angelegt wird, kommt einmalig
  „Willkommen bei klicksplit!“ – herzlich, mit den drei Schritten, wie man von überall per Browser ins Konto kommt
  (Adresse aus `PUBLIC_URL`, nach dem Umzug `klicksplit.de`), einem Knopf zur App und dem Home-Bildschirm-Tipp. Darüber steht unter „So einfach geht's“ ein kleiner
  Einkaufsbon wie in der App: In Apple Mail läuft die Erklär-Animation in Schleife (Antippen streicht „Duschgel“
  durch, Gedrückt halten macht aus „Olivenöl“ „/2“ mit halbem Preis, „Abgerechnet werden“ rechnet mit), und die
  Zeilen lassen sich direkt in der Mail antippen und durchstreichen (versteckte Checkboxen, die Summe steht für jede
  Kombination fertig im HTML; der erste Tipp beendet die Animation). Wo ein Mail-Programm keine Animationen oder
  Checkboxen kann (z. B. Gmail), bleibt ein normaler Bon stehen und der Hinweis „Probier's aus“ fehlt. Das Logo kommt von `PUBLIC_URL` bzw. der Railway-Domain (`/icon-192.png`). Ohne diese
  Variablen steht der Code nur im Server-Log. Konten liegen in
  `DATA_DIR/accounts.json`. In der Demo gibt es keine Konten.

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

### Teilen, Linkvorschau und Weiterempfehlen

Rechnungslinks haben die Form **`https://www.klicksplit.de/b/<id>?to=<PayPal>`** (`billUrl`) – ein echter Pfad statt
`/#/b/…`, denn nur den sieht WhatsApp beim Abrufen. Der Server schreibt dafür Open-Graph-Angaben in die Seite
(`server/preview.ts`): Titel „Trattoria · Niklas hat bezahlt“, ein Satz („Hake ab, was Du hattest …“) und das Bild
`public/og.png` (1200×630, erzeugt mit `node e2e/ogimage.mjs public/icon.svg public/og.png`). Beträge stehen nie in der
Vorschau. Andere Seiten bekommen die allgemeine Vorschau „klicksplit – Einer zahlt. Alle splitten.“; die Sprache folgt
`Accept-Language`, sonst Deutsch. Die App macht beim Start aus `/b/<id>?…` ihre Route `/#/b/<id>?…` (`openPathLink`).
Alte Links und QR-Codes mit `#/b/` funktionieren weiter (`billIdFromUrl` liest beide Formen); die Demo bleibt bei
`#/b/`, weil sie in einer fremden Seite läuft.

Die WhatsApp-Nachricht endet kursiv mit „_mit klicksplit geteilt_“, „Link teilen“ gibt denselben Satz mit, und unten auf
jedem Beleg steht klein „mit klicksplit geteilt · klicksplit.de“. Gäste, die ihren Anteil als bezahlt markiert haben
(oder deren Eingang bestätigt ist), sehen unter dem Beleg „Nächstes Mal bezahlst Du? – Mit klicksplit fotografierst Du
den Beleg und bekommst alles zurück.“ mit „So geht's“ (zur Startseite) – nur, solange sie selbst noch keine Rechnung
erstellt haben (`GuestInvite`).

### Links auf dem iPhone

Auf dem iPhone öffnen geteilte Links immer Safari, nie die Web-App auf dem Home-Bildschirm, und beide haben getrennte
Speicher. Wer eine Rechnung in Safari öffnet, wird deshalb nicht automatisch beigetreten, sondern gefragt; darunter
steht „klicksplit auf dem Home-Bildschirm? In der App öffnen“. Das kopiert den Link und vermerkt die Weiterleitung für
ein paar Minuten auf dem Server (zur Netzwerkadresse des Handys, nicht zum Link). Nur dann zeigt die App beim Öffnen
„Aus Safari weitergeleitet – Kopierten Link öffnen“; iOS fragt einmal mit „Einfügen“ nach, dann ist man in der
Rechnung. Ist iCloud Private Relay aktiv, haben Safari und App verschiedene Adressen und der Hinweis erscheint nicht.

Weil Safari und App getrennte Speicher haben, wären es für billsplit zwei verschiedene Personen: Wer in Safari
beigetreten ist und abgehakt oder bezahlt hat, fände das in der App nicht wieder. Deshalb nimmt „In der App öffnen“
die Safari-Identität per Einmal-Code (10 Minuten gültig) im kopierten Link mit. Beim Öffnen in der App übernimmt
billsplit alles, was in Safari entstanden ist – beigetretene Rechnungen, Häkchen, Zahlungen und Ausgleichszahlungen,
bei derselben Rechnung zusammengeführt – samt Namen, falls die App noch keinen hat.
**Sicherheit:** Der Code wirkt nur im selben Netz, in dem er entstanden ist (Safari und App auf einem Handy) – landet
ein kopierter Link in einem Chat, übernimmt er bei anderen nichts. Er überträgt nie die Rolle des Rechnungsstellers:
Rechnungen, die mit der Safari-Identität bezahlt wurden, bleiben bei ihr (dafür gibt es das Konto bzw. „Gerät
wechseln“). Und wer selbst Rechnungssteller ist, bekommt im Browser gar keinen Code in den kopierten Link.
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
eigenen Stücks zum Teilen anbietet („„Du“ antippen = Du willst mit jemandem teilen“). Sie läuft zweimal, einmal pro
Rechnung und Gerät, endet beim ersten eigenen Antippen und verändert nichts an der Rechnung.

Dauerhaft erklärt ein kleines „?“ neben der Anleitung über dem Beleg die Gesten: beim Abhaken „Antippen“, „Namen
antippen“, „„Du“ antippen“ und „− / +“, beim Rechnungssteller zusätzlich „Gedrückt halten“ (direkt zuordnen oder nur
einen Teil); beim Rechnungssteller mit Gleichverteilung „Antippen“ (streichen) und „Gedrückt halten“ (nur einen Teil).

Ist auf dem Gerät „Bewegung reduzieren“ eingeschaltet, springen alle Animationen sofort ans Ende, die Erklär-Animationen
entfallen (das „?“ bleibt) und es wird nicht weich gescrollt.

### Sprachen (Deutsch, Englisch, Spanisch)

klicksplit gibt es auf Deutsch, Englisch und Spanisch. Die App nimmt die Sprache des Browsers bzw. iPhones (Deutsch,
Englisch oder Spanisch; jede andere Sprache → Englisch); im Profil unter „Sprache“ (unter den Benachrichtigungen) lässt sie sich festlegen („Wie
Gerät“, Deutsch, English, Español). Beträge und Daten erscheinen im Format der Sprache (z. B. „€12.50“, „12,50 €“).

Auch alles, was vom Server kommt, folgt der Sprache: Fehlermeldungen (die App schickt `x-billsplit-lang` mit, sonst
zählt `Accept-Language`), Push-Mitteilungen (jedes Gerät in der Sprache, mit der es Benachrichtigungen eingeschaltet
hat; ältere Abos bleiben Deutsch, bis die App dort wieder geöffnet wird) sowie Code- und Willkommensmail (in der
Sprache der App, in der der Code angefordert wurde). Was in einer Rechnung gespeichert ist (Titel, Namen, Positionen)
bleibt, wie es eingegeben wurde. Technik und feste Begriffe: `docs/i18n.md`.

## Technik

| Teil | Umsetzung |
| --- | --- |
| App | React + TypeScript (Vite), installierbar als PWA, mobil optimiert, Hell/Dunkel-Modus |
| Belegerkennung | Claude (Vision + Structured Outputs) auf dem Server. Fallback: Tesseract.js lokal im Browser |
| Live-Sync | Node-Server mit Server-Sent Events. Jede Änderung wird sofort an alle Teilnehmer gepusht |
| Identität | Jedes Gerät hat einen zufälligen geheimen Schlüssel. Andere sehen nur dessen Hash als Teilnehmer-ID |
| Daten | SQLite-Datenbank `billsplit.db` (eingebautes `node:sqlite`, nur geänderte Rechnungen werden geschrieben), Belegfotos in `receipts/`, tägliche Sicherung in `backups/` (14 Tage). Rechnungen und Ausgleichszahlungen werden nie automatisch gelöscht |
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
  Ausgleich mit einer Person; Gerät wechseln; Wiederherstellungs-Code; Safari → App mit Übernahme; Konto per E-Mail-Code (Codes landen im Test in `MAIL_OUTBOX`); Umzug auf eine neue Adresse (127.0.0.1 spielt die alte); Sprache (Englisch/Spanisch vom Browser, Umstellen im Profil, Code-Mail auf Spanisch); Lieferbestellung mit Trinkgeld-Schnellknöpfen; nach dem Bezahlen streichen (Nachfrage, Rückzahlung); Bilanz über mehrere Währungen (feste Kurse in `rates.json`); Ausgabe direkt Andy zuordnen bzw. mit ihm teilen.
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
   `/data`. billsplit erkennt das Volume automatisch über `RAILWAY_VOLUME_MOUNT_PATH`. **`DATA_DIR` auf Railway
   nicht setzen** (oder nur auf einen Ordner im Volume): Mit `DATA_DIR=data` lagen die Daten im Container und waren
   nach jedem Deploy weg (16.10.2026). Seitdem startet der Server auf Railway gar nicht erst, wenn sein Datenordner
   nicht auf dem Volume liegt (`server/dataDir.ts`) – Railway lässt dann die alte Version weiterlaufen, im Deploy-Log
   steht „klicksplit startet nicht: …“. Richtig ist die Startzeile „Daten: /data, Speicher: sqlite“.
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

### Umzug auf eine neue Adresse (klicksplit.de)

Die App kann ihre Adresse wechseln, ohne dass jemand Daten verliert. Maßgeblich ist `PUBLIC_URL`: Der Server schreibt
die Adresse als `<meta name="klicksplit-home">` in die Seite (`server/app.ts`), die App vergleicht sie beim Start mit
der eigenen (`src/lib/move.ts`).

- **Im Browser an der alten Adresse** geht es sofort weiter zur neuen – auf dieselbe Seite (alte Rechnungslinks
  funktionieren also weiter). Hat der Browser schon Daten, holt er vorher einen Einmal-Code (wie bei „Gerät
  wechseln“) und hängt ihn an: `#/umzug/<code>?ziel=/b/…`. Die neue Adresse tauscht ihn bei `/api/move` gegen
  Gerätekennung, Profil und Rechnungsliste; was dort vorher schon passiert war, wird zusammengelegt
  (`mergeParticipant`). Der Code beweist die alte Kennung, deshalb bleibt die Rechnungssteller-Rolle erhalten. Ist der
  Browser an der neuen Adresse schon mit einem Konto angemeldet, bleibt dessen Kennung.
- **Die Home-Bildschirm-App an der alten Adresse** läuft weiter, zeigt aber beim Start „klicksplit ist umgezogen“ mit
  dem Knopf „klicksplit.de öffnen“ (öffnet Safari mit Übergabe-Code; „Später“ bis zum nächsten Start). In Safari
  erklärt dann „Fast geschafft!“, wie klicksplit neu auf den Home-Bildschirm kommt („In der App öffnen“ kopiert einen
  „Gerät wechseln“-Link, die neue App übernimmt damit alles) und dass die alte App gelöscht werden kann.
- Ohne `PUBLIC_URL` (oder wenn sie der eigenen Adresse entspricht) passiert nichts.

**So ist klicksplit.de eingerichtet (11.10.2026):** Die App läuft unter **https://www.klicksplit.de**.

1. Railway: Service → **Settings → Networking → Custom Domain** → `www.klicksplit.de`, Port `8080`. Der Free-Tarif
   erlaubt nur eine eigene Domain. Die Railway-Adresse `billsplit-production-af2e.up.railway.app` bleibt bestehen –
   über sie laufen alte Links und Home-Bildschirm-Apps.
2. INWX → Domain `klicksplit.de` → **DNS-Einträge**: CNAME `www` → `jdowg88e.up.railway.app` und TXT
   `_railway-verify.www` (Wert aus Railway, „Show DNS records“). Einen CNAME auf der Hauptdomain selbst lehnt INWX ab
   („Der NS-Eintrag ist ungültig“), deshalb `www`. Die Resend-Einträge (`resend._domainkey`, `send`, `_dmarc`) bleiben.
3. Die „Weiterleitung → Web“ von INWX **nicht** benutzen: Sie löscht alle A-, AAAA- und CNAME-Einträge (also auch
   `www`) und kann kein HTTPS.
4. Railway → **Variables** `PUBLIC_URL=https://www.klicksplit.de`. Damit leitet die alte Adresse um (siehe oben) und
   die Mails verlinken die neue.

**Seit 17.10.2026: DNS bei Cloudflare, `klicksplit.de` → `www`.** INWX ist nur noch Registrar; die Nameserver der
Domain zeigen auf Cloudflare (Free). DNS-Einträge werden jetzt **bei Cloudflare** gepflegt (die alte Zone bei INWX
ist nur noch Rückfall und wirkt nicht mehr):

| Typ | Name | Ziel | Proxy |
| --- | --- | --- | --- |
| A | `@` | `192.0.2.1` (Platzhalter) | **orange** – nur für die Weiterleitung |
| CNAME | `www` | `jdowg88e.up.railway.app` | grau (sonst kein Railway-Zertifikat) |
| CNAME | `send`, `rsend` | Resend (`…forge.rmta.net`) | grau |
| TXT | `resend._domainkey`, `_dmarc` | Resend | – |

Redirect Rule „klicksplit.de → www“: Hostname equals `klicksplit.de` → dynamisch
`concat("https://www.klicksplit.de", http.request.uri.path)`, 301, Query-String behalten (der `#`-Teil kommt vom
Browser mit). DNSSEC ist aus; bei Bedarf bei Cloudflare einschalten und den DS-Eintrag bei INWX hinterlegen.

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
Betriebsseite `https://<adresse>/api/admin`: Sie fragt nach dem Token (Feld „Admin-Token“, der Passwort-Manager kann
ihn speichern) bzw. nimmt ihn direkt aus `?token=<ADMIN_TOKEN>`. Ohne `ADMIN_TOKEN` (oder mit weniger als 12 Zeichen) gibt
es die Seite nicht; Leerzeichen und Anführungszeichen um den Wert in Railway werden ignoriert. Ein falscher Token steht
mit seiner Länge im Deploy-Log („Betriebsseite: Token passt nicht (… Zeichen geschickt, … erwartet)“), die Startzeile
zeigt „Admin-Seite: an“ nur bei gültigem Token. Sie ist auch
fürs iPhone gebaut (Kacheln, waagerecht wischbare Tabellen, Sprungmarken oben):

- **Kacheln:** gerade online (App offen), aktive Geräte in 24 h / 7 / 30 Tagen, Geräte gesamt (davon mit
  Home-Bildschirm-App), Konten (davon mit Mitteilungen), Rechnungen (diesen Monat), Beitritte und wie viele davon
  bezahlt haben, abgerechneter Betrag diesen Monat, KI-Kosten, Fehler
- **Nutzung pro Tag:** Besuche, verschiedene Geräte, neue Geräte, Anteil in der App, neue Rechnungen, Beitritte, Betrag.
  Ein Besuch ist ein App-Start oder eine Rückkehr nach mindestens 30 Minuten; die App meldet ihn an `/api/visit`
  (`src/lib/visits.ts`: nur App oder Browser und Sprache), gezählt in `server/visits.ts` → `visits.json` (seit 16.10.2026)
- **Konten:** E-Mail, Name, angelegt, zuletzt aktiv, Rechnungen als Rechnungssteller / als Gast, App oder Browser,
  Mitteilungen, grüner Punkt = gerade online
- **Geräte:** die zuletzt aktiven 150 mit Name (aus den Rechnungen bzw. dem Konto), Konto, erster und letzter Besuch,
  Besuche, App/Browser, Sprache, Rechnungen, Mitteilungen
- **Neueste Rechnungen:** angelegt, Titel, Rechnungssteller, Gäste, wie viele bezahlt haben, Betrag
- **Belegerkennung pro Tag:** Belegfotos, KI-Aufrufe und -Fehler, Tokens und geschätzte Kosten (Listenpreise in
  `server/monitor.ts`), Server- und App-Fehler; oben die Summen des laufenden Monats
- **letzte Fehler:** Serverfehler (mit Stacktrace), fehlgeschlagene Belegerkennungen und Abstürze in der App auf den
  Handys der Nutzer (die App meldet unbehandelte Fehler selbst; ein abgestürzter Bildschirm zeigt „Da ist etwas
  schiefgelaufen“ mit „Neu laden“ statt einer weißen Seite)
- **„Datenbank herunterladen“:** eine aktuelle Kopie aller Rechnungen als zusätzliches Backup außerhalb von Railway

Die Zahlen liegen in `monitor.json` (60 Tage, 200 Fehler) und `visits.json` (Besuche pro Tag, Geräte) im Datenordner.
Die Betriebsseite zeigt E-Mail-Adressen und Namen – den Token deshalb nicht weitergeben (spätestens jetzt gehört eine
Datenschutzerklärung dazu, siehe Backlog).

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

### Datenschutz und Impressum

`#/datenschutz` und `#/impressum` (`src/pages/Legal.tsx`, nur auf Deutsch; in Englisch/Spanisch mit dem Hinweis „Diese
Seite gibt es nur auf Deutsch.“). Erreichbar über „Datenschutz · Impressum“ unten auf Startseite und Profil und im
Konto-Formular unter „Code senden“ (dort in einem neuen Tab, damit ein laufender Scan nicht verloren geht). Name, Anschrift
und E-Mail des Betreibers kommen aus den Railway-Variablen `OPERATOR_*` (`server/operator.ts`, als Meta-Tag
`klicksplit-operator` in jede Seite). Die Erklärung beschreibt: Gerätespeicher (keine Cookies), Rechnungen samt
Zahlungsdaten und Belegfoto, Belegerkennung über Anthropic, Konto und Mails über Resend, Push, Statistik/Fehlerberichte,
IP nur im Arbeitsspeicher, Backups 14 Tage, Hosting Railway, USA-Übermittlung, Speicherdauer (Rechnungen ohne Frist,
Löschung auf Anfrage) und die Betroffenenrechte. Bei neuen Datenflüssen (neuer Dienst, neue gespeicherte Angaben) hier
mit anpassen und das Datum `AS_OF` erhöhen.

### Konfiguration

| Variable | Bedeutung |
| --- | --- |
| `ANTHROPIC_API_KEY` | aktiviert die KI-Belegerkennung |
| `BILLSPLIT_MODEL` | anderes Claude-Modell (Standard: `claude-opus-5-5`) |
| `PORT` | Port des Servers (Standard 8787) |
| `DATA_DIR` | Ordner für Datenbank, Belegfotos, Backups und Push-Schlüssel (Standard `data`; auf Railway das Volume – dort nicht setzen bzw. nur auf einen Ordner im Volume, sonst startet der Server nicht) |
| `TRUST_PROXY` | `1` hinter einem Reverse-Proxy: Client-Adresse aus `X-Forwarded-For` lesen |
| `RECEIPT_LIMIT_PER_HOUR` | Belegfotos pro Gerät/IP und Stunde (Standard 10) |
| `RECEIPT_LIMIT_PER_DAY` | Belegfotos insgesamt pro Tag (Standard 300) |
| `BILL_LIMIT_PER_HOUR` | Neue Rechnungen pro Gerät/IP und Stunde (Standard 30) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | optional: eigene Schlüssel für Push (sonst einmal erzeugt und in `DATA_DIR/vapid.json` gespeichert) |
| `VAPID_SUBJECT` | optional: Kontakt für die Push-Dienste (Standard `mailto:hallo@billsplit.app`) |
| `ADMIN_TOKEN` | optional: schaltet die Betriebsseite `/api/admin?token=…` frei (Nutzung, Kosten, Fehler, Datenbank-Download) |
| `OPERATOR_NAME`, `OPERATOR_ADDRESS`, `OPERATOR_EMAIL` | Betreiber für Impressum und Datenschutzerklärung (`#/impressum`, `#/datenschutz`); Adresszeilen mit „,“ oder „|“ getrennt. Ohne: „Angaben zum Betreiber folgen.“ – stehen bewusst nicht im Repo |
| `ECB_RATES_URL` | optional: andere Quelle für die Wechselkurse im EZB-XML-Format (Standard: Tageskurse der EZB) |
| `PUBLIC_URL` | optional: öffentliche Adresse der App (Logo und Links in den Mails; ohne sie die Railway-Domain). Andere Adressen leiten dorthin um und nehmen die Daten mit (siehe „Umzug auf eine neue Adresse“) |
| `RESEND_API_KEY`, `MAIL_FROM` | optional: Versand der Anmelde-Codes über Resend, z. B. `MAIL_FROM=klicksplit <code@klicksplit.de>` (ohne: Code nur im Log) |

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
| `POST` | `/api/bills/:id/remind` | Rechnungssteller erinnert einen Freund per Push (nur wenn erreichbar, max. alle 12 h) |
| `GET` / `POST` | `/api/reminders` | Wen Push erreicht und wann zuletzt erinnert wurde · eine Erinnerung an eine Person über alle Rechnungen |
| `POST` | `/api/merge-device` | App übernimmt mit einem Einmal-Code aus Safari dessen Teilnahmen |
| `GET` / `DELETE` | `/api/account` | Konto dieses Geräts (E-Mail-Adresse) abfragen bzw. löschen |
| `POST` | `/api/account/code` | 6-stelligen Anmelde-Code an eine Adresse schicken |
| `POST` | `/api/account/verify` | Code prüfen: Konto anlegen oder auf diesem Gerät anmelden (Gerätekennung, Profil, Rechnungen) |
| `PUT` | `/api/account/profile` | Profil im Konto aktualisieren |
| `GET` | `/api/push/key` | Öffentlicher VAPID-Schlüssel für Push-Benachrichtigungen |
| `POST` | `/api/push/subscribe` / `/api/push/unsubscribe` | Push-Abo des Geräts eintragen / entfernen |

Geräte authentifizieren sich mit dem Header `x-billsplit-key`. Bei den Event-Streams wird er als Query-Parameter `key`
übergeben, weil `EventSource` keine eigenen Header unterstützt.

## Weiterentwickeln

`CLAUDE.md` hält Arbeitsweise, Entscheidungen, feste Formulierungen und Backlog fest, `docs/verlauf-anforderungen.md`
alle bisherigen Wünsche im Wortlaut, `e2e/README.md` die Klick-Tests.

