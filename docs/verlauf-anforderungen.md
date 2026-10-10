# Verlauf der Anforderungen

Alle Wünsche und Rückmeldungen des Auftraggebers aus der Entwicklungssitzung (8.–10.10.2026), chronologisch und im
Wortlaut (Tippfehler belassen). Technische Unterbrechungen sind entfernt; „[Screenshot]“ markiert Nachrichten, die
nur aus einem Bildschirmfoto bestanden (die Bilder selbst sind nicht erhalten). Zitierte Antworten von Claude sind
als solche gekennzeichnet. Den aktuellen Stand der Funktionen beschreibt das README, die verbindlichen Regeln
stehen in `CLAUDE.md`.


## 8.10.2026

**20:21 UTC**

Ich möchte eine App zur Rechnungsaufteilung bauen. Wenn bspw. eine Gruppe Freunde zusammen im Restaurant essen war und eine Person die gesamte Rechnung beglichen hat: Dann soll dieser einfach die Rechnung abfotografieren können und anschließend sollen alle Rechnungspositionen (inklusive Berücksichtigung derer mit mehrfacher Anzahl) in eine digitale Rechnung umgewandelt werden. Außerdem soll auf dieser digitalen Rechnung ein QR Code generiert werden. Diesen QR Code können die anderen Freudne Scannen und es öffnet sich die digitale Rechnung in der billsplit App. Hier kann jeder seine Kostenpunkte Anhaken und es wird die Summe gebildet. Der QR Code enthält außerdem die bevorzugte Zahlungsmethode(n) des Rechnungsstellers. Die anderen Freunde sollen also ihre jeweiligen Rechnungspositionen abhaken, es wird die Summe gebildet, die sie bezahlen müssen, und durch Klick auf den Bezahlen-Button werden sie automatisch auf Paypal weitergeleitet, wo bereits der Empfänger und der Betrag voreingestellt sind.

**20:31 UTC**

Nenne die App billsplit und entwerfe ein ansprechendes Design.

Der Rechnugssteller soll in Echtzeit in der Digitalen Rechnung visuell illustriert direkt an den einzelnen Rechnungspositionen sehen können, wer was schon bezahlt hat. Wenn er seine eigenen Positionen markiert hat, soll er auch sehen können, welcher Betrag ihm noch von seinen Freunden fehlt.

**20:47 UTC**

Der Workflow die Screens sollen dabei so sein:

Der Rechnungssteller öffnet die billsplit App und fotografiert die Rechnung ab. Nachdem die Rechnung von der App analysiert und digitalisiert wurde, ist das Ergebnis auf seinem Handy erstmal ein großer QR Code. Durch Runterscrollen sieht auch er die digital animierte Rechnung im klassischen Rechnungsbeleg-Design. Nur eben mit Abhak-Kreisen vor den einzelnen Positionen. In seinem Profil in der billsplit App hat er seine Paypal Mailadresse hinterlegt. Diese Information ist auch in dem QR Code enthalten.

Die Freunde Scannen den QR Code mit ihrer billsplit App und sehen dann auch dieselbe digitale Rechnung, die sich über alle Teilnehmer live aktualisiert. Wenn jemand eine Rechnungsposition für sich markiert hat, soll dies entsprechend mit seinem Profilnamen markiert werden, in grüner Schrift oder so. Wenn eine Rechnungsposition (bzgl.) Anzahl der Items/Menge komplett zugeordnet wurde, soll die Rechnungsposition außerdem durchgestrichen werden.

Hat ein Teilnehmer all seine Positionen markiert, sieht er unten seine zu zahlende Summe. Durch Klick auf einen Button Bezahlen wird er direkt zur PayPal App weitergeleitet. Hier muss er sich jetzt ganz normal mit seinen Credentials einloggen, landet dann danach aber direkt in dem voreingestellten Prozessschritt mit Empfänger und Betrag und muss dann nur noch in PayPal auf bezahlen klicken.

Der Rechnungssteller markiert hingegen seine eigenen Rechnungspositionen und hat unten keinen Bezahlen Button, sondern kann dort die ausstehenden Beträge seiner Freunde sehen - dadurch, dass sie den QR Code gescannt haben, werden Sie der Rechnung als Schuldner zugeordnet und tauchen für den Rechnungssteller sofort mit ihrem Profilnamen unter der Rechnung auf. Sobald sie ihre Positionen angehakt und in der billsplit App auf bezahlen geklickt haben, wird auch der Betrag hinter ihrem Namen ergänzt. Jetzt muss der Rechnungssteller  je noch die tatsächlichen PayPal Geldeingänge mit diesen Informationen unter seiner digitalen Rechnung in billsplit abgleichen.

Die Schuldner Freunde sehen in ihrer billsplit App diese Zeilen unter der Rechnung nicht, sehr wohl hingegen in der digitalen Rechnung selbst, wenn andere Freunde schon Rechnungspositionen abgehakt haben - in Echtzeit.

**21:22 UTC**

Da der Schuldenbetrag eines Freundes zum Prozessschritt des QR Code Scannens ja noch nicht feststeht, kann es sein, dass du nachdem der Freund seine Rechnungspositionen abgehakt hat, einen PayPal Zahlungslibk erstellen musst, der den dann bekannten jeweiligen Betrag mit der Information des Zahlungsempfängers aus dem QR Code zusammenführen und in dem Bezahlen Button individuell für den jeweiligen Freund hinterlegen musst.


## 9.10.2026

**07:56 UTC**

[Screenshot]

**08:06 UTC**

(zitiert Claude:)
> Beide Commits liegen aber nur lokal in dieser Sitzung: Der Push auf claude/bill-split-qr-app-lsufvh ist fehlgeschlagen. GitHub hat mit 403 abgelehnt, weil Claude für boonwalker/billsplit keinen Zugriff hat. Verbinde dein GitHub-Konto unter https://claude.ai/connect-github neu und installiere dort ggf. die Claude GitHub App für das Repo. Danach pushe ich sofort.

Jetzt?

**08:08 UTC**

Jetzt?

**08:08 UTC**

Ja, erstell den Pull Request

**08:12 UTC**

Was genau macht ein PR und wofür brauche ich ihn?

**08:14 UTC**

Dann brauche ich doch keinen PR. Mach das. Gute rückgängig. Alle Änderungen hier können erstmal direkt in main landen

**08:14 UTC**

Ja, lösch den Branch

**08:15 UTC**

Gib mal bitte den Link zum aktuellen Stand der App jetzt

