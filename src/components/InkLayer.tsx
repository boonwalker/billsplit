import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Stroke } from "../lib/ink";

interface Props {
  /** Called with the strokes (in viewport coordinates) once the finger rested for a moment. */
  onInk: (strokes: Stroke[]) => void;
  /** Called when a stroke begins. */
  onStart?: () => void;
}

/** Pause after the last stroke before the writing is read, so "/" and "3" can be drawn separately. */
const IDLE_MS = 800;

/** A transparent sheet over the receipt lines to write on with a finger, drawn like pencil. */
export default function InkLayer({ onInk, onStart }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef(false);
  const timer = useRef<number | null>(null);
  /** Two fingers scroll instead of writing (the sheet stays scrollable over long receipts). */
  const pointers = useRef(new Map<number, number>());
  const scrolling = useRef(false);

  // Match the canvas to its size on screen (sharp lines on retina displays).
  useEffect(() => {
    const el = canvas.current!;
    const fit = () => {
      const rect = el.getBoundingClientRect();
      el.width = rect.width * devicePixelRatio;
      el.height = rect.height * devicePixelRatio;
      redraw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function redraw() {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const rect = el.getBoundingClientRect();
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = getComputedStyle(el).color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.85;
    for (const stroke of strokes.current) {
      ctx.beginPath();
      stroke.forEach((p, i) => (i ? ctx.lineTo(p.x - rect.left, p.y - rect.top) : ctx.moveTo(p.x - rect.left, p.y - rect.top)));
      ctx.stroke();
    }
  }

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, e.clientY);
    if (pointers.current.size > 1) {
      // Second finger: this is scrolling, drop the stroke the first finger began.
      if (drawing.current) strokes.current.pop();
      drawing.current = false;
      scrolling.current = true;
      redraw();
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    drawing.current = true;
    onStart?.();
    strokes.current.push([{ x: e.clientX, y: e.clientY }]);
    redraw();
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (scrolling.current) {
      const last = pointers.current.get(e.pointerId);
      pointers.current.set(e.pointerId, e.clientY);
      if (last === undefined) return;
      const scroller = canvas.current?.closest(".sheet") ?? document.scrollingElement;
      scroller?.scrollBy(0, (last - e.clientY) / Math.max(1, pointers.current.size));
      return;
    }
    if (!drawing.current) return;
    strokes.current[strokes.current.length - 1].push({ x: e.clientX, y: e.clientY });
    redraw();
  }

  function up(e: ReactPointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    if (scrolling.current) {
      if (pointers.current.size === 0) scrolling.current = false;
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    timer.current = window.setTimeout(() => {
      const written = strokes.current;
      strokes.current = [];
      redraw();
      onInk(written);
    }, IDLE_MS);
  }

  return (
    <canvas
      ref={canvas}
      className="ink-layer"
      aria-label="Schreibfläche: mit dem Finger z. B. /3 auf eine Zeile schreiben"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  );
}
