import { useEffect, useRef, type RefObject } from "react";
import type { BillSnapshot } from "../../lib/bill";
import { t } from "../../lib/i18n";
import { formatMoney } from "../../lib/money";
import { useScrollThrough } from "../../lib/useScrollThrough";

/** The payer's bar at the bottom: what is still missing; away at the end of the page, where the panel says the same. */
export default function OwnerBar({
  snapshot: snap,
  missing,
  away,
  onHeight,
  scroller,
}: {
  snapshot: BillSnapshot;
  missing: number;
  away: boolean;
  onHeight: (height: number) => void;
  /** The page below: strokes on the bar scroll it (see useScrollThrough). */
  scroller: RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollThrough(ref, scroller, !away);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => onHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeight]);

  return (
    <div className={`ownerbar${away ? " away" : ""}`} aria-hidden={away} ref={ref}>
      <div className="ownerbar-inner">
        <span>
          {t("Dir fehlen noch")}
          {/* Only once someone joined: "0 von 0" says nothing. */}
          {(snap.debtors?.length ?? 0) > 0 && (
            <small>
              {t("{tapped} von {count} haben auf Bezahlen getippt", {
                tapped: snap.debtors?.filter((d) => d.payClickedAt).length ?? 0,
                count: snap.debtors?.length ?? 0,
              })}
            </small>
          )}
        </span>
        <strong>{formatMoney(missing, snap.data.currency)}</strong>
      </div>
    </div>
  );
}
