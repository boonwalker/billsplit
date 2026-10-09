import { describe, expect, it } from "vitest";
import { isValidEmail, normalizePaypalMe, payAction, paypalMeLink, PAYPAL_SEND_URL } from "../src/lib/payment";

describe("PayPal", () => {
  it.each([
    ["niklas", "niklas"],
    ["@niklas", "niklas"],
    ["paypal.me/niklas", "niklas"],
    ["https://paypal.me/niklas/5EUR", "niklas"],
    ["https://www.paypal.com/paypalme/niklas", "niklas"],
    ["  niklas ", "niklas"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePaypalMe(input)).toBe(expected);
  });

  it("builds a PayPal.Me link with recipient and amount", () => {
    expect(paypalMeLink("paypal.me/niklas", 2035)).toBe("https://www.paypal.com/paypalme/niklas/20.35EUR");
    expect(paypalMeLink("niklas", 0)).toBe("https://www.paypal.com/paypalme/niklas");
  });

  it("combines recipient and individual amount into the pay action", () => {
    expect(payAction({ paypalMe: "niklas", paypalEmail: "n@web.de" }, 1540, "EUR")).toEqual({
      kind: "paypalMe",
      url: "https://www.paypal.com/paypalme/niklas/15.40EUR",
    });
    expect(payAction({ paypalEmail: "n@web.de" }, 1540, "EUR")).toEqual({ kind: "email", url: PAYPAL_SEND_URL, email: "n@web.de" });
    expect(payAction({}, 1540, "EUR")).toEqual({ kind: "none" });
  });

  it("validates e-mail addresses", () => {
    expect(isValidEmail("niklas@web.de")).toBe(true);
    expect(isValidEmail("niklas@web")).toBe(false);
  });
});
