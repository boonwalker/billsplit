import { useEffect, useState, type CSSProperties } from "react";
import { Handwritten, tailApex } from "./ClaimDemo";

/**
 * The payer's intro on the receipt ("Manches nicht" and the finished bill in the equal split),
 * in a loop until they touch it: a line gets crossed out with the finger, another one is tapped
 * and then crossed out, and a third is held down until "/2" appears.
 */

interface Spot {
  id: string;
  x: number;
  y: number;
}

export interface DemoLayout {
  /** Crossed out without a visible tap first. */
  strike?: Spot;
  /** Tapped, then crossed out. */
  tap?: Spot;
  /** Held down; bottom for the speech bubble, end of the name (its last line) for the pencilled "/2". */
  hold?: Spot & { bottom: number; nameEnd: { x: number; y: number } };
  width: number;
}

export type DemoPhase = "strike" | "tap" | "press" | "held" | "pause";

/**
 * Where the demos run, from the laid out lines. Layout offsets (relative to the wrapper of the
 * list) are not affected by the lines' print-in animations. Only single items are crossed out:
 * on a line with several units a tap or stroke takes just one of them.
 */
export function demoLayout(list: HTMLUListElement, selector = "li[data-item]"): DemoLayout | null {
  const lines = [...list.querySelectorAll<HTMLElement>(selector)];
  const wrap = list.parentElement;
  if (!lines.length || !wrap) return null;
  const box = wrap.getBoundingClientRect();
  const spot = (line: HTMLElement) => {
    const name = line.querySelector<HTMLElement>(".rline-strike");
    // Through the item name, also when a unit price is printed below it.
    const row = line.querySelector<HTMLElement>(".rline-name");
    return {
      id: line.dataset.item ?? "",
      x: line.offsetLeft + (name?.offsetLeft ?? 0) + Math.min((name?.offsetWidth ?? 80) / 2, 70),
      y: line.offsetTop + (row ? row.offsetTop + row.offsetHeight * 0.55 : line.offsetHeight / 2),
      // A long name wraps: the "/2" goes after its last line.
      nameEnd: (() => {
        const rects = name?.getClientRects();
        const last = rects?.[rects.length - 1];
        return last ? { x: last.right - box.left, y: last.top + last.height / 2 - box.top } : { x: 80, y: line.offsetTop + line.offsetHeight / 2 };
      })(),
      bottom: line.offsetTop + line.offsetHeight,
    };
  };
  const singles = lines.filter((line) => line.dataset.qty === "1");
  const [strikeLine, tapLine] = singles;
  // The long press too only on a single item, preferably a third one (the steps run one after
  // another, so otherwise one of the first two); without any single item it is left out.
  const holdLine = singles[2] ?? singles[0];
  return {
    strike: strikeLine && spot(strikeLine),
    tap: tapLine && spot(tapLine),
    hold: holdLine && spot(holdLine),
    width: wrap.offsetWidth,
  };
}

const STEPS: { phase: DemoPhase; ms: number }[] = [
  { phase: "pause", ms: 700 },
  { phase: "strike", ms: 2500 },
  { phase: "pause", ms: 500 },
  { phase: "tap", ms: 3000 },
  { phase: "pause", ms: 500 },
  { phase: "press", ms: 1100 },
  { phase: "held", ms: 3600 },
  { phase: "pause", ms: 900 },
];

/** Runs the demo steps in a loop while active; steps whose line is missing are skipped. */
export function useDemoLoop(layout: DemoLayout | null, active: boolean): { phase: DemoPhase; round: number } {
  const [state, setState] = useState({ step: 0, round: 0 });
  useEffect(() => {
    if (!active || !layout) return;
    const usable = (phase: DemoPhase) =>
      phase === "pause" || (phase === "strike" ? layout.strike : phase === "tap" ? layout.tap : layout.hold) !== undefined;
    let timer = 0;
    let step = 0;
    let round = 0;
    const next = () => {
      do {
        step = (step + 1) % STEPS.length;
        if (step === 0) round++;
      } while (!usable(STEPS[step].phase));
      setState({ step, round });
      timer = window.setTimeout(next, STEPS[step].ms);
    };
    setState({ step: 0, round: 0 });
    timer = window.setTimeout(next, STEPS[0].ms);
    return () => window.clearTimeout(timer);
  }, [layout, active]);
  return { phase: active && layout ? STEPS[state.step].phase : "pause", round: state.round };
}

const strikePath = (y: number, width: number) =>
  `M6 ${y + 2} C ${width * 0.3} ${y - 3}, ${width * 0.6} ${y + 4}, ${width - 8} ${y - 1}`;

/**
 * The demo drawing over the lines. ghostDivisor: pencil the "/2" next to the held line here
 * (the "Manches nicht" receipt shows it on the line itself, with the price).
 */
export default function ReceiptDemo({
  layout,
  phase,
  round,
  ghostDivisor = false,
}: {
  layout: DemoLayout;
  phase: DemoPhase;
  round: number;
  ghostDivisor?: boolean;
}) {
  const { strike, tap, hold, width } = layout;
  const key = `${round}-${phase}`;
  return (
    <>
      {(phase === "strike" || phase === "tap") && (
        <svg key={key} className="rdemo" width={width} height="100%" aria-hidden="true">
          {phase === "strike" && strike && <path className="rdemo-strike" pathLength={1} d={strikePath(strike.y, width)} />}
          {phase === "tap" && tap && (
            <>
              <circle className="rdemo-tap" cx={tap.x} cy={tap.y} r="16" />
              <path className="rdemo-strike after-tap" pathLength={1} d={strikePath(tap.y, width)} />
            </>
          )}
        </svg>
      )}
      {/* Long press: a ring fills around the resting finger, then "/2" appears. */}
      {phase === "press" && hold && (
        <svg key={key} className="hold-demo" style={{ left: hold.x - 26, top: hold.y - 26 }} width="52" height="52" aria-hidden="true">
          <circle className="hold-demo-dot" cx="26" cy="26" r="15" />
          <circle className="hold-demo-ring" cx="26" cy="26" r="22" pathLength={1} />
        </svg>
      )}
      {phase === "held" && hold && (
        <>
          {ghostDivisor && (
            <span className="pencil rdemo-divisor" style={{ left: hold.nameEnd.x + 8, top: hold.nameEnd.y }} aria-hidden="true">
              /2
            </span>
          )}
          <div
            className="claim-demo-bubble hold-demo-bubble"
            style={
              {
                left: Math.max(4, hold.x - 22),
                top: hold.bottom + 14,
                maxWidth: `calc(100% - ${Math.max(4, hold.x - 22) + 26}px)`,
                "--tail-apex": tailApex(hold.x, Math.max(4, hold.x - 22)),
              } as CSSProperties
            }
          >
            <Handwritten text="Gedrückt halten = nur einen Teil in Rechnung stellen" />
          </div>
        </>
      )}
    </>
  );
}
