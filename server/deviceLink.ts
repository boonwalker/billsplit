import { randomBytes } from "node:crypto";

/**
 * Moving to a new device: the old device asks for a one-time code, shows it as a QR code, and
 * the new device trades the code for the device key (and the profile). Codes live in memory
 * only, for a few minutes, and work once.
 */

export const DEVICE_LINK_TTL_MS = 10 * 60 * 1000;
/** Upper bound for open codes (the oldest go first). */
const MAX_LINKS = 1000;

export interface DeviceLinkPayload {
  key: string;
  profile: Record<string, string>;
}

export class DeviceLinks {
  private readonly links = new Map<string, DeviceLinkPayload & { expires: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  create(payload: DeviceLinkPayload): { code: string; expiresAt: string } {
    this.prune();
    // A device has at most one open code: a new one replaces the old.
    for (const [code, link] of this.links) if (link.key === payload.key) this.links.delete(code);
    while (this.links.size >= MAX_LINKS) this.links.delete(this.links.keys().next().value!);
    const code = randomBytes(18).toString("base64url");
    const expires = this.now() + DEVICE_LINK_TTL_MS;
    this.links.set(code, { ...payload, expires });
    return { code, expiresAt: new Date(expires).toISOString() };
  }

  /** The key and profile behind a code – once; null when it expired or was used. */
  claim(code: string): DeviceLinkPayload | null {
    const link = this.links.get(code);
    this.links.delete(code);
    if (!link || link.expires < this.now()) return null;
    return { key: link.key, profile: link.profile };
  }

  private prune(): void {
    const now = this.now();
    for (const [code, link] of this.links) if (link.expires < now) this.links.delete(code);
  }
}
