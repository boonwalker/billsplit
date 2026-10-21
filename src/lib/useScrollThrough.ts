import { useEffect, useRef, type RefObject } from "react";
import { scrollBehavior } from "./motion";

export interface ScrollThrough {
  /** The last touch on the element was a stroke, not a tap (its click is to be ignored once). */
  stroked: () => boolean;
}

/**
 * Elements lying on top of a scrolling page (the bottom bars, the receipt snippet) take the
 * touches that start on them – on the iPhone a swipe there would move nothing, and in Safari
 * with its toolbars they cover a good part of the screen. Their vertical strokes and wheel
 * turns scroll the page instead, with a little momentum when the finger lets go; taps and
 * buttons on them work as before. Touches inside a sheet opened from such an element are left
 * alone. onTouch: a finger is on the element (true) or let go (false).
 */
export function useScrollThrough(
  target: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
  active = true,
  onTouch?: (down: boolean) => void,
): ScrollThrough {
  const stroke = useRef<{ y: number; t: number; v: number; moved: boolean } | null>(null);
  const lastStroke = useRef(false);
  const touchCallback = useRef(onTouch);
  touchCallback.current = onTouch;

  useEffect(() => {
    const el = target.current;
    const root = scroller.current;
    if (!active || !el || !root) return;
    const own = (e: Event) => !(e.target instanceof Element && e.target.closest(".sheet-backdrop, input, textarea, select"));
    const onStart = (e: TouchEvent) => {
      if (!own(e)) return;
      touchCallback.current?.(true);
      lastStroke.current = false;
      stroke.current = { y: e.touches[0].clientY, t: e.timeStamp, v: 0, moved: false };
    };
    const onMove = (e: TouchEvent) => {
      const s = stroke.current;
      if (!s) return;
      const y = e.touches[0].clientY;
      const dy = s.y - y;
      if (!s.moved && Math.abs(dy) < 6) return;
      s.moved = true;
      if (e.cancelable) e.preventDefault();
      root.scrollTop += dy;
      s.v = dy / Math.max(1, e.timeStamp - s.t);
      s.y = y;
      s.t = e.timeStamp;
    };
    const onEnd = () => {
      const s = stroke.current;
      stroke.current = null;
      if (!s) return;
      touchCallback.current?.(false);
      lastStroke.current = s.moved;
      if (s.moved && Math.abs(s.v) > 0.1) root.scrollBy({ top: s.v * 320, behavior: scrollBehavior() });
    };
    const onWheel = (e: WheelEvent) => {
      if (!own(e)) return;
      e.preventDefault();
      root.scrollTop += e.deltaY;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [target, scroller, active]);

  return {
    stroked: () => {
      const was = lastStroke.current;
      lastStroke.current = false;
      return was;
    },
  };
}
