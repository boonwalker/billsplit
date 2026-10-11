import { DEMO } from "./demo";
import { hasPaymentMethod, loadOwnProfile } from "./storage";

/**
 * A friend who just paid for the first time and has no way to get paid yet: they see the
 * confirmation for a moment, go to the start page, and there – a little later – are asked to
 * finish their profile ("Wie willst Du bezahlt werden?", account). Once per device.
 */

const ASKED_KEY = "billsplit.profileAsked";
const NEXT_KEY = "billsplit.afterPay";

/** How long the confirmation stays before the start page opens. */
export const SHOW_PAID_MS = 1000;
/** How long the start page shows before the profile assistant opens. */
export const ASK_PROFILE_AFTER_MS = 1500;

/** Whether the profile assistant is due (and marks it as asked, so it comes only once). */
export function takeProfileQuestion(): boolean {
  if (DEMO || hasPaymentMethod(loadOwnProfile())) return false;
  try {
    if (localStorage.getItem(ASKED_KEY)) return false;
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // without storage it may come again next time
  }
  return true;
}

/** Remembers for the start page that it should ask, and for which bill (for the home-screen hint). */
export function askOnStartPage(billId: string): void {
  try {
    sessionStorage.setItem(NEXT_KEY, billId);
  } catch {
    // without storage the start page just does not ask
  }
}

/** The bill the start page should ask about (once), or null. */
export function takeStartPageQuestion(): string | null {
  try {
    const billId = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    return billId;
  } catch {
    return null;
  }
}
