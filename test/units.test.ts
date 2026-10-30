import { describe, expect, it } from "vitest";
import { changedHolders, freeUnits, setUnits, unitsOf } from "../src/lib/units";

describe("setUnits (Wer hatte das? – Stück genau)", () => {
  // 5x Weizen: Freddy 0,1 · Andy 2,3 · unit 4 shared by all three → 2⅓ / 2⅓ / ⅓.
  const weizen = { f: [0, 1, 4], a: [2, 3, 4], c: [4] };

  it("turns a shared third into a whole unit with one tap", () => {
    const next = setUnits(weizen, 5, "c", 1);
    expect(next).toEqual({ f: [0, 1], a: [2, 3], c: [4] });
    expect(changedHolders(weizen, next).sort()).toEqual(["a", "f"]);
  });

  it("dropping to fewer units keeps the ones a person had alone", () => {
    const next = setUnits(weizen, 5, "f", 2);
    expect(next.f).toEqual([0, 1]);
    expect(unitsOf(next, "a")).toBeCloseTo(2.5);
    expect(unitsOf(next, "c")).toBeCloseTo(0.5);
  });

  it("takes free units first, then from whoever has the most", () => {
    let line = setUnits({}, 5, "a", 1);
    expect(line).toEqual({ a: [0] });
    line = setUnits(line, 5, "b", 3);
    expect(line).toEqual({ a: [0], b: [1, 2, 3] });
    expect(freeUnits(line, 5)).toBe(1);
    line = setUnits(line, 5, "c", 2);
    expect(line).toEqual({ a: [0], b: [1, 2], c: [3, 4] });
    expect(freeUnits(line, 5)).toBe(0);
  });

  it("zero removes the person; never more than the line has", () => {
    expect(setUnits({ a: [0, 1], b: [2] }, 3, "a", 0)).toEqual({ b: [2] });
    expect(setUnits({ a: [0], b: [1] }, 2, "a", 9)).toEqual({ a: [0, 1] });
  });
});
