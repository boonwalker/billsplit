import { useState } from "react";

/** What can be done on the receipt: ticking (everyone) or striking out (the payer, equal split). */
type Mode = "claim" | "strike";

const LEGEND: Record<Mode, [gesture: string, effect: string][]> = {
  claim: [
    ["Antippen", "abhaken"],
    ["Namen antippen", "mit dieser Person teilen"],
    ["„Du“ antippen", "Du willst mit jemandem teilen"],
    ["− / +", "bei mehrfacher Menge weniger oder mehr nehmen"],
  ],
  strike: [
    ["Antippen", "streichen – nochmal tippen holt es zurück"],
    ["Gedrückt halten", "nur einen Teil in Rechnung stellen"],
  ],
};

/**
 * A small "?" next to the instruction above the receipt: the gestures at a glance, for
 * whenever they are needed again – the explaining animation only runs once.
 */
export default function GestureHelp({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`gesture-help-btn${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label={open ? "Gesten ausblenden" : "Welche Gesten gibt es?"}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {/* Spans, so it can sit inside a sentence's paragraph. */}
      {open && (
        <span className="gesture-legend" role="list" onClick={() => setOpen(false)}>
          {LEGEND[mode].map(([gesture, effect]) => (
            <span key={gesture} role="listitem">
              <b>{gesture}</b> = {effect}
            </span>
          ))}
        </span>
      )}
    </>
  );
}