**08:16 UTC**

Ne dann mach erstmal ohne live Synchronisierung, aber ich will was sehen

**08:30 UTC**

Ändere den Text an allen entsprechenden Stellen von „Fehlt Dir noch“ in „Dir fehlen noch“

**08:39 UTC**

Wenn ich jetzt in der Demo dem Bezahlen Link Folge und dann in der PayPal App mein Passwort eingebe: Ist das sicher? Kannst du das Passwort sehen oder wird es irgendwo im GitHub oder sonst wo verzeichnet?

**08:41 UTC**

Falls kein Trinkgeld auf der Rechnung verzeichnet ist, soll der Rechnungssteller vor Erstellung des QR Codes die Möglichkeit bekommen, in % oder absolut anzugeben, wie viel Trinkgeld er gegeben hat.

**08:45 UTC**

Außerdem optional, auf wie viele Rechnungsteilnehmer das Trinkgeld aufgeteilt werden soll. Diese Information soll auch dadurch erfasst werden, wie viele Personen sich durch Scan des QR Codes der Rechnung zuordnen. Nur falls einer es bspw. erst am nächsten Tag macht, soll die Eingabe des Rechnungsstellers die erwartete Personenanzahl für die Trinkgeldaufteilung übersteuern.

**09:37 UTC**

Was muss ich tun, damit die Seite live ist, die ein QR Code zu einer konkreten Rechnung erstellt werden kann und diese sich live bzgl. der abgehakten Positionen aktualisiert?

**09:41 UTC**

Ja

**09:48 UTC**

Der günstigste Bezahltarif bei render kostet 25 Dollar pro Monat. Das ist mir zu teuer.
Was sind die konkreten Nachteile des kostenlosen Tarifs für unseren Anwendungsfall?

**09:55 UTC**

Ich glaube ich würde mal Variante B mit Railway ausprobieren. Dort gibt es eine kostenlose Version ohne Hinterlegung von Kreditkartendaten:

**10:07 UTC**

3.	Am Service ein Volume hinzufügen, als Pfad z. B. /data. Ohne Volume sind die Rechnungen nach jedem Neustart weg

Wo finde ich das?

**10:14 UTC**

billsplit-production-af2e.up.railway.app

**10:18 UTC**

Wenn ich auf der Website im Profil meinen Namen und meine PayPal Adresse speichere, dann den Tab schließe und die Seite neu aufrufe, sind meine Informationen nicht mehr da.

**11:45 UTC**

Es lag am privaten Tab in Safari. Es funktioniert jetzt.

Allerdings hat ein Test auf der Live Seite gezeigt, dass das Foto dort überhaupt nicht gut gelesen wird (nicht mal annähernd so gut wie im Claude Artifakt!!!) und auch nicht in Form der digitalen Rechnung visualisiert dort ausgegeben wird!

**11:46 UTC**

Bzw. die visuelle Darstellung folgt dort anscheinend erst nach der Rechnungsprüfung und nach Klick auf QR Code erstellen. Das ging im Artifakt doch alles schon automatisch oder?

**11:49 UTC**

Kosten (grobe Schätzung): Mit dem eingestellten Modell (Claude Opus 5.5) kostet ein Belegfoto nach meiner Rechnung etwa 2–6 Cent. Mit 5 $ kommst du also auf grob 100 Belege.

Heißt das ich muss Guthaben aufladen, aber es werden zuerst die 5 Dollar von railway verbraucht, bevor mein Guthaben angetastet wird?

**12:14 UTC**

Kostenbremse: Erlaubt sind aktuell bis zu 300 Belegfotos pro Tag. Für eure Freundesrunde ist das unnötig viel. Setz bei Railway am besten RECEIPT_LIMIT_PER_DAY=20. 

Wo finde ich das?

**12:21 UTC**

Erledigt.
Die Fotoerkennung scheint jetzt auch in der Liveveesion besser zu funktionieren. Allerdings wurde jetzt hier das Trinkgeld nicht erkannt, eben im Artefakt schon. Außerdem sollte für den Fall, das kein Trinkgeld auf der Rechnung erkannt wurde, ja dann der Bezahler explizit gefragt werden, wie viel Trinkgeld er gegeben hat. Weder noch ist jetzt in der Liveversion passiert.

**12:24 UTC**

Außerdem noch eine kleine Anpassung: Wenn man aktuell eine Rechnungsposition mit mehrfacher Anzahl anhakt und die Mengenzuteilung erscheint, ist der default, dass alle Mengen der Person zugeordnet werden, sodass man dann in den meisten Fällen auf Menge=1 runterklicken muss. Hier soll aber der default sein, dass die Annahme ist, das nur 1 Stück auf den Anhakenden entfällt und dieser dann wenn, dann eher mehrere Stück hinzufügen muss. Also quasi umgekehrt in der default Logik.

**12:33 UTC**

Das Trinkgeld wird bei Railway immer noch nicht erkannt. Außerdem steht dort auch noch „Fehlt dir noch“ und nicht „Dir fehlen noch“. Weist das auf eine ältere Version hin? Das hatten wir doch schon geändert und im Artefakt wird es auch richtig angezeigt.

**12:41 UTC**

Railway umgestellt.
GitHub umgestellt.

Alten Branch noch nicht gelöscht

**12:45 UTC**

Ich kann auf keinem deiner vorgeschlagenen Wege die Löschfunktion des alten Branches finden. Kann ich ihn auch einfach stehen lassen?

**12:49 UTC**

Positioniere die Trinkgeldeinstellung bitte etwas höher und zwar über der Rechnung, noch über „Hake deine eigenen Positionen ab“.

Den letzten Absatz unten: „Gleiche die Beträge mit den Eingängen in deiner PayPal-App ab und hake „erhalten“ an, sobald das Geld da ist“ blendest du bitte erst ein, sobald mindestens ein Freund der Rechnung zugeordnet wurde.

**12:54 UTC**

Alternativ zu Rechnung fotografieren soll auch ein Screenshot von einer digitalen Rechnung hochgeladen werden können.

**13:07 UTC**

Wenn es sich bei einem Screenshot bspw. um eine Essenslieferung handelt, sollen etwaige Liefergebühren und Servicegebühren analog zum Trinkgeld auch auf alle Teilnehmer aufgeteilt werden. Eventuell könnte man bei einer Essenbestellung (Identifikationskriterien könnten das Vorhandensein von Liefergebühren oder Servicegebühren, sowie die Artikelbeschreibungen an sich sein) den Rechnungssteller hierzu fragen: Wie viele Personen haben mitbestellt?

