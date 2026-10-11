import { readFile } from "node:fs/promises";
import { expect, test, type Browser } from "@playwright/test";
import { key } from "./helpers";

/** A browser in another language (Accept-Language and navigator.languages follow `locale`). */
async function device(browser: Browser, locale: string) {
  const context = await browser.newContext({ locale });
  await context.addInitScript((k) => {
    if (!localStorage.getItem("billsplit.deviceKey")) localStorage.setItem("billsplit.deviceKey", JSON.stringify(k));
    localStorage.setItem("billsplit.pushAsked", "1");
  }, key("lang"));
  return context.newPage();
}

test("Sprache: Englisch und Spanisch kommen vom Browser, im Profil lässt sie sich umstellen", async ({ browser }) => {
  const en = await device(browser, "en-US");
  await en.goto("/");
  await expect(en.locator("html")).toHaveAttribute("lang", "en");
  await expect(en.locator(".hero")).toContainText("One pays.");
  await expect(en.locator(".hero")).toContainText("Everyone splits.");
  await expect(en.getByText("Snap a receipt")).toBeVisible();

  // Profile → Language → Deutsch: the app reloads in German and stays so.
  await en.goto("/#/profile");
  await en.getByRole("radiogroup", { name: "Language" }).getByRole("radio", { name: "Deutsch" }).click();
  await expect(en.locator("html")).toHaveAttribute("lang", "de");
  await en.goto("/");
  await expect(en.locator(".hero")).toContainText("Einer zahlt.");
  await expect(en.locator(".hero")).toContainText("Alle splitten.");

  const es = await device(browser, "es-ES");
  await es.goto("/");
  await expect(es.locator("html")).toHaveAttribute("lang", "es");
  await expect(es.locator(".hero")).toContainText("Uno paga.");
  await expect(es.locator(".hero")).toContainText("Todos dividen.");
});

test("Sprache: Der Code kommt in der Sprache der App, Fehlerseiten auch", async ({ browser }) => {
  const es = await device(browser, "es-ES");
  await es.goto("/#/anmelden");
  const email = `maria-${Date.now()}@example.es`;
  await es.getByLabel("Correo electrónico").fill(email);
  await es.getByRole("button", { name: "Enviar código" }).click();
  // The test server writes mails to MAIL_OUTBOX, with the language they were written in.
  await expect
    .poll(async () => {
      const lines = (await readFile(process.env.MAIL_OUTBOX!, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
      return lines.map((l) => JSON.parse(l) as { email: string; lang?: string }).find((m) => m.email === email)?.lang;
    })
    .toBe("es");

  // A bill that does not exist (the server answers 404): in English.
  const en = await device(browser, "en-US");
  await en.goto("/#/b/doesnotexist");
  await expect(en.locator("body")).toContainText("Bill not found");
});
