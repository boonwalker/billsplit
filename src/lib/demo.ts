import { useEffect, useState } from "react";

/**
 * Demo build (`npm run build:demo`): runs without a server. Bills live in this
 * browser, and a persona switch shows the same bill from the payer's and the
 * friends' side on one device.
 */
export const DEMO = import.meta.env.VITE_DEMO === "true";

export type PersonaId = "me" | "anna" | "ben";

export const FRIENDS: { id: Exclude<PersonaId, "me">; name: string }[] = [
  { id: "anna", name: "Anna" },
  { id: "ben", name: "Ben" },
];

const PERSONA_KEY = "billsplit.demo.persona";
export const PERSONA_EVENT = "billsplit:persona";

let memoryPersona: PersonaId = "me";

export function getPersona(): PersonaId {
  try {
    const p = localStorage.getItem(PERSONA_KEY);
    if (p === "me" || p === "anna" || p === "ben") return p;
  } catch {
    // storage blocked – fall back to memory
  }
  return memoryPersona;
}

export function setPersona(p: PersonaId): void {
  memoryPersona = p;
  try {
    localStorage.setItem(PERSONA_KEY, p);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(PERSONA_EVENT));
}

export function personaDeviceKey(p: PersonaId): string {
  return `demo-device-${p}`;
}

export function friendName(p: PersonaId): string | null {
  return FRIENDS.find((f) => f.id === p)?.name ?? null;
}

export function usePersona(): PersonaId {
  const [persona, set] = useState(getPersona);
  useEffect(() => {
    const on = () => set(getPersona());
    window.addEventListener(PERSONA_EVENT, on);
    return () => window.removeEventListener(PERSONA_EVENT, on);
  }, []);
  return persona;
}
