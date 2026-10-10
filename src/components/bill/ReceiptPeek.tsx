import { useEffect, useRef, useState, type RefObject } from "react";

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
  const [peek, setPeek] = useState<"off" | "on" | "following">("off");
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
      if (p.top <= snippet.getBoundingClientRect().top + 1) setPeek("off");
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

  if (peek === "off" || hidden) return null;
  return (
    <button
      type="button"
      ref={ref}
      className={`receipt-peek${peek === "following" ? " following" : ""}`}
      style={{ bottom, ...(box ? { left: box.left, width: box.width, transform: "none" } : {}) }}
      onClick={() => document.querySelector("#receipt .receipt-paper")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      aria-label="Zur interaktiven Rechnung"
    >
      {/* The same paper as the receipt itself, so the hand-over is seamless. */}
      <span className="receipt-paper receipt-peek-paper">
        <span className="receipt-head">
          <span className="receipt-logo" aria-hidden="true">
            ✦
          </span>
          <span className="receipt-peek-title">{title || "Rechnung"}</span>
          {/* For the payer every bill is interactive (crossing out, holding, equal split or not). */}
          <span className="receipt-peek-hint">Deine interaktive Rechnung ist fertig ↓</span>
        </span>
      </span>
    </button>
  );
}
