/** English and Spanish texts (keyed by the German original), see src/i18n/index.ts. */
export default {
  en: {
    "Rabatt auf jede Position": "Discount on every item",
    "Trinkgeld auf jede Position": "Tip on every item",
    // src/pages/BillPage.tsx
    "Beitreten fehlgeschlagen.": "Couldn't join.",
    "Rechnung nicht gefunden": "Bill not found",
    "Der Link ist ungültig oder die Rechnung ist abgelaufen.": "The link is invalid or the bill has expired.",
    "Lädt": "Loading",
    "Speichern fehlgeschlagen.": "Saving failed.",
    "Konnte Zahlung nicht vermerken.": "Couldn't record the payment.",
    "<b>{name}</b> hat bezahlt.": "<b>{name}</b> paid.",
    "Die Rechnung wird gleichmäßig auf alle verteilt – Du musst nichts abhaken.":
      "The bill is split equally among everyone – you don't need to tick anything off.",
    "Hake ab, was Du hattest – alle sehen live, wer was übernimmt.": "Tick off what you had – everyone sees live who's taking what.",
    "Hake Deine eigenen Positionen ab:": "Tick off your own items:",
    "Etwas war nicht für alle? Tippe es an, um es zu streichen – nochmal tippen holt es zurück.":
      "Something wasn't for everyone? Tap it to cross it out – tap again to bring it back.",

    // src/components/Receipt.tsx
    "{line} – gestrichen, antippen zum Wiederaufnehmen": "{line} – crossed out, tap to add it back",
    "{line} – antippen zum Streichen": "{line} – tap to cross out",
    "à {price}": "{price} each",
    "Anteil pro Person": "Share per person",
    "Eins weniger": "One less",
    "{units} von {qty} für Dich": "{units} of {qty} for you",
    "Eins mehr": "One more",
    "Du": "You",
    "Doch nicht teilen": "Don't share after all",
    "Zum Teilen freigeben und nur die Hälfte zahlen": "Offer to share and pay only half",
    "Nicht mehr mit {name} teilen": "Stop sharing with {name}",
    "Ein Stück mit {name} teilen": "Share one with {name}",
    "geteilt": "shared",
    "wartest auf jemanden": "are waiting for someone",
    "wartet auf jemanden": "is waiting for someone",
    "Du zahlst von einem Stück nur die Hälfte. Die andere Hälfte bleibt offen, bis jemand auf Deinen Namen tippt.":
      "You pay only half of one item. The other half stays open until someone taps your name.",
    "Du zahlst die Hälfte. Die andere Hälfte bleibt offen, bis jemand auf Deinen Namen tippt.":
      "You pay half. The other half stays open until someone taps your name.",
    "{name} möchte teilen – tippe auf den Kreis oder den Namen, um die andere Hälfte zu übernehmen.":
      "{name} wants to share – tap the circle or the name to take the other half.",
    "Alle Stück sind vergeben. Tippe auf einen Namen, um ein Stück zu teilen.": "All items are taken. Tap a name to share one.",
    "{total} geteilt durch {people} ist {share} pro Person": "{total} divided by {people} is {share} per person",
    "pro Person": "per person",
    "Vielleicht nicht für alle?": "Maybe not for everyone?",
    "Für alle": "For everyone",
    "Digitale Rechnung": "Digital bill",
    "Rechnung": "Bill",
    "bezahlt von {name}": "paid by {name}",
    "Artikel": "Item",
    "Zwischensumme": "Subtotal",
    "Trinkgeld": "Tip",
    "Trinkgeld {percent} %": "Tip {percent}%",
    "Gebühren & Trinkgeld ÷ {count} Personen": "Fees & tip ÷ {count} people",
    "Gebühren ÷ {count} Personen": "Fees ÷ {count} people",
    "Trinkgeld ÷ {count} Personen": "Tip ÷ {count} people",
    "je {amount}": "{amount} each",
    "SUMME": "TOTAL",
    "Gleichmäßig auf {people} Personen verteilt": "Split equally among {people} people",
    "Geht komplett an eine Person": "All of it goes to one person",
    "{assigned} von {count} Positionen vollständig zugeordnet": "{assigned} of {count} items fully assigned",
    "Danke & bis zum nächsten Mal!": "Thank you & see you next time!",
    "Zum Originalbeleg": "View original receipt",

    // src/components/bill/QrHero.tsx
    "Überweisung": "Bank transfer",
    "QR-Code zum Teilen": "QR code to share",
    "Rechnung bereit": "Bill ready",
    "Lass Deine Freunde scannen": "Let your friends scan",
    "QR-Code zur Rechnung": "QR code for the bill",
    "Enthält die Rechnung und Deine Zahlungsdaten{payment}.": "Contains the bill and your payment details{payment}.",
    "Demo ohne Server: Auf anderen Handys öffnet der Code noch keine Rechnung. Schalte oben auf Anna oder Ben, um die Sicht Deiner Freunde zu sehen.":
      "Demo without a server: on other phones the code doesn't open a bill yet. Switch to Anna or Ben at the top to see your friends' view.",
    "Ich habe „{title}“ bezahlt – hier kannst Du Deinen Anteil abhaken und begleichen: {url}":
      "I paid for “{title}” – here you can tick off your share and settle it: {url}",
    "Per WhatsApp senden": "Send via WhatsApp",
    "✓ Link kopiert": "✓ Link copied",
    "Link teilen": "Share link",
    "Positionen bearbeiten": "Edit items",
    "Deine interaktive Rechnung": "Your interactive bill",

    // src/components/bill/LiveBadge.tsx
    "Live verbunden · {count} Person hat die App gerade offen": "Connected live · {count} person has the app open right now",
    "Live verbunden · {count} Personen haben die App gerade offen": "Connected live · {count} people have the app open right now",
    "Live verbunden": "Connected live",
    "Verbinde …": "Connecting …",
    "{count} online": "{count} online",

    // src/components/bill/ReceiptPeek.tsx
    "Zur interaktiven Rechnung": "Go to the interactive bill",
    "Deine interaktive Rechnung ist fertig ↓": "Your interactive bill is ready ↓",

    // src/components/bill/OwnerBar.tsx
    "Dir fehlen noch": "You're still owed",
    "{tapped} von {count} haben auf Bezahlen getippt": "{tapped} of {count} have tapped Pay",

    // src/components/ClaimDemo.tsx (speech bubbles)
    "Antippen = abhaken": "Tap = tick off",
    "Namen antippen = mit {name} teilen": "Tap a name = share with {name}",
    "„Du“ antippen = Du willst mit jemandem teilen": "Tap “You” = you want to share with someone",

    // src/components/ReceiptDemo.tsx
    "Gedrückt halten = nur einen Teil in Rechnung stellen": "Press and hold = only bill part of it",

    // src/components/GestureHelp.tsx
    "Antippen": "Tap",
    "abhaken": "tick off",
    "Namen antippen": "Tap a name",
    "mit dieser Person teilen": "share with that person",
    "„Du“ antippen": "Tap “You”",
    "Du willst mit jemandem teilen": "you want to share with someone",
    "bei mehrfacher Menge weniger oder mehr nehmen": "take fewer or more of an item with several units",
    "streichen – nochmal tippen holt es zurück": "cross out – tap again to bring it back",
    "Gedrückt halten": "Press and hold",
    "nur einen Teil in Rechnung stellen": "only bill part of it",
    "Gesten ausblenden": "Hide gestures",
    "Welche Gesten gibt es?": "Which gestures are there?",

    // src/components/DivisorSheet.tsx
    "{name} nur anteilig berechnen": "Bill only part of {name}",
    "Nur einen Teil davon aufteilen – den Rest trägst Du selbst.": "Split only part of it – you cover the rest yourself.",
    "Wer hatte das?": "Who had this?",
    "Antippen = direkt zuordnen · mehrere = teilen": "Tap = assign directly · several = share",
    "Nur einen Teil aufteilen": "Split only part of it",
    "jemandem direkt zuordnen oder nur einen Teil in Rechnung stellen": "assign it to someone directly or only bill part of it",
    "Geteilt durch": "Divided by",
    "Kleinerer Teil": "Smaller part",
    "Größerer Teil": "Larger part",
    "Wird ganz aufgeteilt: <b>{amount}</b>": "Split in full: <b>{amount}</b>",
    "Aufgeteilt werden <b>{billed}</b> statt {full} – {rest} trägst Du.": "<b>{billed}</b> gets split instead of {full} – you cover {rest}.",
    "Übernehmen@@Teiler": "Apply",

    // src/components/DivideBy.tsx
    "Alles geteilt durch": "Everything divided by",
    "Eine Person mehr": "One more person",
    "Eine Person weniger": "One person fewer",

    // src/components/InkLayer.tsx
    "Fläche zum Durchstreichen und Antippen der Zeilen": "Area for crossing out and tapping the lines",
  } as Record<string, string>,
  es: {
    "Rabatt auf jede Position": "Descuento en cada artículo",
    "Trinkgeld auf jede Position": "Propina en cada artículo",
    // src/pages/BillPage.tsx
    "Beitreten fehlgeschlagen.": "No se ha podido unir a la cuenta.",
    "Rechnung nicht gefunden": "Cuenta no encontrada",
    "Der Link ist ungültig oder die Rechnung ist abgelaufen.": "El enlace no es válido o la cuenta ha caducado.",
    "Lädt": "Cargando",
    "Speichern fehlgeschlagen.": "No se ha podido guardar.",
    "Konnte Zahlung nicht vermerken.": "No se ha podido registrar el pago.",
    "<b>{name}</b> hat bezahlt.": "<b>{name}</b> ha pagado.",
    "Die Rechnung wird gleichmäßig auf alle verteilt – Du musst nichts abhaken.":
      "La cuenta se reparte a partes iguales entre todos: no tienes que marcar nada.",
    "Hake ab, was Du hattest – alle sehen live, wer was übernimmt.": "Marca lo que has tomado: todos ven en directo quién se queda con qué.",
    "Hake Deine eigenen Positionen ab:": "Marca tus propios artículos:",
    "Etwas war nicht für alle? Tippe es an, um es zu streichen – nochmal tippen holt es zurück.":
      "¿Algo no era para todos? Tócalo para tacharlo; vuelve a tocarlo para recuperarlo.",

    // src/components/Receipt.tsx
    "{line} – gestrichen, antippen zum Wiederaufnehmen": "{line} – tachado, toca para recuperarlo",
    "{line} – antippen zum Streichen": "{line} – toca para tacharlo",
    "à {price}": "{price}/ud.",
    "Anteil pro Person": "Parte por persona",
    "Eins weniger": "Uno menos",
    "{units} von {qty} für Dich": "{units} de {qty} para ti",
    "Eins mehr": "Uno más",
    "Du": "Tú",
    "Doch nicht teilen": "Al final no compartir",
    "Zum Teilen freigeben und nur die Hälfte zahlen": "Ofrecer para compartir y pagar solo la mitad",
    "Nicht mehr mit {name} teilen": "Dejar de compartir con {name}",
    "Ein Stück mit {name} teilen": "Compartir una unidad con {name}",
    "geteilt": "compartido",
    "wartest auf jemanden": "esperas a alguien",
    "wartet auf jemanden": "espera a alguien",
    "Du zahlst von einem Stück nur die Hälfte. Die andere Hälfte bleibt offen, bis jemand auf Deinen Namen tippt.":
      "Pagas solo la mitad de una unidad. La otra mitad queda pendiente hasta que alguien toque tu nombre.",
    "Du zahlst die Hälfte. Die andere Hälfte bleibt offen, bis jemand auf Deinen Namen tippt.":
      "Pagas la mitad. La otra mitad queda pendiente hasta que alguien toque tu nombre.",
    "{name} möchte teilen – tippe auf den Kreis oder den Namen, um die andere Hälfte zu übernehmen.":
      "{name} quiere compartir: toca el círculo o el nombre para quedarte con la otra mitad.",
    "Alle Stück sind vergeben. Tippe auf einen Namen, um ein Stück zu teilen.":
      "Todas las unidades están cogidas. Toca un nombre para compartir una.",
    "{total} geteilt durch {people} ist {share} pro Person": "{total} entre {people} son {share} por persona",
    "pro Person": "por persona",
    "Vielleicht nicht für alle?": "¿Quizá no para todos?",
    "Für alle": "Para todos",
    "Digitale Rechnung": "Cuenta digital",
    "Rechnung": "Cuenta",
    "bezahlt von {name}": "pagado por {name}",
    "Artikel": "Artículo",
    "Zwischensumme": "Subtotal",
    "Trinkgeld": "Propina",
    "Trinkgeld {percent} %": "Propina {percent} %",
    "Gebühren & Trinkgeld ÷ {count} Personen": "Cargos y propina ÷ {count} personas",
    "Gebühren ÷ {count} Personen": "Cargos ÷ {count} personas",
    "Trinkgeld ÷ {count} Personen": "Propina ÷ {count} personas",
    "je {amount}": "{amount} cada uno",
    "SUMME": "TOTAL",
    "Gleichmäßig auf {people} Personen verteilt": "Repartido a partes iguales entre {people} personas",
    "Geht komplett an eine Person": "Todo corresponde a una persona",
    "{assigned} von {count} Positionen vollständig zugeordnet": "{assigned} de {count} artículos asignados por completo",
    "Danke & bis zum nächsten Mal!": "¡Gracias y hasta la próxima!",
    "Zum Originalbeleg": "Ver ticket original",

    // src/components/bill/QrHero.tsx
    "Überweisung": "Transferencia",
    "QR-Code zum Teilen": "Código QR para compartir",
    "Rechnung bereit": "Cuenta lista",
    "Lass Deine Freunde scannen": "Deja que tus amigos lo escaneen",
    "QR-Code zur Rechnung": "Código QR de la cuenta",
    "Enthält die Rechnung und Deine Zahlungsdaten{payment}.": "Contiene la cuenta y tus datos de pago{payment}.",
    "Demo ohne Server: Auf anderen Handys öffnet der Code noch keine Rechnung. Schalte oben auf Anna oder Ben, um die Sicht Deiner Freunde zu sehen.":
      "Demo sin servidor: en otros móviles el código todavía no abre ninguna cuenta. Cambia arriba a Anna o Ben para ver lo que ven tus amigos.",
    "Ich habe „{title}“ bezahlt – hier kannst Du Deinen Anteil abhaken und begleichen: {url}":
      "He pagado «{title}»: aquí puedes marcar tu parte y pagarla: {url}",
    "Per WhatsApp senden": "Enviar por WhatsApp",
    "✓ Link kopiert": "✓ Enlace copiado",
    "Link teilen": "Compartir enlace",
    "Positionen bearbeiten": "Editar artículos",
    "Deine interaktive Rechnung": "Tu cuenta interactiva",

    // src/components/bill/LiveBadge.tsx
    "Live verbunden · {count} Person hat die App gerade offen": "Conectado en directo · {count} persona tiene la app abierta ahora",
    "Live verbunden · {count} Personen haben die App gerade offen": "Conectado en directo · {count} personas tienen la app abierta ahora",
    "Live verbunden": "Conectado en directo",
    "Verbinde …": "Conectando …",
    "{count} online": "{count} en línea",

    // src/components/bill/ReceiptPeek.tsx
    "Zur interaktiven Rechnung": "Ir a la cuenta interactiva",
    "Deine interaktive Rechnung ist fertig ↓": "Tu cuenta interactiva está lista ↓",

    // src/components/bill/OwnerBar.tsx
    "Dir fehlen noch": "Aún te deben",
    "{tapped} von {count} haben auf Bezahlen getippt": "{tapped} de {count} han tocado «Pagar»",

    // src/components/ClaimDemo.tsx (speech bubbles)
    "Antippen = abhaken": "Toca = marcar",
    "Namen antippen = mit {name} teilen": "Toca un nombre = compartir con {name}",
    "„Du“ antippen = Du willst mit jemandem teilen": "Toca «Tú» = quieres compartir con alguien",

    // src/components/ReceiptDemo.tsx
    "Gedrückt halten = nur einen Teil in Rechnung stellen": "Mantén pulsado = cobrar solo una parte",

    // src/components/GestureHelp.tsx
    "Antippen": "Toca",
    "abhaken": "marcar",
    "Namen antippen": "Toca un nombre",
    "mit dieser Person teilen": "compartir con esa persona",
    "„Du“ antippen": "Toca «Tú»",
    "Du willst mit jemandem teilen": "quieres compartir con alguien",
    "bei mehrfacher Menge weniger oder mehr nehmen": "coger menos o más si hay varias unidades",
    "streichen – nochmal tippen holt es zurück": "tachar; vuelve a tocar para recuperarlo",
    "Gedrückt halten": "Mantén pulsado",
    "nur einen Teil in Rechnung stellen": "cobrar solo una parte",
    "Gesten ausblenden": "Ocultar gestos",
    "Welche Gesten gibt es?": "¿Qué gestos hay?",

    // src/components/DivisorSheet.tsx
    "{name} nur anteilig berechnen": "Cobrar solo una parte de {name}",
    "Nur einen Teil davon aufteilen – den Rest trägst Du selbst.": "Reparte solo una parte: el resto lo pagas tú.",
    "Wer hatte das?": "¿Quién tomó esto?",
    "Antippen = direkt zuordnen · mehrere = teilen": "Toca = asignar directamente · varios = compartir",
    "Nur einen Teil aufteilen": "Repartir solo una parte",
    "jemandem direkt zuordnen oder nur einen Teil in Rechnung stellen": "asignarlo directamente a alguien o cobrar solo una parte",
    "Geteilt durch": "Dividido entre",
    "Kleinerer Teil": "Parte más pequeña",
    "Größerer Teil": "Parte más grande",
    "Wird ganz aufgeteilt: <b>{amount}</b>": "Se reparte entero: <b>{amount}</b>",
    "Aufgeteilt werden <b>{billed}</b> statt {full} – {rest} trägst Du.": "Se reparten <b>{billed}</b> en lugar de {full}; {rest} los pagas tú.",
    "Übernehmen@@Teiler": "Aplicar",

    // src/components/DivideBy.tsx
    "Alles geteilt durch": "Todo dividido entre",
    "Eine Person mehr": "Una persona más",
    "Eine Person weniger": "Una persona menos",

    // src/components/InkLayer.tsx
    "Fläche zum Durchstreichen und Antippen der Zeilen": "Zona para tachar y tocar las líneas",
  } as Record<string, string>,
};
