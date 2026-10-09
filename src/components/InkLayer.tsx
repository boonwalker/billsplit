import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { InkPoint, Stroke } from "../lib/ink";

interface Props {
  /** Called with the strokes (in viewport coordinates) once the finger rested for a moment. */
  onInk: (strokes: Stroke[]) => void;
  /** Called when a stroke begins. */
  onStart?: () => void;
  /** A tap (touch without drawing) at this viewport position, e.g. on a price or a drawing. */
  onTap?: (point: InkPoint) => void;
}

/** Movement up to which a touch counts as a tap, not as a stroke. */
const TAP_SLOP = 8;

/** Pause after the last stroke before it is read. */
const IDLE_MS = 800;
/** Read strokes stay visible this long and fade while the line takes on its new look. */
const FADE_MS = 900;

/** A transparent sheet over the receipt lines to write on with a finger, drawn like pencil. */
export default function InkLayer({ onInk, onStart, onTap }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef(false);
  const timer = useRef<number | null>(null);
  const fading = useRef<{ strokes: Stroke[]; start: number }[]>([]);
  const frame = useRef<number | null>(null);

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
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  /** Pencil-like line: a firm stroke with a lighter, slightly offset second pass. */
  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, rect: DOMRect, alpha: number) {
    const path = (dx: number, dy: number) => {
      ctx.beginPath();
      stroke.forEach((p, i) =>
        i ? ctx.lineTo(p.x - rect.left + dx, p.y - rect.top + dy) : ctx.moveTo(p.x - rect.left + dx, p.y - rect.top + dy),
      );
      ctx.stroke();
    };
    ctx.globalAlpha = 0.85 * alpha;
    ctx.lineWidth = 2.8;
    path(0, 0);
    ctx.globalAlpha = 0.3 * alpha;
    ctx.lineWidth = 1.4;
    path(0.8, 0.9);
  }

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
    const now = performance.now();
    fading.current = fading.current.filter((f) => now - f.start < FADE_MS);
    for (const f of fading.current) {
      const left = 1 - (now - f.start) / FADE_MS;
      for (const stroke of f.strokes) drawStroke(ctx, stroke, rect, left * left);
    }
    for (const stroke of strokes.current) drawStroke(ctx, stroke, rect, 1);
  }

  /** Keeps repainting while read strokes are fading out. */
  function animateFade() {
    redraw();
    frame.current = fading.current.length ? requestAnimationFrame(animateFade) : null;
  }

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (drawing.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (timer.current) window.clearTimeout(timer.current);
    drawing.current = true;
    onStart?.();
    strokes.current.push([{ x: e.clientX, y: e.clientY }]);
    redraw();
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    strokes.current[strokes.current.length - 1].push({ x: e.clientX, y: e.clientY });
    redraw();
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    const stroke = strokes.current[strokes.current.length - 1];
    const moved = Math.max(...stroke.map((p) => Math.hypot(p.x - stroke[0].x, p.y - stroke[0].y)));
    if (onTap && moved <= TAP_SLOP) {
      // A tap, not writing: hand it over right away (any earlier strokes still get read).
      strokes.current.pop();
      redraw();
      onTap(stroke[0]);
      if (!strokes.current.length) return;
    }
    timer.current = window.setTimeout(() => {
      const written = strokes.current;
      strokes.current = [];
      fading.current.push({ strokes: written, start: performance.now() });
      if (!frame.current) animateFade();
      onInk(written);
    }, IDLE_MS);
  }

  /**
   * The browser took the touch over for scrolling (an up/down swipe – the canvas only
   * allows vertical panning): it was not a stroke, so drop it.
   */
  function cancel() {
    if (!drawing.current) return;
    drawing.current = false;
    strokes.current.pop();
    redraw();
  }

  return (
    <canvas
      ref={canvas}
      className="ink-layer"
      aria-label="Fläche zum Durchstreichen und Antippen der Zeilen"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
    />
  );
}
