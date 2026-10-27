import { useEffect, useState } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import type { TableInfo } from "../lib/bill";
import { t } from "../lib/i18n";
import { navigate } from "../lib/router";

/** How often a guest's waiting page asks whether the staff opened the bill. */
const POLL_MS = 4000;

/**
 * A table's QR code while no bill is open there (restaurant mode): the guest waits here and
 * lands in the bill as soon as the staff opens it.
 */
export default function TableWait({ id }: { id: string }) {
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stopped = false;
    const check = () =>
      api
        .table(id)
        .then((table) => {
          if (stopped) return;
          if (table.billId) navigate(`/b/${table.billId}`, { replace: true });
          else setInfo(table);
        })
        .catch(() => !stopped && setMissing(true));
    void check();
    const timer = window.setInterval(() => void check(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [id]);

  return (
    <div className="page">
      <Header back="/" />
      <main className="content">
        <div className="empty-state table-wait">
          <div className="empty-emoji">🧾</div>
          {missing ? (
            <h2>{t("Diesen Tisch gibt es nicht.")}</h2>
          ) : (
            <>
              <h2>{info ? `${info.venue} · ${info.table}` : t("Wird geladen …")}</h2>
              <p className="muted">{t("Noch keine Rechnung an diesem Tisch. Sobald das Personal sie anlegt, erscheint sie hier von selbst.")}</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
