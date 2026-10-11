import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { codeMail, greeting, welcomeMail } from "../server/mail";
import { RateLimiter } from "../server/rateLimit";
import { BillStore } from "../server/store";

const FROM = "klicksplit <code@klicksplit.de>";

describe("mails in the reader's language", () => {
  it("writes the code mail in English and Spanish", () => {
    const en = codeMail("482913", FROM, undefined, "Anna", undefined, "en");
    expect(en.subject).toBe("Your klicksplit code: 482913");
    expect(en.html).toContain('<html lang="en">');
    expect(en.html).toContain(">Hi Anna,</p>");
    expect(en.html).toContain("Here's your code for klicksplit:");
    expect(en.html).toContain(">One pays.</div>");
    expect(en.html).toMatch(/color:#3ddc97">Everyone splits\.<\/div>/);
    expect(en.text).toContain("It's valid for 15 minutes.");
    expect(en.text).toContain("One pays.\nEveryone splits.");

    const es = codeMail("482913", FROM, undefined, "Ana", undefined, "es");
    expect(es.subject).toBe("Tu código de klicksplit: 482913");
    expect(es.html).toContain(">Hola, Ana:</p>");
    expect(es.html).toContain(">Uno paga.</div>");
    expect(es.html).toContain(">Todos dividen.</div>");
    expect(es.html).toContain('<b style="color:#1b1f1c">15 minutos</b>');

    for (const mail of [en, es]) {
      for (const german of ["Dein Code", "Einer zahlt", "Alle splitten", "Wenn Du", "Minuten", "Tippe"]) {
        expect(mail.html).not.toContain(german);
        expect(mail.text).not.toContain(german);
        expect(mail.subject).not.toContain(german);
      }
    }
  });

  it("writes the welcome mail in English and Spanish, demo receipt included", () => {
    const en = welcomeMail(FROM, "https://klicksplit.de", undefined, "Anna", undefined, "en");
    expect(en.subject).toBe("Welcome to klicksplit!");
    expect(en.html).toContain(">Hi Anna,</p>");
    expect(en.html).toContain("Shower gel");
    expect(en.html).toContain("Olive oil");
    expect(en.html).toContain("To be split");
    expect(en.html).toContain('<span class="ks-a ks-sum0">€16.13</span>');
    expect(en.html).toContain("<br>3.95</span>");
    expect(en.html).toContain("Open <b>klicksplit.de</b> in your browser");
    expect(en.html).toContain(">Open klicksplit.de</a>");
    expect(en.text).toContain("1. Open klicksplit.de in your browser");
    expect(en.text).toContain("One pays.\nEveryone splits.");

    const es = welcomeMail(FROM, "https://klicksplit.de", undefined, undefined, undefined, "es");
    expect(es.subject).toBe("¡Te damos la bienvenida a klicksplit!");
    expect(es.html).toContain(">Hola:</p>");
    expect(es.html).toContain("Gel de ducha");
    expect(es.html).toContain("Aceite de oliva");
    expect(es.html).toContain("Se reparte");
    expect(es.html).toMatch(/class="ks-a ks-sum0">16,13 €<\/span>/);
    expect(es.html).toContain(">Uno paga.</div>");
    expect(es.html).toContain(">Todos dividen.</div>");

    for (const mail of [en, es]) {
      for (const german of ["Willkommen", "Duschgel", "Olivenöl", "Abgerechnet", "öffnen", "Einer zahlt", "Alle splitten", "Tipp:", "Probier"]) {
        expect(mail.html).not.toContain(german);
        expect(mail.text).not.toContain(german);
      }
    }
  });

  it("keeps German as before", () => {
    expect(greeting(" Niklas ")).toBe("Hi Niklas,");
    expect(greeting(undefined, "es")).toBe("Hola:");
    const mail = codeMail("482913", FROM);
    expect(mail.html).toContain('<html lang="de">');
    expect(mail.text).toContain("Tippe ihn in klicksplit ein – dort, wo Du ihn angefordert hast. Er gilt 15 Minuten.");
    expect(mail.html).toContain('Er gilt <b style="color:#1b1f1c">15 Minuten</b>.');
  });
});

describe("error answers in the reader's language", () => {
  const KEY = "lang-device-key-0123456789";
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const hour = 60 * 60 * 1000;
    server = createServer(
      createApp(new BillStore(null), "/nonexistent", {
        limits: { receiptPerClient: new RateLimiter(10, hour), receiptTotal: new RateLimiter(100, hour), billsPerClient: new RateLimiter(10, hour) },
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  async function error(path: string, headers: Record<string, string> = {}, method = "GET", body?: unknown): Promise<string> {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", "x-billsplit-key": KEY, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return ((await res.json()) as { error: string }).error;
  }

  it("answers in the language the app sends", async () => {
    expect(await error("/api/bills/doesnotexist")).toBe("Diese Rechnung gibt es nicht (mehr).");
    expect(await error("/api/bills/doesnotexist", { "x-billsplit-lang": "en" })).toBe("This bill doesn't exist (any more).");
    expect(await error("/api/bills/doesnotexist", { "x-billsplit-lang": "es" })).toBe("Esta cuenta no existe (o ya no existe).");
    // Without the app's header: the browser's language.
    expect(await error("/api/bills/doesnotexist", { "accept-language": "en-US,en;q=0.9" })).toBe("This bill doesn't exist (any more).");
  });

  it("translates placeholders and the place of a problem", async () => {
    const bill = {
      title: "Insel",
      date: "2026-10-08",
      currency: "EUR",
      tipPercent: 0,
      payment: {},
      items: [{ id: "x", name: "Insel", qty: 1, total: 2_000_000_000 }],
    };
    expect(await error("/api/bills", {}, "POST", { data: bill, name: "N" })).toBe("Ein Betrag ist zu hoch (Position 1).");
    expect(await error("/api/bills", { "x-billsplit-lang": "en" }, "POST", { data: bill, name: "N" })).toBe("An amount is too high (Item 1).");
    expect(await error("/api/bills", { "x-billsplit-lang": "es" }, "POST", { data: bill, name: "N" })).toBe("Un importe es demasiado alto (Artículo 1).");
  });
});
