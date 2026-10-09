import { describe, expect, it } from "vitest";
import { centsToDecimal, centsToInput, parseMoney } from "../src/lib/money";

describe("parseMoney", () => {
  it.each([
    ["12,50", 1250],
    ["12.50", 1250],
    ["12", 1200],
    ["12,5", 1250],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1.234", 123400],
    ["-3,00", -300],
    ["3,00-", -300],
    ["4,50 €", 450],
    ["EUR 0,99", 99],
  ])("parses %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3x"])("rejects %s", (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats for inputs and payment providers", () => {
    expect(centsToInput(1250)).toBe("12,50");
    expect(centsToDecimal(1250)).toBe("12.50");
    expect(centsToDecimal(5)).toBe("0.05");
  });
});
