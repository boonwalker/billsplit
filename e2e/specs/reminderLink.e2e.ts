import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key } from "./helpers";
import { billUrl, withRecipient } from "../../src/lib/bill";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("Erinnerung per WhatsApp in Safari: „Hi Niklas!“ statt Namensfrage – „In der App öffnen“ öffnet die Rechnung in der App direkt", async ({ browser }) => {
  const freddy = { key: key("freddy"), name: "Freddy R.", paypal: "freddy" };
  const id = await createBill(freddy, "PiZz Neapolitanisches Rezept", [{ id: "pizza", name: "Pizza Cosacca", qty: 1, total: 1300 }]);
  const niklas = { key: key("niklas"), name: "Niklas" };
  await joinAndClaim(niklas, id, { pizza: [0] });
  const { me } = await api<{ me: string }>(niklas.key, "GET", `/api/bills/${id}`);

  // The reminder's link (as OwnerPanel builds it) names whom it is for.
  const link = withRecipient(billUrl(id, "https://www.klicksplit.de/", { paypalMe: "freddy" }), me);
  expect(link).toBe(`https://www.klicksplit.de/b/${id}?to=freddy&fuer=${me}`);

  // Safari on Niklas's iPhone: no storage of the app – but no name prompt either.
  const safariCtx = await browser.newContext({ userAgent: IPHONE, permissions: ["clipboard-read", "clipboard-write"] });
  const safari = await safariCtx.newPage();
  await safari.goto(link.replace("https://www.klicksplit.de", ""));
  const hi = safari.getByRole("dialog", { name: "Hi Niklas!" });
  await expect(hi).toContainText("Du bist schon in dieser Rechnung");
  await expect(safari.getByPlaceholder("Dein Name")).toHaveCount(0);
  await hi.getByRole("button", { name: "In der App öffnen" }).click();
  await expect(hi).toContainText("die Rechnung öffnet sich dort von selbst");

  // His home-screen app (his own key): opens straight into the bill – nothing to paste.
  const appCtx = await browser.newContext({ userAgent: IPHONE });
  await appCtx.addInitScript((k) => {
    Object.defineProperty(navigator, "standalone", { get: () => true });
    if (!localStorage.getItem("billsplit.deviceKey")) {
      localStorage.setItem("billsplit.deviceKey", JSON.stringify(k));
      localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "", paypalEmail: "" }));
      localStorage.setItem("billsplit.pushAsked", "1");
      localStorage.setItem("billsplit.profileAsked", "1");
    }
  }, niklas.key);
  const app = await appCtx.newPage();
  await app.goto("/");
  await expect(app).toHaveURL(new RegExp(`#/b/${id}`));
  await expect(app.getByRole("button", { name: "Kopierten Link öffnen" })).toHaveCount(0);
  await expect(app.locator(".paybar")).toContainText("13,00 €");

  // Someone else in Safari with the same link can still go on in the browser.
  const other = await (await browser.newContext({ userAgent: IPHONE })).newPage();
  await other.goto(`/b/${id}?fuer=${me}`);
  await other.getByRole("dialog", { name: "Hi Niklas!" }).getByRole("button", { name: "Hier im Browser weiter" }).click();
  await expect(other.getByPlaceholder("Dein Name")).toBeVisible();
});
