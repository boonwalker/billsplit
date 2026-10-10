import { describe, expect, it } from "vitest";
import {
  formatIban,
  isValidEmail,
  isValidIban,
  isValidWero,
  normalizePaypalMe,
  otherMethods,
  payAction,
  paymentFromProfile,
  paypalMeLink,
  PAYPAL_SEND_URL,
} from "../src/lib/payment";

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

  it("checks IBANs including their check digits", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("de89370400440532013000")).toBe(true);
    expect(isValidIban("DE88 3704 0044 0532 0130 00")).toBe(false);
    expect(isValidIban("DE89 3704 0044 0532 0130")).toBe(false);
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(formatIban("de89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });

  it("accepts a mobile number or e-mail address for Wero", () => {
    expect(isValidWero("+49 170 1234567")).toBe(true);
    expect(isValidWero("niklas@web.de")).toBe(true);
    expect(isValidWero("niklas")).toBe(false);
  });

  it("takes bank and Wero details from the profile into the bill", () => {
    const payment = paymentFromProfile({ name: "Niklas", paypalMe: "", paypalEmail: "", iban: "de89 3704 0044 0532 0130 00", holder: "", wero: "+49 170 1234567" });
    expect(payment).toEqual({ iban: "DE89370400440532013000", holder: "Niklas", wero: "+49 170 1234567" });
    expect(otherMethods(payment)).toEqual(["bank", "wero"]);
    expect(payAction(payment, 500, "EUR")).toEqual({ kind: "none" });
  });
});
