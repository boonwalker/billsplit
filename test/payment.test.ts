import { describe, expect, it } from "vitest";
import { formatIban, isValidIban, normalizePaypalUser, paypalLink } from "../src/lib/payment";

describe("PayPal", () => {
  it.each([
    ["niklas", "niklas"],
    ["@niklas", "niklas"],
    ["paypal.me/niklas", "niklas"],
    ["https://paypal.me/niklas/5EUR", "niklas"],
    ["https://www.paypal.com/paypalme/niklas", "niklas"],
    ["  niklas ", "niklas"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePaypalUser(input)).toBe(expected);
  });

  it("builds a link with recipient and amount", () => {
    expect(paypalLink("paypal.me/niklas", 2035)).toBe("https://www.paypal.com/paypalme/niklas/20.35EUR");
    expect(paypalLink("niklas", 0)).toBe("https://www.paypal.com/paypalme/niklas");
  });
});

describe("IBAN", () => {
  it("validates the checksum", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("DE88 3704 0044 0532 0130 00")).toBe(false);
    expect(isValidIban("hello")).toBe(false);
  });

  it("formats in groups of four", () => {
    expect(formatIban("de89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });
});
