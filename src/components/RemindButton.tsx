import { useState } from "react";
import { REMIND_COOLDOWN_MS } from "../lib/billCore";
import { formatDate, t } from "../lib/i18n";
import { whatsappLink } from "../lib/whatsapp";

/** "vor 5 Min.", "vor 2 Std." – when the last reminder went out. */
export function remindedAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return t("gerade eben");
  if (minutes < 60) return t("vor {n} Min.", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("vor {n} Std.", { n: hours });
  return t("am {date}", { date: formatDate(iso) });
}

/** A notification may go out: it reaches the person and the last one is long enough ago. */
export function canRemindByPush(reachable: boolean | undefined, remindedAt: string | undefined, now = Date.now()): boolean {
  return Boolean(reachable) && !(remindedAt && now - Date.parse(remindedAt) < REMIND_COOLDOWN_MS);
}

/**
 * "Erinnern": a notification when it reaches the person (the preferred way) – otherwise, or
 * right after one went out, WhatsApp with the prepared text.
 */
export default function RemindButton({
  name,
  reachable,
  remindedAt,
  whatsappText,
  onPush,
}: {
  name: string;
  reachable?: boolean;
  remindedAt?: string;
  whatsappText: string;
  onPush: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canRemindByPush(reachable, remindedAt)) {
    return (
      <a className="remind-btn" href={whatsappLink(whatsappText)} aria-label={t("{name} per WhatsApp erinnern", { name })}>
        {t("Erinnern")}
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        className="remind-btn"
        disabled={busy}
        aria-label={t("{name} per Mitteilung erinnern", { name })}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onPush();
          } catch (e) {
            setError(e instanceof Error ? e.message : t("Das hat nicht geklappt."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("Erinnern")}
      </button>
      {error && (
        <span className="remind-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
