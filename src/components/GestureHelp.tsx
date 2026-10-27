import { useState } from "react";
import { t } from "../lib/i18n";

/** What can be done on the receipt: ticking (everyone) or striking out (the payer, equal split). */
type Mode = "claim" | "strike";

const legend = (mode: Mode, hold: boolean): [gesture: string, effect: string][] =>
  mode === "claim"
    ? [
        [t("Antippen"), t("abhaken")],
        [t("Namen antippen"), t("mit dieser Person teilen")],
        [t("„Du“ antippen"), t("Du willst mit jemandem teilen")],
        ["− / +", t("bei mehrfacher Menge weniger oder mehr nehmen")],
        // The payer only: who had a line, and "/ N".
        ...(hold
          ? [
              [t("Gedrückt halten"), t("jemandem direkt zuordnen oder nur einen Teil in Rechnung stellen")] as [string, string],
              [t("Namen gedrückt halten"), t("Anteil des Gastes entfernen")] as [string, string],
            ]
          : []),
      ]
    : [
        [t("Antippen"), t("streichen – nochmal tippen holt es zurück")],
        [t("Gedrückt halten"), t("jemandem direkt zuordnen oder nur einen Teil in Rechnung stellen")],
      ];

/**
 * A small "?" next to the instruction above the receipt: the gestures at a glance, for
 * whenever they are needed again – the explaining animation only runs once.
 */
export default function GestureHelp({ mode, hold = false }: { mode: Mode; hold?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`gesture-help-btn${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label={open ? t("Gesten ausblenden") : t("Welche Gesten gibt es?")}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {/* Spans, so it can sit inside a sentence's paragraph. */}
      {open && (
        <span className="gesture-legend" role="list" onClick={() => setOpen(false)}>
          {legend(mode, hold).map(([gesture, effect]) => (
            <span key={gesture} role="listitem">
              <b>{gesture}</b> = {effect}
            </span>
          ))}
        </span>
      )}
    </>
  );
}
