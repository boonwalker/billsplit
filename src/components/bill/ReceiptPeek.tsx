import { useEffect, useRef, useState, type RefObject } from "react";
import { t } from "../../lib/i18n";
import { scrollBehavior } from "../../lib/motion";

/**
 * First opening of a new bill (payer): the receipt peeks up from behind the bar at the top
 * (QR code, WhatsApp). On the first scroll down the snippet turns into the real receipt as
 * soon as that reaches it – and is not shown again for this bill.
 */
export default function ReceiptPeek({
  billId,
  title,
  scroller,
  bottom,
  hidden,
}: {
  billId: string;
  title: string;
  /** The scrolling part of the page. */
  scroller: RefObject<HTMLDivElement | null>;
  /** Distance from the bottom of the screen (it sits a little behind the bar). */
  bottom: number;
  /** At the end of the page (the bar is away there, so is the snippet). */
  hidden: boolean;
}) {
  // gone: handed over while a finger still strokes on it – invisible until the finger lets go.
  const [peek, setPeek] = useState<"off" | "on" | "following" | "gone">("off");
  const touching = useRef(false);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  // Only the very first time the payer opens this bill.
  useEffect(() => {
    const key = `billsplit.peekShown.${billId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // without storage it simply shows again next time
    }
    setPeek("on");
  }, [billId]);

  // The snippet keeps the width and place of the real paper; once the paper has scrolled up to
  // it, both are the same and the snippet hands over to the real receipt.
  useEffect(() => {
    if (peek === "off") return;
    const root = scroller.current;
    if (!root) return;
    const check = () => {
      const paper = document.querySelector<HTMLElement>("#receipt .receipt-paper");
      const snippet = ref.current;
      if (!paper || !snippet) return;
      const p = paper.getBoundingClientRect();
      setBox((b) => (b && b.left === p.left && b.width === p.width ? b : { left: p.left, width: p.width }));
      if (p.top <= snippet.getBoundingClientRect().top + 1) setPeek(touching.current ? "gone" : "off");
    };
    const onScroll = () => {
      setPeek((state) => (state === "on" ? "following" : state));
      check();
    };
    check();
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", check);
    };
  }, [peek !== "off", scroller]);

  // The snippet sits on top of the page, so a swipe that starts on it would not reach the page
  // below (on the iPhone nothing would move): its strokes and wheel turns scroll the page instead,
  // with a little momentum when the finger lets go. A tap still jumps to the receipt.
  const swipe = useRef<{ y: number; t: number; v: number; moved: boolean } | null>(null);
  useEffect(() => {
    const el = ref.current;
    const root = scroller.current;
    if (!el || !root) return;
    const onStart = (e: TouchEvent) => {
      touching.current = true;
      swipe.current = { y: e.touches[0].clientY, t: e.timeStamp, v: 0, moved: false };
    };
    const onMove = (e: TouchEvent) => {
      const s = swipe.current;
      if (!s) return;
      const y = e.touches[0].clientY;
      const dy = s.y - y;
      if (!s.moved && Math.abs(dy) < 6) return;
      s.moved = true;
      e.preventDefault();
      root.scrollTop += dy;
      const dt = Math.max(1, e.timeStamp - s.t);
      s.v = dy / dt;
      s.y = y;
      s.t = e.timeStamp;
    };
    const onEnd = () => {
      touching.current = false;
      setPeek((state) => (state === "gone" ? "off" : state));
      const s = swipe.current;
      swipe.current = s && s.moved ? { ...s, y: 0 } : null;
      if (s?.moved && Math.abs(s.v) > 0.1) root.scrollBy({ top: s.v * 320, behavior: scrollBehavior() });
    };
    const onWheel = (e: WheelEvent) => {
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
  }, [peek !== "off", hidden, scroller]);

  if (peek === "off" || hidden) return null;
  return (
    <button
      type="button"
      ref={ref}
      className={`receipt-peek${peek === "following" ? " following" : ""}${peek === "gone" ? " gone" : ""}`}
      aria-hidden={peek === "gone" || undefined}
      style={{ bottom, ...(box ? { left: box.left, width: box.width, transform: "none" } : {}) }}
      onClick={() => {
        // The end of a stroke is not a tap.
        if (swipe.current?.moved) {
          swipe.current = null;
          return;
        }
        document.querySelector("#receipt .receipt-paper")?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      }}
      aria-label={t("Zur interaktiven Rechnung")}
    >
      {/* The same paper as the receipt itself, so the hand-over is seamless. */}
      <span className="receipt-paper receipt-peek-paper">
        <span className="receipt-head">
          <span className="receipt-logo" aria-hidden="true">
            ✦
          </span>
          <span className="receipt-peek-title">{title || t("Rechnung")}</span>
          {/* For the payer every bill is interactive (crossing out, holding, equal split or not). */}
          <span className="receipt-peek-hint">{t("Deine interaktive Rechnung ist fertig ↓")}</span>
        </span>
      </span>
    </button>
  );
}
