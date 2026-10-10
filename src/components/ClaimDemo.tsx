import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Bill in the normal (not equal) split: shows once how the receipt is used – ticking a line,
 * sharing a unit someone else has, and offering half of one's own unit for sharing. The demo
 * uses ghost elements on the first lines and never touches the real claims.
 */

type Step = "tick" | "share" | "offer";
/** before: as it is · tap: the finger taps · after: what the tap does. */
type Stage = "before" | "tap" | "after" | "hidden";

interface Spot {
  x: number;
  y: number;
}

interface Layout {
  tick: Spot;
  share: Spot;
  offer: Spot;
}

const STEPS: Step[] = ["tick", "share", "offer"];
const CYCLES = 2;
const START_MS = 1400;
/** Duration of the stages of one step. */
const STAGE_MS: Record<Exclude<Stage, "hidden">, number> = { before: 900, tap: 450, after: 1700 };
const GAP_MS = 450;

const KEY = (billId: string) => `billsplit.claimDemo.${billId}`;

const CAPTION: Record<Step, string> = {
  tick: "Antippen = abhaken",
  share: "Namen antippen = mitteilen",
  offer: "Eigenen Namen antippen = zum Teilen anbieten",
};

/** Runs once per bill and device; `stop` ends it early (e.g. as soon as the user taps a line). */
export function useClaimDemo(billId: string, enabled: boolean, list: RefObject<HTMLUListElement | null>) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [state, setState] = useState<{ step: Step; stage: Stage }>({ step: "tick", stage: "hidden" });

  useLayoutEffect(() => {
    if (!enabled || !list.current) return;
    try {
      if (localStorage.getItem(KEY(billId))) return;
      localStorage.setItem(KEY(billId), "1");
    } catch {
      // Without storage the demo shows again next time.
    }
    const lines = [...list.current.querySelectorAll<HTMLElement>("li[data-item]")];
    if (!lines.length) return;
    const at = (i: number) => lines[Math.min(i, lines.length - 1)];
    const tickOf = (line: HTMLElement): Spot => {
      const tick = line.querySelector<HTMLElement>(".tick");
      return tick
        ? { x: line.offsetLeft + tick.offsetLeft + tick.offsetWidth / 2, y: line.offsetTop + tick.offsetTop + tick.offsetHeight / 2 }
        : { x: line.offsetLeft + 17, y: line.offsetTop + line.offsetHeight / 2 };
    };
    // Name chips appear below a line, where the real ones are listed.
    const chipOf = (line: HTMLElement): Spot => ({ x: line.offsetLeft + 30, y: line.offsetTop + line.offsetHeight - 6 });
    setLayout({ tick: tickOf(at(0)), share: chipOf(at(1)), offer: chipOf(at(2)) });
  }, [billId, enabled, list]);

  useEffect(() => {
    if (!layout) return;
    const timers: number[] = [];
    let t = START_MS;
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      for (const step of STEPS) {
        for (const stage of ["before", "tap", "after"] as const) {
          timers.push(window.setTimeout(() => setState({ step, stage }), t));
          t += STAGE_MS[stage];
        }
        timers.push(window.setTimeout(() => setState({ step, stage: "hidden" }), t));
        t += GAP_MS;
      }
    }
    timers.push(window.setTimeout(() => setLayout(null), t));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [layout]);

  return { layout, ...state, stop: () => setLayout(null) };
}

export default function ClaimDemo({ layout, step, stage, otherName }: { layout: Layout; step: Step; stage: Stage; otherName: string }) {
  if (stage === "hidden") return null;
  const done = stage === "after";
  const tap = stage === "tap" && <span className="claim-demo-tap" />;
  const other = otherName.length > 10 ? `${otherName.slice(0, 9)}…` : otherName;
  // A small card below the line explains the step; for the name steps it holds the chips.
  const card = step === "tick" ? { x: layout.tick.x - 13, y: layout.tick.y + 18 } : layout[step];

  return (
    <div className={`claim-demo step-${step}${done ? " after" : ""}`} aria-hidden="true">
      {step === "tick" && (
        <span className="claim-demo-tick" style={{ left: layout.tick.x, top: layout.tick.y }}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M7.5 12.5l3 3 6-6.5" pathLength="1" />
          </svg>
          {tap}
        </span>
      )}
      <div className="claim-demo-card" style={{ left: card.x, top: card.y } as CSSProperties}>
        <span className="claim-demo-caption">{CAPTION[step]}</span>
        {step === "share" && (
          <span className="claim-demo-chips">
            <span className={`claim-demo-chip${done ? " half" : ""}`}>
              <i>✓</i>
              {other} ×{done ? "½" : "1"}
              {tap}
            </span>
            {done && (
              <span className="claim-demo-chip mine">
                <i>✓</i>Du ×½
              </span>
            )}
            {done && <span className="claim-demo-note">geteilt</span>}
          </span>
        )}
        {step === "offer" && (
          <span className="claim-demo-chips">
            <span className={`claim-demo-chip mine${done ? " offer" : ""}`}>
              <i>✓</i>Du ×{done ? "½" : "1"}
              {tap}
            </span>
            {done && <span className="claim-demo-note">½ wartet auf jemanden</span>}
          </span>
        )}
      </div>
    </div>
  );
}
