/**
 * Recognises a handwritten divisor such as "/3" drawn with a finger.
 *
 * The slash is found by its shape (a straight, slanted stroke); the remaining
 * strokes are grouped into digits and read with the $P point-cloud recognizer
 * (Vatavu, Anthony & Wobbrock 2012) against a small set of digit templates.
 * Everything runs on the device – no image leaves the phone.
 */

export interface InkPoint {
  x: number;
  y: number;
}
export type Stroke = InkPoint[];

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface CloudPoint extends InkPoint {
  id: number;
}

const SAMPLES = 32;

export function boundsOf(strokes: Stroke[]): Bounds {
  const pts = strokes.flat();
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

const dist = (a: InkPoint, b: InkPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const pathLength = (s: Stroke) => s.slice(1).reduce((sum, p, i) => sum + dist(s[i], p), 0);

/** A straight stroke slanting like "/" (or drawn the other way round), not an upright "1". */
export function isSlash(stroke: Stroke): boolean {
  if (stroke.length < 2) return false;
  const a = stroke[0];
  const b = stroke[stroke.length - 1];
  const length = pathLength(stroke);
  const chord = dist(a, b);
  if (chord < 12 || chord / length < 0.88) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rising = (dx > 0 && dy < 0) || (dx < 0 && dy > 0);
  const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  return rising && angle > 30 && angle < 80;
}

// ---------- $P point-cloud recognizer ----------

function resample(strokes: Stroke[], n: number): CloudPoint[] {
  const points: CloudPoint[] = strokes.flatMap((s, id) => s.map((p) => ({ ...p, id })));
  const total = strokes.reduce((sum, s) => sum + pathLength(s), 0);
  const interval = total / (n - 1) || 1;
  const out: CloudPoint[] = [points[0]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].id !== points[i - 1].id) continue;
    const d = dist(points[i - 1], points[i]);
    if (acc + d >= interval && d > 0) {
      const t = (interval - acc) / d;
      const q = { x: points[i - 1].x + t * (points[i].x - points[i - 1].x), y: points[i - 1].y + t * (points[i].y - points[i - 1].y), id: points[i].id };
      out.push(q);
      points.splice(i, 0, q);
      acc = 0;
    } else {
      acc += d;
    }
  }
  while (out.length < n) out.push(points[points.length - 1]);
  return out.slice(0, n);
}

function normalize(strokes: Stroke[]): CloudPoint[] {
  const pts = resample(strokes, SAMPLES);
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const size = Math.max(Math.max(...pts.map((p) => p.x)) - minX, Math.max(...pts.map((p) => p.y)) - minY) || 1;
  const scaled = pts.map((p) => ({ x: (p.x - minX) / size, y: (p.y - minY) / size, id: p.id }));
  const cx = scaled.reduce((s, p) => s + p.x, 0) / scaled.length;
  const cy = scaled.reduce((s, p) => s + p.y, 0) / scaled.length;
  return scaled.map((p) => ({ x: p.x - cx, y: p.y - cy, id: p.id }));
}

function cloudDistance(a: CloudPoint[], b: CloudPoint[], start: number): number {
  const matched = new Array<boolean>(a.length).fill(false);
  let sum = 0;
  let i = start;
  do {
    let index = -1;
    let min = Infinity;
    for (let j = 0; j < b.length; j++) {
      if (matched[j]) continue;
      const d = dist(a[i], b[j]);
      if (d < min) {
        min = d;
        index = j;
      }
    }
    matched[index] = true;
    const weight = 1 - ((i - start + a.length) % a.length) / a.length;
    sum += weight * min;
    i = (i + 1) % a.length;
  } while (i !== start);
  return sum;
}

function greedyMatch(points: CloudPoint[], template: CloudPoint[]): number {
  const step = Math.floor(Math.pow(points.length, 0.5));
  let min = Infinity;
  for (let i = 0; i < points.length; i += step) {
    min = Math.min(min, cloudDistance(points, template, i), cloudDistance(template, points, i));
  }
  return min;
}

