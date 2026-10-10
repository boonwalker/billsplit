import { useEffect, useRef } from "react";
import type { BillSnapshot } from "../../lib/bill";
import { formatMoney } from "../../lib/money";

/** The payer's bar at the bottom: what is still missing; away at the end of the page, where the panel says the same. */
export default function OwnerBar({
  snapshot: snap,
  missing,
  away,
  onHeight,
}: {
  snapshot: BillSnapshot;
  missing: number;
  away: boolean;
  onHeight: (height: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
          Dir fehlen noch
          <small>
            {snap.debtors?.filter((d) => d.payClickedAt).length ?? 0} von {snap.debtors?.length ?? 0} haben auf Bezahlen getippt
          </small>
        </span>
        <strong>{formatMoney(missing, snap.data.currency)}</strong>
      </div>
    </div>
  );
}