**13:16 UTC**

In diesem Fall eines Screenshots einer Lieferbestellung hier hast du die +2€ für die Extrazutat obendrauf addiert, obwohl sie bereits in den 13€ inhärent war. Das hättest du sowohl dadurch merken können, dass diese Unterposition leicht ausgegraut ist, als auch, wenn du wirklich mal die Gesamtsumme nachgebildet hättest - du bist nämlich bei 18,20€ ausgekommen und nicht bei den korrekten 16,20€. Darum bilde bitte wirklich immer nochmal die Summe nach, um solche Sonderpositionen zu identifizieren und zu berücksichtigen!

**13:20 UTC**

Mach die Schaltfläche Screenshot hochladen in einem leichteren grün, sodass wir die Abstufung haben von Rechnung fotografieren über Screenshot hochladen hin zu QR-Code scannen (Letztere soll so bleiben)

**13:21 UTC**

Bei den Animationen des Scannens der Rechnung bitte „KI liest den Beleg“ mit „billsplit analysiert den Beleg“ ersetzen

**13:24 UTC**

Der Button Screenshot hochladen soll direkt zur Fotomediathek führen ohne die 3 Auswahlmöglichkeiten vorher

**13:27 UTC**

Nein, lass es erstmal so.

Bei den Trinkgeldnachfragen: Ändere die Zweite Position bitte zu „Als Endbetrag“. In dem Fall berechne die Trinkgeldhöhe auch bitte als Differenz vom Endbetrag und Rechnungsbetrag.

**13:41 UTC**

Im „Deine Freunde“ Block unter der interaktiven Rechnung:

Ersetze gescannt durch beigetreten.
Oben rechts: 0 beigetreten
Dann: Noch ist niemand deiner Abrechnung beigetreten. Sobald jemand beitritt, taucht er hier mit seinem Namen auf.

**13:44 UTC**

Mach das App-Symbol für das Homescreen Lesezeichen bitte mal ein bisschen schärfer/hochauflösender

**13:59 UTC**

Wenn eine Rechnungsposition über mehrere Zeilen geht, wird die durchgestrichene Animation unsauber. Diese Muss dann auch über dieselbe Anzahl Zeilen gehen und je Zeile auf der gleichen Höhe durchstreichen, wie auch bei einer einzeiligen Rechnungsposition.

**14:02 UTC**

Bei Rechnungspositionen mit mehrfacher Menge soll die Gesamtmenge nicht überschritten werden können. Bsp.: Gesamtmenge 3, 1 wurde schon von einer anderen Person abgehakt. Eine weitere Person soll dann nur noch maximal die 2 verbleibenden Stück auf sich anrechnen können und nicht bspw. 3.

**14:24 UTC**

Der Bezahlen Button hat trotz gepflegtem PayPal.Me Profil nicht zur kompletten Durchwahl in PayPal mit voreingestellten Empfänger und Betrag geführt, sondern nur PayPal geöffnet.

**14:27 UTC**

Wenn eine Rechnungsposition mehrere Stück hat und eins dieser Stücke sich aber geteilt wurde, dann soll man in der Unterauflistung auf die einzelnen Unterpositionen klicken können (z.B. auf „Ben x1“). Dann soll auch nur diese Unterposition geteilt werden, die andere Unterposition bleibt unverändert.

**14:35 UTC**

Die Weiterleitung einer Rechnung per Link anstatt QR-Code hat eben bei einem Freund dazu geführt, dass billsplit in Safari geöffnet wurde, obwohl er billsplit als Lesezeichen 
-„App“ auf dem Homescreen hat. Über QR-Code öffnet sich direkt die App. Können wir das auch bei Weitergabe über Link erzwingen?

**14:53 UTC**

(zitiert Claude:)
> Die Namen unter einer Position lassen sich jetzt antippen. Ein Tipp auf „Ben ×1“ teilt genau eines von Bens Stücken mit Ihnen, alle anderen Stücke bleiben, wie sie sind. Ich habe das in der Demo mit 3 × Bier zu je 4,00 € durchgespielt:
>
> 	Niklas	Anna	Ben
> Jeder hat ein Bier	×1 · 4,00 €	×1 · 4,00 €	×1 · 4,00 €
> Anna tippt auf „Ben ×1“	×1 · 4,00 € (unverändert)	×1½ · 6,00 €	×½ · 2,00 €
>
> Die Beträge im Bezahl-Button passen sich mit an: 6,00 € bei Anna, 2,00 € bei Ben. Ein zweiter Tipp auf denselben Namen hebt das Teilen wieder auf, dann zahlt jeder wieder 4,00 €. Alle 62 Tests laufen durch, darunter neue für das gezielte Teilen und für bestehende Rechnungen.
>
> Was sonst noch neu ist:
>
> 	•	Erkennbarkeit: Antippbare Namen haben einen gestrichelten Rahmen, geteilte sind mintgrün hinterlegt. Der Bildschirmleser liest „Ein Stück mit Ben teilen“ bzw. „Nicht mehr mit Ben teilen“ vor.
> 	•	Anzeige: Geteilte Anteile stehen als Bruch da, z. B. „×½“ oder „×1½“. Auch der Zähler zeigt dann „1½ von 3 für dich“.
> 	•	Hinweis bei vergebenen Positionen: Wenn alle Stücke einer Mehrfach-Position vergeben sind und Sie noch keines haben, steht darunter „Alle Stück sind vergeben. Tippe auf einen Namen, um dessen Stück mit ihm zu teilen.“
> 	•	Einzelne Positionen wie eine Vorspeisenplatte teilt man weiterhin einfach durch Abhaken.
>
> Gut zu wissen:
>
> 	•	Umbau im Hintergrund: Die App merkt sich jetzt, welches einzelne Stück wem gehört, statt nur der Anzahl. Bestehende Rechnungen auf Railway werden beim nächsten Öffnen automatisch umgestellt, es geht nichts verloren.
> 	•	Gleichzeitiges Abhaken: Haken zwei Personen in genau derselben Sekunde dasselbe freie Stück ab, landen beide auf diesem Stück und teilen es. Das ist dann als „geteilt“ sichtbar und mit einem Tipp korrigierbar.
> 	•	Menge nachträglich verringern: Wenn Sie als Zahler die Menge einer Position senken, bleiben die zuerst vergebenen Stücke erhalten.
>
> Die Änderung ist auf main (37c566c), Railway baut automatisch neu, und die Demo ist aktualisiert: https://claude.ai/artifact/UDuSsFPTSGVB8QNeGYoGVZ