/** Digit templates on a 100×100 grid (y downwards), several ways of writing each. */
const DIGITS: [string, number[][][]][] = [
  ["0", [[[50, 0, 18, 20, 10, 55, 25, 95, 60, 100, 85, 70, 88, 30, 70, 5, 50, 0]]]],
  [
    "2",
    [
      [[12, 25, 30, 4, 60, 0, 85, 18, 80, 42, 12, 100, 90, 100]],
      [[15, 20, 50, 0, 85, 25, 15, 100, 90, 95]],
      [[10, 30, 25, 8, 50, 0, 75, 10, 82, 30, 60, 60, 12, 100, 90, 100]],
    ],
  ],
  [
    "3",
    [
      [[12, 10, 50, 0, 85, 15, 80, 38, 45, 50, 85, 65, 85, 90, 50, 100, 10, 90]],
      [[15, 5, 80, 5, 40, 45, 80, 60, 75, 95, 15, 95]],
      [[10, 15, 40, 0, 75, 10, 78, 35, 50, 48, 30, 50, 50, 50, 82, 62, 85, 85, 60, 100, 15, 92]],
    ],
  ],
  [
    "4",
    [
      [[60, 0, 10, 65, 90, 65], [68, 30, 68, 100]],
      [[20, 0, 12, 60, 85, 60], [70, 0, 70, 100]],
      [[60, 100, 60, 0, 10, 65, 90, 65]],
    ],
  ],
  [
    "5",
    [
      [[80, 0, 25, 0, 20, 45, 55, 40, 85, 60, 80, 90, 50, 100, 15, 90]],
      [[25, 0, 20, 45, 55, 40, 85, 60, 80, 90, 50, 100, 15, 90], [25, 0, 85, 0]],
    ],
  ],
  ["6", [[[75, 5, 45, 0, 20, 30, 15, 70, 35, 100, 70, 95, 82, 70, 62, 50, 30, 55, 15, 72]]]],
  ["7", [[[10, 0, 90, 0, 40, 100]], [[10, 0, 90, 0, 40, 100], [30, 52, 75, 52]], [[10, 15, 10, 0, 90, 0, 45, 100]]]],
  ["8", [[[80, 15, 50, 0, 20, 15, 30, 40, 70, 60, 80, 85, 50, 100, 20, 85, 30, 60, 70, 40, 80, 15]]]],
  ["9", [[[80, 28, 60, 48, 25, 45, 15, 22, 38, 0, 70, 5, 80, 28, 75, 100]], [[80, 25, 50, 45, 18, 30, 40, 0, 80, 10], [80, 10, 80, 100]]]],
];

/** Every template also in a narrower form – people often write digits slimmer than wide. */
const TEMPLATES = DIGITS.flatMap(([digit, variants]) =>
  variants.flatMap((strokes) =>
    [1, 0.65].map((aspect) => ({
      digit,
      cloud: normalize(
        strokes.map((flat) => flat.reduce<Stroke>((s, v, i) => (i % 2 ? s : [...s, { x: 50 + (v - 50) * aspect, y: flat[i + 1] }]), [])),
      ),
    })),
  ),
);

/** A "1": a single, almost straight, upright stroke (optionally with a short flag at the top). */
function looksLikeOne(strokes: Stroke[]): boolean {
  if (strokes.length !== 1) return false;
  const b = boundsOf(strokes);
  const height = b.maxY - b.minY;
  return height > 2.2 * (b.maxX - b.minX) && pathLength(strokes[0]) < 1.35 * height;
}

/** Reads one handwritten digit. */
export function recognizeDigit(strokes: Stroke[]): string {
  // An upright line is a "1" – the point cloud of a line is too sparse to compare well.
  if (looksLikeOne(strokes)) return "1";
  const cloud = normalize(strokes);
  let best = { digit: "", score: Infinity };
  for (const t of TEMPLATES) {
    const score = greedyMatch(cloud, t.cloud);
    if (score < best.score) best = { digit: t.digit, score };
  }
  return best.digit;
}

/** Splits the digit strokes into characters by how they overlap horizontally. */
function groupIntoCharacters(strokes: Stroke[]): Stroke[][] {
  const sorted = [...strokes].sort((a, b) => boundsOf([a]).minX - boundsOf([b]).minX);
  const height = Math.max(...strokes.map((s) => boundsOf([s]).maxY)) - Math.min(...strokes.map((s) => boundsOf([s]).minY));
  const groups: Stroke[][] = [];
  for (const stroke of sorted) {
    const last = groups[groups.length - 1];
    if (last && boundsOf([stroke]).minX < boundsOf(last).maxX - height * 0.1) last.push(stroke);
    else groups.push([stroke]);
  }
  return groups;
}

export interface Divisor {
  divisor: number;
  bounds: Bounds;
}

/** "/3" → 3. Returns null when no number can be read. A missing slash is tolerated. */
export function recognizeDivisor(strokes: Stroke[]): Divisor | null {
  const usable = strokes.filter((s) => s.length > 1);
  if (!usable.length) return null;
  const bounds = boundsOf(usable);
  // The slash is the leftmost slanted straight stroke; everything else is the number.
  const slashes = usable.filter(isSlash).sort((a, b) => boundsOf([a]).minX - boundsOf([b]).minX);
  const slash = slashes[0];
  const digits = usable.filter((s) => s !== slash);
  if (!digits.length) return null;
  const text = groupIntoCharacters(digits).map(recognizeDigit).join("");
  const divisor = Number(text.replace(/^0+/, ""));
  if (!Number.isInteger(divisor) || divisor < 1 || divisor > 99) return null;
  return { divisor, bounds };
}
