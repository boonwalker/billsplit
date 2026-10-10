/**
 * Hand-over from the browser to the home-screen app (iPhone).
 *
 * iOS opens shared links in Safari, and Safari and the home-screen web app do not share any
 * storage. When someone taps "In der billsplit-App öffnen" in Safari, the link goes to their
 * clipboard and the server notes the hand-over for their network address for a few minutes.
 * The app then asks whether a hand-over is waiting for its address and only in that case
 * offers to open the copied link – the link itself never passes through the server.
 */

/** How long a hand-over waits for the app to be opened. */
export const HANDOFF_TTL_MS = 5 * 60 * 1000;
/** Upper bound for remembered addresses (old ones are dropped first). */
const MAX_ENTRIES = 10_000;

/**
 * The part of a client address that stays the same between Safari and the home-screen app on
 * one phone: the IPv4 address, or the /64 network of an IPv6 address (the host part changes
 * with the privacy extensions).
 */
export function networkKey(address: string): string {
  const ip = address.trim().toLowerCase().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "");
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, "") || "0")
    .join(":");
}

export class HandoffBoard {
  private readonly waiting = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  mark(address: string): void {
    const key = networkKey(address);
    this.waiting.delete(key);
    this.waiting.set(key, this.now() + HANDOFF_TTL_MS);
    if (this.waiting.size > MAX_ENTRIES) this.waiting.delete(this.waiting.keys().next().value!);
  }

  pending(address: string): boolean {
    const key = networkKey(address);
    const until = this.waiting.get(key);
    if (until === undefined) return false;
    if (until > this.now()) return true;
    this.waiting.delete(key);
    return false;
  }

  clear(address: string): void {
    this.waiting.delete(networkKey(address));
  }
}