Jetzt wird das beim ursprünglich Anhakenden irgendwie überhaupt nicht mehr angezeigt.

**14:55 UTC**

Die Markierung wird animiert, springt dann aber wieder zurück

**15:06 UTC**

Ja passt jetzt, danke.

Wenn man derjenige ist, der ein geteiltes Gericht (oder Untermenge) zuerst anklickt, dann soll man nicht warten müssen, bis der weitere Freund auch dieselbe Position angeklickt hat und damit erst den Rechnungspositionsbetrag für einen selber halbiert. Darum soll man nachdem man eine Position angehakt hat und dann dort „Du x1“ erscheint, dann schon durch Klick auf dieses „Du x1“ den Betrag und die Menge schon halbieren können. Die App wartet dann quasi darauf, bis der Counterpart auf den Namen mit „x 1/2“ klickt. Dadurch werden die beiden als Teilende identifiziert und zusammengeführt.

**15:32 UTC**

Das mit der PayPal Durchwahl funktioniert immer noch nur bis hin zum voreingestellten Empfänger. Passe den Mit PayPal bezahlen Button dann bitte erstmal wenigstens so an, dass er den jeweiligen Betrag in die Zwischenablage kopiert.

**15:41 UTC**

Das Foto bzw. der Screenshot von der Rechnung, das/der die Grundlage für die Texterkennung war, soll zur Nachvollziehbarkeit in einem zweiten Reiter der Rechnung abgespeichert werden. Dieser Reiter soll aber nicht über ein klassisches Reiter-Design aufgerufen werden können, sondern auf der digitalen Rechnung soll ganz unten, unter „Danke & bis zum nächsten Mal“, ein kleiner unterstrichener Link „Zum Originalbeleg“ zum abgelegten Foto führen, das Grundlage für die Rechnung in billsplit war.

**15:49 UTC**

Mach das Zum Originalbeleg gerne in dem Grün, in dem du auch die Anzahl der Rechnungspositionen darstellst (z.B. 2x), damit es ein bisschen besser auffällt.

Außerdem kommt man aus dem Screen „In voller Größe anzeigen“-Screen nicht mehr zurück. Mach hier auch einen Pfeil oben links oder ein x oben rechts oder wenn man stark runter- oder hochwischt soll man auch zurück kommen.

**16:38 UTC**

Die Kopie des Betrages in die Zwischenablage scheint noch nicht zu funktionieren!

**20:11 UTC**

Baue für den Rechnungssteller einen „Gleichverteilung“-Button für bspw. Supermarktrechnungen ein. In dem Fall kann niemand einzelne Rechnungspositionen anhaken. Viel mehr soll bei allen Kostenpositionen der 1/x (x=Teilnehmer) Preis in etwas kleiner und ausgegraut vor dem Preis der originalen Rechbubgsposition eingeblendet werden.
Außerdem soll unten bei dem Gesamtpreis der Rechnung ein fast schon skizzenhafter Bruchstrich mit x im Nenner und unter oder neben dem Gesamtpreis den anteiligen Preis.

**20:27 UTC**

Der Bruchstrich unter der Gesamtsumme soll mehr wie geschwungener Bleistift aussehen. Auch die 1/x Preise sollen wie handschriftlich mit Bleistift geschrieben aussehen. Auch hinter den Preisen der einzelnen originalen Preise der einzelnen Positionen soll handschriftlich „/x“ stehen.

**20:29 UTC**

Sobald der Mit Paypal bezahlen Button zum Paypal erneut öffnen geworden ist, soll darunter auch ein „als bezahlt markieren“ Button sein

**20:31 UTC**

Du sollst anhand der Produkte und der Geschöftsbezeichnung selbst merken, ob es sich um eine Supermarktrechnung handelt. wenn dem so ist, sollst du bei Supermarktrechjungen auch immer fragen, ob items gekauft wurden, die man nicht oder nur anteilig in Rechnung stellen will. Liter Milch gekauft - nur 250ml fürs Rezept gebraucht.

**20:34 UTC**

Bei der Fechnungsauflistung soll nicht du bist eingeladen stehen sondern du schuldest

**20:46 UTC**

Baue mal folgende Funktionsweise, testweise erstmal nur bei Supermarktrechnubgen ein. Der Bezahler kann großzügig ungefähr auf der Zeilenhöhe einer Kostenposition mit dem Finger einen Schrägstrich und eine Zahl (1, 2, 3, 4, 5, …) zeichnen/ auf dem Bildschirm Schreiben. Das erkennst du auch als bspw. „geteilt durch 3“ und baust es entsprechend in die Rechnung ein.

**20:53 UTC**

Die nur teilweise in Rechnung stellen Funktion sieht gut aus. Bevor diese aber überhaupt erst in Kraft tritt, sollst du zuerst, wenn du erkannt hast, dass es sich um eine Supermarktrechnung handelt, nachfragen, ob etwas NICHT oder NUR TEILWEISE in Rechnung gestellt werden soll. 2 Button als Antwortmöglichkeits-Buttons: „Alles aufteilen“ und „Manches nicht“. Nur bei Manches nicht greift die Funktion

**21:00 UTC**

Hier soll der Button nicht QR-Code erstellen sonder Rechnung erstellen heißen.

**21:03 UTC**

Die manches nicht Funktion soll nicht so aussehen, dass man alle Artikel mit den drei Voll Teilweise Nicht Knöpfen einstellen muss. Vielmehr soll man hier schon die digitalisierte Rechbumgsanimation sehen. Bei den einzelnen Rechbungspositionen laufen verschiedene Animationen über das Blatt Papier, die verdeutlichen sollen, dass der User einfach über den Bildschirm streichen kann um eine Klstenposition durchzustreichen und somit nicht mit in Rechnung zu stellen. Oder aber ich kann / über die Preise zeichnen um /2, /3, /4 berechnen zu lassen.

**21:08 UTC**

Bei Rechnungen, die keine Supermarkt-Rechnungen sind, steht beim Trinkgeld-Dialog und im Editor weiterhin „QR-Code erstellen“. Soll ich das dort auch ändern?

Ja.

**21:18 UTC**

Wenn man die Zeichnung antippt, soll sie wieder verschwinden. Außerdem soll man durch antippen der Preise automatisch durch die unten eingestellte Teilnehmerzahl teilen. Auch das soll in einer Animation am Anfang verdeutlicht werden.

