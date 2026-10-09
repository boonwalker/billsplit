import { describe, expect, it } from "vitest";
import { isSlash, recognizeDigit, recognizeDivisor, type Stroke } from "../src/lib/ink";

/** Deterministic pseudo-random numbers, so the "handwriting" is the same on every run. */
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

/** Smooth polyline through the given points (many samples, like a finger trace). */
function trace(flat: number[], ox: number, oy: number, size: number, shear: number, aspect: number, jitter: () => number): Stroke {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  const out: Stroke = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let t = 0; t < 1; t += 0.1) {
      const x = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
      const y = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
      out.push({ x: ox + ((x + shear * (100 - y)) * size * aspect) / 100 + jitter(), y: oy + (y * size) / 100 + jitter() });
    }
  }
  const last = pts[pts.length - 1];
  out.push({ x: ox + ((last.x + shear * (100 - last.y)) * size * aspect) / 100, y: oy + (last.y * size) / 100 });
  return out;
}

// How people tend to write the digits – deliberately not identical to the templates.
const HANDWRITING: Record<string, number[][]> = {
  "1": [[45, 8, 52, 100]],
  "2": [[15, 30, 35, 6, 62, 4, 80, 22, 72, 48, 20, 96, 88, 98]],
  "3": [[18, 12, 55, 2, 80, 20, 70, 42, 42, 50, 78, 62, 82, 88, 52, 100, 15, 88]],
  "4": [[55, 5, 15, 62, 88, 62], [62, 35, 62, 100]],
  "5": [[78, 4, 30, 4, 25, 46, 58, 42, 82, 62, 76, 92, 45, 100, 18, 88]],
  "6": [[72, 8, 40, 5, 18, 38, 18, 78, 40, 100, 72, 92, 78, 68, 55, 52, 25, 60]],
  "7": [[12, 6, 85, 4, 45, 100]],
  "8": [[75, 18, 48, 2, 22, 20, 35, 42, 68, 58, 78, 84, 48, 100, 22, 82, 34, 58, 68, 38, 75, 18]],
  "9": [[78, 30, 55, 46, 25, 40, 20, 18, 42, 2, 72, 10, 78, 30, 72, 100]],
};

describe("handwritten divisor", () => {
  it("tells a slash from an upright one", () => {
    expect(isSlash([{ x: 0, y: 100 }, { x: 40, y: 0 }])).toBe(true);
    expect(isSlash([{ x: 40, y: 0 }, { x: 0, y: 100 }])).toBe(true);
    expect(isSlash([{ x: 10, y: 0 }, { x: 12, y: 100 }])).toBe(false);
    expect(isSlash([{ x: 0, y: 0 }, { x: 40, y: 100 }])).toBe(false); // a backslash
  });

  it("reads digits written in different sizes and slants", () => {
    const random = rng(42);
    let right = 0;
    let total = 0;
    for (const [digit, strokes] of Object.entries(HANDWRITING)) {
      for (let n = 0; n < 12; n++) {
        const size = 40 + random() * 60;
        const shear = (random() - 0.5) * 0.4;
        const aspect = 0.65 + random() * 0.4;
        const jitter = () => (random() - 0.5) * size * 0.04;
        const drawn = strokes.map((s) => trace(s, 200, 300, size, shear, aspect, jitter));
        total++;
        if (recognizeDigit(drawn) === digit) right++;
      }
    }
    expect(right / total).toBeGreaterThan(0.9);
  });

  it("reads '/3', '/12' and a number without slash", () => {
    const j = () => 0;
    const slash = trace([0, 100, 35, 0], 100, 100, 60, 0, 1, j);
    expect(recognizeDivisor([slash, trace(HANDWRITING["3"][0], 140, 100, 60, 0, 0.8, j)])?.divisor).toBe(3);
    expect(recognizeDivisor([slash, trace(HANDWRITING["1"][0], 140, 100, 60, 0, 0.5, j), trace(HANDWRITING["2"][0], 175, 100, 60, 0, 0.8, j)])?.divisor).toBe(12);
    expect(recognizeDivisor([trace(HANDWRITING["4"][0], 100, 100, 60, 0, 0.8, j), trace(HANDWRITING["4"][1], 100, 100, 60, 0, 0.8, j)])?.divisor).toBe(4);
    expect(recognizeDivisor([slash])).toBeNull();
  });
});
