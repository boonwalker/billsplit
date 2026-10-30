import { locale } from "./i18n";

/** Who holds which units of one line: person → unit slots (a slot held by several is shared). */
export type LineSlots = Record<string, number[]>;

/** 1.5 → "1½", 0.333 → "⅓"; other fractions with one decimal. */
export function formatUnits(units: number): string {
  const whole = Math.floor(units + 1e-9);
  const rest = units - whole;
  if (rest < 1e-6) return String(whole);
  const glyph = [
    [1 / 2, "½"],
    [1 / 3, "⅓"],
    [2 / 3, "⅔"],
    [1 / 4, "¼"],
    [3 / 4, "¾"],
    [1 / 5, "⅕"],
  ].find(([value]) => Math.abs((value as number) - rest) < 1e-6)?.[1];
  if (glyph) return `${whole || ""}${glyph}`;
  return units.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const holdersOf = (line: LineSlots, slot: number) => Object.keys(line).filter((id) => line[id].includes(slot));

/** How many units a person has of the line – a shared unit counts in parts. */
export function unitsOf(line: LineSlots, id: string): number {
  return (line[id] ?? []).reduce((sum, slot) => sum + 1 / holdersOf(line, slot).length, 0);
}

/** Units nobody holds. */
export function freeUnits(line: LineSlots, qty: number): number {
  const used = new Set(Object.values(line).flat());
  return qty - [...used].filter((slot) => slot < qty).length;
}

/**
 * Payer, "Wer hatte das?": gives a person exactly `count` whole units of a line with several
 * units. Keeps the units they had alone, then takes free ones, then makes units they shared
 * their own, and only then takes one from whoever has the most – so "Christoph 1" turns his
 * third of a shared unit into that whole unit instead of shuffling the others around.
 */
export function setUnits(line: LineSlots, qty: number, id: string, count: number): LineSlots {
  const next: LineSlots = Object.fromEntries(Object.entries(line).map(([pid, slots]) => [pid, slots.filter((slot) => slot < qty)]));
  const previous = next[id] ?? [];
  const target = Math.max(0, Math.min(qty, Math.round(count)));
  next[id] = [];
  const own = previous.filter((slot) => holdersOf(next, slot).length === 0);
  const shared = previous.filter((slot) => !own.includes(slot));
  const mine: number[] = own.slice(0, target);
  const used = () => new Set(Object.values(next).flat().concat(mine));
  for (let slot = 0; slot < qty && mine.length < target; slot++) {
    if (!used().has(slot)) mine.push(slot);
  }
  const take = (slot: number) => {
    for (const pid of holdersOf(next, slot)) next[pid] = next[pid].filter((s) => s !== slot);
    mine.push(slot);
  };
  for (const slot of shared) if (mine.length < target) take(slot);
  while (mine.length < target) {
    const others = Object.keys(next).filter((pid) => pid !== id && next[pid].length > 0);
    if (others.length === 0) break;
    const richest = others.reduce((a, b) => (unitsOf(next, b) > unitsOf(next, a) + 1e-9 ? b : a));
    const slots = next[richest];
    const alone = slots.filter((slot) => holdersOf(next, slot).length === 1);
    take(Math.max(...(alone.length ? alone : slots)));
  }
  next[id] = mine.sort((a, b) => a - b);
  for (const pid of Object.keys(next)) if (next[pid].length === 0) delete next[pid];
  return next;
}

/** The people whose units differ between two states of a line. */
export function changedHolders(before: LineSlots, after: LineSlots): string[] {
  const key = (slots: number[] = []) => [...slots].sort((a, b) => a - b).join(",");
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((id) => key(before[id]) !== key(after[id]));
}