**21:25 UTC**

Die digitale Rechnung muss in dem Streichen Modus deutlich größer dargestellt werden und mehr Bildschirmflöche auch hochkant einnehmen. Das erleichtert das wegstreichen und Schreiben enorm. Auch die restliche Appoberfläche/ Hintergrunddesign in diesem Modus soll so wirken als ob man auf dem Papier des Rechnjngsbelegs mit einem Bleistift rumkritzelt.

**21:31 UTC**

Hier muss der Button Positionen nochmal prüfen weg

**21:36 UTC**

Wir nehmen die „/„ Zeichnen Funktion raus. Es gibt nur noch wegstreichen und antippen. Sowohl auf der Artikelbeschreibung als auch auf dem Einzelpreis.

**21:42 UTC**

Die Geteilt durch Einstellung in der manches nicht Funktion soll prägnanter mit einer großen Zahl in der Mitte mit Pfeil nach oben und Pfeil nach unten Einstellungsmöglichkeit im unteren Bildschirmbereich stehen. Davor ein großer / mit Bleistift gezeichnet. Es soll klar sein, dass das die Winstellungsmöglixhkeit für Antippen auf den Rechnungspositionen ist.

**21:44 UTC**

Die checkbox brauchen wir in dem Screen nicht. Alles was weder gestrichen noch geteilt wird, wird per default mit „/x“ berechnet.

**21:46 UTC**

Das mit dem auch im Hintergrund Papieriötil muss ich glaub ich zurücknehmen. Es soll schon mehr Klarheit herrschen, dass man noch in einen Prozessschrritt der vorherigen bzw. Gesamtapp eingebunden ist. Auch Optisch mehr ins Designkonzept der App insgesamt eingebettet.

**21:56 UTC**

Du musst im manches nicht Modus wieder wie in einem der ersten Entwürfe direktes visuelles Feedback von den bildschirmzeichnungen des Users geben. Diese sollen dann langsam „verblassen“ bzw. in die endgültige „durchgestrichen“ Animation übergehen.

Tippen gibt ein visuelles Feedback, so als würde man die Zahlen bzw. Buchstaben eindrücken/kompromieren und diese dann wieder aufploppen.

Antizipiere, welche Rechnungspositonen höchst wahrscheinlich keine Gemeinschaftsausgabe waren, Beispiel Duschgel, Milch, Gewürze, Klopapier, Seife, etc.
Setze dementsprechend Kostenpositionen die sehr wahrscheinlich weggestrichen werden oben auf die digitale Einkaufsliste!

**22:00 UTC**

Der Kassenbon, auf dem man in MANCHES NICHT“ rumkritzelt, soll optisch schon ein bisschen mehr wie der digitale Kassenbon in der Restaurantrechnung (bspw. Takumi) aussehen.

**22:01 UTC**

Beim wegstreichen soll alles als wegstreichen gelten. Egal in welchem Winkel man durchstreicht.

**22:03 UTC**

Das durch 2 zeichnen soll am Anfang von MANCHES NICHT“ schon ein paar mal auf 1-2 verschiedenen Rechnugspositionen animiert werden

**22:05 UTC**

Man muss doch mit einem Finger scrollen können. Abtippen bedeutet jetzt auch durchstreichen.
Demnach musst du zwischen streichen und scrollen unterscheiden.

**22:09 UTC**

Anstatt des großen „/„ vor dee Anzahl soll ein großer „:“ stehen.

**22:12 UTC**

Im Gleichverteulungsmodus soll der Bezahler in der digitalen Rechbubgsansicht vergessene Artikel doch noch Antippen können. Antippen gleich wegstreichenanimation. Beim antippen soll der Buchstabe bzw. Die Zahl optisch eingedrückt werden jbd nach loslassen wieder aufploppen.

**22:19 UTC**

Die digitale Rechnung soll in dem Bildschirm bis ganz oben zum Bildschirmrand gehen. Alle dort bisher dargestellten Kopfinformationen brauchen wir nicht. Scrollen und abtippen sind intuitiv.
Auch der bisherige untere Bbildschurmbereich kann doch deutlich verkleinert werden. Mehr Kassenbonübersicht ist wichtiger.

**22:23 UTC**

Doch wieder „/„ anstatt „:“

**22:28 UTC**

Die Scanneranimation wenn der Beleg analysiert wird hängt manchmal noch. Mach die Kassenbonansicht, über den der grüne lichtschweif fährt auch nochmal deutlich größer. Undabhängig von Größe und Format der Bilddatei soll diese Vorschau fast den ganzen Handybildschirm einnehmen - so kann der User währenddessen schon einmal einen Blick auf die Rechbung werfen. Der grüne Lichtschweif muss außerdem den Lichtnebel draggen und nicht pushen, während er von unten nach oben fährt.

**22:31 UTC**

[Screenshot]

**22:41 UTC**

Ändere den Subtext hier zu „[…] z.B. Gewürze, Duschgel, Klopapier“

**22:47 UTC**

Beim manches nicht Modus war mit kopfzeile weglassen die kopfzeile vom vorherigen Apphintergrund gemeint. Die kopfzeile des Belegs soll sehr wohl erhalten bleiben.

Beim Ladebildschirm schon so große wie möglich aber keine künstlichen Ränder wie hier oben und unten.

**22:49 UTC**

Hier soll der gleichmäßig auf alle verteilen Kasten weg. Die aktivierte Einstellung ist default.

**22:51 UTC**

„z.B. Gewürze, Duschgel, Klopapier?“

**22:53 UTC**

Hier soll im hellgrauen Text einfach nur „inkl. Dir“ stehen

**22:54 UTC**

*inklusive

**22:55 UTC**

Schreibe „Dir“ grundsätzlich immer vorne groß in der gesamten App

**23:08 UTC**

Der Link zum Originalbeleg soll grundsätzlich auf jeder digital animierten Rechnung unten sein

**23:19 UTC**

Im Button anstatt „Mit PayPal bezahlen“ „Anteil begleichen“

**23:19 UTC**

Anstatt „Weiter zu PayPal“ „Mit Paypal bezahlen • (jeweiliger Betrag)“

**23:23 UTC**

Auch im Alles Aufteilen Modus sollen nachher auf dem digitalen Kassenbon mal Animationen von antippen zum durchstreichen kommen.

**23:28 UTC**

