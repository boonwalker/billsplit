import { describe, expect, it } from "vitest";
import { tipCents, type TipValue } from "../src/components/TipControl";

const base: TipValue = { mode: "percent", percent: "10", total: "", amount: "", persons: "" };

describe("tip input", () => {
  it("takes the tip as an absolute amount, a percentage or the final amount paid", () => {
    expect(tipCents({ ...base, mode: "amount", amount: "5,50" }, 2000, 100)).toBe(550);
    expect(tipCents({ ...base, mode: "amount", amount: "" }, 2000)).toBe(0);
    expect(tipCents(base, 2000)).toBe(200);
    expect(tipCents({ ...base, mode: "total", total: "25" }, 2000, 100)).toBe(400);
  });
});
