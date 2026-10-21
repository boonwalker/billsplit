import { api } from "./api";
import { DEMO } from "./demo";
import { disablePush, resubscribePush } from "./push";
import { reportError } from "./errorReport";
import { adoptDevice, loadAccountEmail, loadOwnProfile, resetDevice, saveAccountEmail, saveAccountLost, saveProfile, type Profile, saveAccountRemoved } from "./storage";

/**
 * The optional e-mail account (see server/accounts.ts): no password, a six-digit code from the
 * mail. Signing in on another device makes that device the account's – bills, profile, balance.
 */

/** Accounts need the server; the demo has none. */
export const accountsAvailable = !DEMO;

export type SignInResult = "created" | "same" | "login";

/** Checks the code and applies the result on this device. */
export async function confirmCode(email: string, code: string): Promise<SignInResult> {
  const result = await api.verifyCode(email, code, loadOwnProfile());
  saveAccountEmail(result.email);
  if (result.status === "login") {
    // What is filled in on the account wins; what only this device knows stays.
    const local = loadOwnProfile();
    const merged: Profile = { ...local, ...Object.fromEntries(Object.entries(result.profile).filter(([, v]) => v)) };
    adoptDevice(
      result.key,
      merged,
      result.bills.map((b) => ({ id: b.id, title: b.title, role: b.role, createdAt: b.createdAt, currency: b.currency })),
    );
    // A new device may know payment details the account did not have yet.
    void syncAccountProfile(merged);
    // Notifications now go to the account: this device's subscription moves along.
    void resubscribePush();
  }
  return result.status;
}

/** Keeps the account's copy of the profile up to date (when there is an account). */
export async function syncAccountProfile(profile: Profile = loadOwnProfile()): Promise<void> {
  if (!accountsAvailable || !loadAccountEmail()) return;
  await api.saveAccountProfile(profile).catch(() => {});
}

/** Asks the server which account this device belongs to (it may have changed elsewhere). */
export async function refreshAccount(): Promise<string | null> {
  if (!accountsAvailable) return null;
  try {
    const { account, removed } = await api.account();
    const before = loadAccountEmail();
    // Deleted on the admin page (e.g. on request): said once, no alarm. With all data erased this
    // device starts over – its name and payment details must not come back into the bills.
    if (before && !account && removed) {
      if (removed === "erased") resetDevice();
      saveAccountEmail(null);
      saveAccountRemoved({ email: before, erased: removed === "erased" });
      return null;
    }
    // Signed in here, but the server does not know the account (any more): never silently –
    // the app says so and offers the address for signing in again (and the admin page hears of it).
    if (before && !account) {
      saveAccountLost(before);
      reportError(new Error("Konto auf dem Server nicht gefunden"));
    }
    saveAccountEmail(account?.email ?? null);
    return account?.email ?? null;
  } catch {
    return loadAccountEmail();
  }
}

/** This device leaves the account and starts over (the account keeps everything, its notifications stop here). */
export async function signOut(): Promise<void> {
  await disablePush().catch(() => undefined);
  resetDevice();
}

/** Deletes the account; the bills stay on this device as before. */
export async function deleteAccount(): Promise<void> {
  await api.deleteAccount();
  saveAccountEmail(null);
}

/** Saves the profile on this device and in the account. */
export function saveProfileEverywhere(profile: Profile): boolean {
  const stored = saveProfile(profile);
  void syncAccountProfile(profile);
  return stored;
}