Machen wir uns mal den Vibrationsmotor des Handys zu Nutze. Wenn man einen QR-Code scanned, soll der Übergang in die Rechnung von einem befriedigenden bestätigenden Vibrationsmuster haptisch bestätigt werden.

**23:33 UTC**

Beim Klick des Buttons Anteil begleichen soll auch ein zweigeteilter „Mausklick“ Vibrstionsstoß abgesondert werden.
Der Bezahler soll einen Vibrationsstoß bekommen, wenn ein neuer Teilnehmer der Rechnung hinzugefügt wurde.

**23:36 UTC**

Wenn sich hinter Rechnungen im Postfach ungültige Rechnungen verbergen, sollen diese aus dem Postfach verschwinden

**23:38 UTC**

Wenn sich hinter Rechnungen im Postfach ungültige Rechnungen verbergen, sollen diese aus dem Postfach verschwinden

Das bezog sich auf „Rechnung nicht gefunden“

**23:46 UTC**

Wenn eine Rechnung als bezahlt markiert ist, soll im Postfach in der Rechnung nicht mehr du schuldest stehen sondern als bezahlt markiert

**23:50 UTC**

Hier soll nicht du hast bezahlt sondern du leihst stehen.

**23:53 UTC**

Wenn der „Dir fehlen noch“ Status einer Rechnung 0,00€ ist, dann soll außerdem in Posteingang in der Rechnung „du leist • ausgeglichen“ stehen

**23:54 UTC**

auch in grün mit Haken

**23:57 UTC**

„Du hast bezahlt und willst anteilig Geld zurück“

„Für digitale Rechnungen aus App oder Mail“

„Anteil“ anstatt „Teil“


## 10.10.2026

**00:00 UTC**

Ich habe die Rechnungen in den Alps gelöscht um aufzuräumen.

Meine vorherigen Kommentare bezogen sich auf die Untertitel der drei Buttons in Hauptmenü!

**00:01 UTC**

Kriegen wir es noch irgendwie hin, dass auch ein Klick auf den Link anstatt QR-Scan direkt zur App bzw. zum Lesezeichen auf dem Homebildschirm führt und nicht in den Browser?

**00:04 UTC**

Ja.

Bzgl. 1: Diese Funktion mit Link einfügen in der billsplit App soll nur für User erscheinen, die aus dem Browser weitergeleitet wurden!

**00:09 UTC**

und zahlt mit einem Klick.

**00:12 UTC**

Ohne Trinkgeld weiter führt zu ungültiger Anfrage

**00:13 UTC**

Rechnung erstellen auch

**00:16 UTC**

inklusive dir eine Zeile hoch hinter „Einkauf?“

**00:17 UTC**

Warum stehen hier oben die beiden Buttons Foto aufnehmen und Screenshot?

**00:18 UTC**

Ja

**00:22 UTC**

Lass uns noch ein paar kleine hilfsanimationen am Anfang des digitalen Kassenbons in der nicht gleichverteilten Version. Auch hier soll die „Steuerung“ dem User einmal visuell nahegelegt werden: Wie hake ich eine Kostenposition an? Wie teile ich? Wie fordere ich zur Teilung auf?

**00:32 UTC**

Bei du leihst soll immer der wirklich aktuell noch ausstehende Betrag dahinter stehen

**00:39 UTC**

Wenn ich den Link einer Rechnung über WhatsApp teile, dann muss ich danach immer zuerst nochmal WhatsApp öffnen, damit die Nachricht auch wirklich abgeschickt wird. Das soll schon durchpusten wenn man in billsplit auf Senden klickt

**00:40 UTC**

*durch pushen

**00:49 UTC**

Die Bauchbinde macht hier beim Runterscrollen Probleme. Beim Hochscrollen sieht’s cool aus. Die Bauchbinde sollte vor allem immer am unteren Bildschirmrand gefixt bleiben. Und wenn man ganz nach unten scrollt soll sie ausgebildet werden, weil dort derselbe Informationsgehalt der Bauchbknde schon vorhanden sind.

**00:52 UTC**

Mach die Sprechblasen in der Erkläranimation in NICHT GLEICHVERTEILT weniger so auf schwarzem Hintergrund sondern heller, freundlicher. Vielleicht sogar ein bisschen aufploppende Sprechblasen im Comic Style. Die Wörter sollen auch „live geschrieben“ werden mit Bleistift.

**00:57 UTC**

„hab ich mir geteilt!“

**00:58 UTC**

„= mit (Name) teilen“

**01:01 UTC**

Ändere den Text zu „Du wartest auf jemanden“

**01:05 UTC**

Wo hier geteilt steht soll dann eigentlich „wartet auf jemanden“ stehen. „geteilt“ soll dort nur stehen, wenn wirklich eine vollständige Aufteilung zur Teilungsanfrage gekommen ist.

**01:06 UTC**

Die Erkläranimationen muss natürlich auch der Rechnungssteller bekommen. Für ihn zusätzlich noch einmal die Möglichkeit zur Streichung durch Antippen demonstrieren.

**01:14 UTC**

Ne du hast Recht, streichen brauchen wir in der Erklärung für den Ersteller gar nicht, da es gleichbedeutend mit für sich anhaken ist.

**01:21 UTC**

In dieser Kombination von „Du“ und „wartet“ soll stattdessen „wartest“ stehen

**01:26 UTC**

In dem Fall führt ein Klick auf den unteren Niklas Button wieder dazu dass die Gesamtproduktion abgehakt wird, aber dann wieder zurückspringt!

**01:31 UTC**

*Gesamtposition

**01:43 UTC**

In diesen Fällen, Katia hat die Position schon übernommen und damit die Gesamtposition ausgeglichen, soll der Abhak-Kreis vorne verschwinden, da ja de facto nur noch ein Teilen möglich wäre - sprich Klick auf Katia

**01:53 UTC**

Auch im MANCHES NICHT oben über dem digitalen Beleg „Gleichverteilungs Toggle“

**01:57 UTC**

Wie könnte man weitere Zahlungsapps anbinden?

**02:01 UTC**

Was ist mit Trade Republic?

**02:03 UTC**

Ja

**02:06 UTC**

[Screenshot]

**02:39 UTC**

In MANCHES NICHT müssen Rechnungspositionen mit mehrfacher Menge auch nur Untermengen weggestrichen werden können.

**02:49 UTC**

Eine Sprechblase soll niemals auf eine Rechnungsposition ohne Anhakkreis davor zeigen

**13:41 UTC**

Ändere die eine Sprechblase: Eigenen Namen antippen = Du willst mit jemandem teilen

