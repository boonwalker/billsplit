import { api } from "./api";
import { adoptDevice, type Profile } from "./storage";

/**
 * Moving to a new device: the old one shows a one-time link as a QR code (see
 * server/deviceLink.ts); the recovery code (the device key itself) works without the old one.
 */

/** The link in the QR code; scanned with billsplit on the new device. */
export function deviceLinkUrl(code: string, base: string = window.location.href): string {
  return `${base.replace(/#.*$/, "")}#/geraet/${code}`;
}

export function deviceCodeFromUrl(text: string): string | null {
  const m = text.match(/#\/geraet\/([A-Za-z0-9_-]{16,64})/);
  return m ? m[1] : null;
}

/**
 * Makes this device the one with `key`: its bills (looked up on the server, so the list is
 * complete even if the old device's list was not) and – when given – its profile. Returns how
 * many bills it has.
 */
export async function takeOverDevice(key: string, profile: Partial<Profile> | null): Promise<number> {
  const bills = await api.myBills(key);
  adoptDevice(
    key,
    profile,
    bills.map((b) => ({ id: b.id, title: b.title, role: b.role, createdAt: b.createdAt, currency: b.currency })),
  );
  return bills.length;
}