**13:42 UTC**

Nachdem die Sprechblasenanimationen durchgelaufen sind, bleibt dieser Animationsfehler zurück

**13:59 UTC**

In „Supermarktrechnung > Alles aufteilen“ fehlt beim Wegstreichen noch die Möglichkeit von bspw. „2x“ nur „1x“ wegzustreichen

**14:10 UTC**

In dem Fall soll auch „Kl. Papiertasche“ noch gestrichen werden können. Gebühren, Trinkgelder sollen analog zu regulären Rechnungspositionen vom Rechnungssteller auch in der fertigen Rechnung noch gestrichen werden können.

Zwischensumme, Summe, Zwischenbetrag, (End-)Betrag natürlich nicht.

**14:14 UTC**

Aktuell wird taucht bspw. die Papiertasche erst in der fertig erstellten Rechnung auf. Sie soll bei MANCHES NICHT aber auch schon im vorherigen Editiermodus als Gebühr nach einer Zwischensumme zum etwaigen Wegstreichen auf dem digitalen Kassenbon erscheinen.

**14:16 UTC**

Kannst du bei „Screenshot hochladen“ die Option „Foto aufnehmen“ rausnehmen?

**14:20 UTC**

Die Sprechblasenanimation darf niemals laufen, während der Gleichverteilungs-Toggle aktiviert ist

**14:27 UTC**

Bei gedrückt halten einer Rechnungsposition soll sich für den Rechnungssteller eine Einstellungsmöglichkeit für diese Rechnungsposition öffnen im Design des großen „/?“ mit Pfeil nach oben und unten (wie beim Editiermodus nach MANCHES NICHT). Einstellungsmöglichkeit /2 bis /5.

z.B.: Den Liter Milch will ich nur zur Hälfte für die Aufteilung /x berechnen. Die andere Hälfte nehme ich auf mich.

**14:30 UTC**

Sich diese neue Funktion muss dem Rechnungssteller im Editiermodus einmal gezeigt werden.
* Auch diese neue Funktion…

**14:39 UTC**

Mach hier das Roller-Emoji oben weg.

Füge bei Trinkgeld den Reiter „absolut“ hinzu. An die erste Stelle. „absolut“, „in Prozent“, „als Endbetrag“.

**14:42 UTC**

Wenn ein Supermarkteinkauf erkannt wurde, soll neben „Alles aufteilen“ und „Manches nicht“ noch ein dritter Button „Jeder selber abhaken“ erscheinen. Dieser führt dann direkt zu erstellten Rechnung mit deaktivierter Gleichverteilung
Wenn im Editiermodus von MANCHES NICHT vom Rechnungssteller etwas weggestrichen wird, soll die weggestrichene Position auf der darauffolgenden fertig erstellten Rechnung in der Liste nach ganz unten wandern.

**14:44 UTC**

Gedrückt halten einer Position führt zur Textauswahl/Markierung. Können wir das unterbinden?

**14:47 UTC**

Nachdem ein item nur teilweise in Rechnung gestellt wurde, soll ein verhältnismäßig präziser Klick direkt auf das „/2“ (in diesem Fall „2“ bei Vanille) nicht zu einem Streichen der Gesamtposition führen, sondern zum Aufheben des „/2“.

**14:55 UTC**

Bei der Anfangsanimation in MANCHES NICHT und ALLES AUFTEILEN reicht eine Durchstreichanimation ohne visuelles vorheriges antippen, eine Durchstreichanimation mit visuellem vorherigen Antippen und eine Gedrückthaltanimatiom im Loop. Eine Durchstreichanimation bitte nicht auf Rechnungspositionen mit mehrfacher Menge durchführen.

**15:00 UTC**

Sprechblase: nur einen Teil in Rechnung stellen

**15:09 UTC**

In dieser Situation will Niklas offenbar den House Salad teilen und wartet auf jemanden. Ein Freund soll in diesem Fall auch durch Klick auf den Abhak-Kreis die andere Hälfte übernehmen können und nicht nur durch Klick auf den Namen Niklas

**15:21 UTC**

Nachdem man das erste Mal bei PayPal war, verdeckt die Binde unten den Link zum Originalbeleg auf dem digitalen Kassenbon. Dieser muss - wie vor dem ersten Absprug zu PayPal auch - komplett über die Binde geschoben werden können aus so einrasten können, dass die untere „abgerissene“ Animation des digitalen Kassenbons über der Binde bleibt.

**15:27 UTC**

Setz hier die Spitze der Sprechblase gerne auch wirklich an den Abhakpunkt

**15:31 UTC**

Ändere hier den Text zu:
„xx,xx € in die Zwischenablage kopiert —„
Zeilenumbruch
„in PayPal in Betragsfeld tippen und „Einfügen“ wählen.“

**15:42 UTC**

in PayPal ins Betragsfeld tippen und „Einfügen“ wählen.

Mach diese Wörter in der Schriftgröße minimal kleiner, sodass sie in der App in eine Zeile passen.

**16:15 UTC**

Soll etwas nicht oder nur teilweise in Rechnung gestellt werden?
Zeilenumbruch
Dann in etwas kleiner: “z.B. Gewürze, Duschgel, Pfand?”

**16:23 UTC**

Auch diese Sprechblase soll nie auf eine Rechnungsposition mit mehrfacher Menge zeigen.

**16:29 UTC**

Der Ladebildschirm soll nach Klick auf “Rechnung erstellen“ nie dieser Scan-Ladebildschirm von der Texterkennung sein. Stattdessen soll, wenn es nach Klick auf Rechnung erstellen eines Ladebildschirms bedarf, dort einfach diese 3 Ladepunkte gezeigt werden mit dem Text „billsplit generiert die interaktive Rechnung“ darunter.

**16:50 UTC**

Im Jeder selber Abhaken Modus soll es die Funktion mit gedrückt halten für den Rechnungsersteller nicht geben.

Jedoch auch in der fertig generierten Rechnung muss ein „/2“ von nur zur Hälfte in Rechnung gestellten Artikel vom Rechbubgssteller wieder weggeblickt werden können, wenn präzise auf „/2“ geklickt wird. In dem Fall dann also nicht die ganze Kostenposition streichen, wie auch vorhin im Editiermodus umgesetzt.

**17:08 UTC**

Lass uns mal anfangen ein Dashboard zu bauen, dass über eine Schaltfläche unter der Rechnungslistebaufgerufenbweren kann.

Dort soll zunächst in einem Kreisdoagramm dargestellt werden, ob man intern Strich über alle Rechnungen hinweg mehr Geld leiht oder schuldet.

Darunter dann auch Einzelbilanzen mit Personen, mit denen man in seinen Rechnungen in Kontakt steht.

**17:15 UTC**

Die Einzelbilanzen sollen in Form von kleineren Kreisdisgrammen dargestellt werden

**17:16 UTC**

[Screenshot]

**17:16 UTC**

[Screenshot]

**17:20 UTC**

Würdest du es hinkriegen, in diesen Verrechnungslogiken auch direkt in den Freundesunterbilanzen Absprünge zu PayPal einzubauen? Jegliche Zahlungsbewegungen hier müssten natürlich 100% korrekt den einzelnen Rechnungen zugeordnet werden und in den einzelnen Rechnungen korrekt als bezahlt markiert werden, und das Signal an den Rechnungssteller in der Rechnung gesendet werden.

**17:29 UTC**

Können wir jetzt noch on top eine die Anzahl an Ausgleichszahlungen minimierende Gesamtverrechnungslogik implementieren, die es ermöglicht, oben auf der Gesamtbilanz mit möglichst wenigen, verrechneten, gebündelten Zahlungsvorgängen an möglichst wenig verschiedene Freunde die Gesamtbilanz auszugleichen? Dabei sollen Schulden von mehreren Freunden untereinander berücksichtigt und verrechnet werden nach der Logik: Wenn ich Andy 5€ schulde und Andy aber Katia auch 5€ schuldet, dann kann ich meine 5€ auch direkt an Katia schicken, so dass meine Zahlung mich, Andy und Katia settled.

**17:47 UTC**

Ersetze das Emoticon durch das billsplit Logo, wenn jemand auf den WhatsApp Link geklickt hat im Browser.

**17:47 UTC**

Hier muss die Binde des eingeblendeten Hinweises optisch klarer vom Apphintergrund abgegrenzt werden. Mit einer schwarzen Umrandung oder wie auch immer. Der Hinweis muss dem User stärker ins Auge springen.

**17:47 UTC**

Die Liveanzeige oben rechts soll zusätzlich die Anzahl der Personen anzeigen, die sich gerade in der jeweiligen Rechnung befinden, also die App geöffnet haben und sich gerade in der jeweiligen Rechnung befindet/ klickt/ arbeitet.

**17:47 UTC**

Positionen bearbeiten in etwas kleinerer Schrift, sodass der Button genauso groß ist wie der von Link teilen

**17:50 UTC**

Die Schrift in der Sprechblase darf sich deutlich schneller aufbauen. Generell dürfen die Animationen ein bisschen zügiger ablaufen, bspw. die Durchstreichanimation

**17:55 UTC**

Die Bilanzanzeige im Dashboard soll schon so in Echtzeit sein, dass sich bspw. der geschuldete Betrag in der Ansicht des Schuldners der geschuldete Betrag von 6,17€ auf 5,47€ reduziert, wenn der Rechnugssteller in der Live Rechnung die Creme Brulee wegstreicht.

**18:13 UTC**

Die Liveanzeige oben rechts soll zusätzlich die Anzahl der Personen anzeigen, die sich gerade in der jeweiligen Rechnung befinden, also die App geöffnet haben und sich gerade in der jeweiligen Rechnung befindet/ klickt/ arbeitet.

Reines App geöffnet haben soll doch schon reichen um als Live gezählt zu werden, egal in welcher oder keiner Rechnung sich welcher User gerade befindet.

**18:55 UTC**

Daneben auch noch das ausgeschriebene billsplit Logo

**19:13 UTC**

Immer, wenn ein User oben bei einer fertig generierten Rechnung den QR Code oder den WhatsApp Button sieht, soll der digital animierte Kassenbon mit den Zacken schonmal in einer Animation so hochgezogen werden in das Sichtfeld des Users hinein, um ihn darauf aufmerksam zu machen, dass die interaktive digitale Rechnung schon fertig ist.

**19:22 UTC**

Immer, wenn es sich bei der Rechnung um eine aktive Abhaken-Rechnung handelt, soll hier „interaktive“ anstatt „digitale“ stehen

**19:27 UTC**

Das mit der Kassenbon wird hochgezogen Animation immer nur beim ersten Öffnen einer neuen Fertig generierten Rechbung. Und auch immer nur einmal, bis man zur eigentlichen Position des digitalen Kassenbons runtergescrollt hat. Der Schnipsel, der vorher hochgezogen wurde soll dabei realistisch beim erstmaligen Runterscrollen in die eigentliche Position des digitalen Kassenbons übergehen. Das ist dann auch ExitPunkt für die Animation und diese wird dann in dieser Rechnung ja auch nicht mehr angezeigt werden.

**19:30 UTC**

Bei Rechnungen, auf denen jeder selbst abhakt, steht in der Vorschau jetzt „Deine interaktive Rechnung ist fertig ↓“. Bei Gleichverteilung bleibt es bei „digitale“.

Wobei für den Rechnugssteller ja jede Art von Rechnung interaktiv ist. Das bitte berücksichtigen.

**19:31 UTC**

Kannst du hier oben den Strich irgendwie optisch loswerden?

**19:36 UTC**

Kannst du theoretisch das KI Modell bzw. Dessen Aufwand bei der Fotoerkennung erhöhen? Und könnte man dadurch die Treffsicherheit der Texterkennung  erhöhen oder sogar die Geschwindigkeit erhöhen/ Ladedauer verkürzen?

**19:40 UTC**

Welche Konsequenzen hätte das bei unserem aktuell Hosting bzgl. Serverkapazitäten, Anthropic API Tokens Verbrauch etc.?

**19:55 UTC**

Explain to me like I‘m 5:

Modelleinstellungen für Fotoerkennung so lassen, oder Aufwand auf high, Aufwand auf High UND Schnellmodus, oder NUR Schnellmodus?

**20:00 UTC**

Nein, Modelleinstellungen erstmal so lassen.

**20:18 UTC**

Kannst du noch irgendein Verbesserungspotenzial an unserem bisherigen Appaufbau oder Prozess erkennen?

**20:21 UTC**

Kannst du mal alles, was wir bisher gemeinsam erarbeitet haben so absichern, dass wir im Falle, dass die Kontextkapazität hier irgendwann mal ausgeschöpft sein sollte, in einem neuen Projekt oder in einem anderen Kontext hieran weiterarbeiten könnten?
