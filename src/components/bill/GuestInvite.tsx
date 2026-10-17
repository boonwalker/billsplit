import { t } from "../../lib/i18n";
import { navigate } from "../../lib/router";
import { loadRecent } from "../../lib/storage";

/**
 * A friend who paid their share already knows klicksplit from the other side: next time they
 * could be the one who pays. Below the receipt, until they made a bill of their own.
 */
export default function GuestInvite() {
  if (loadRecent().some((b) => b.role === "owner")) return null;
  return (
    <section className="card guest-invite" aria-label={t("Nächstes Mal bezahlst Du?")}>
      <h3>{t("Nächstes Mal bezahlst Du?")}</h3>
      <p>{t("Mit klicksplit fotografierst Du den Beleg und bekommst alles zurück.")}</p>
      <button type="button" className="btn btn-secondary" onClick={() => navigate("/")}>
        {t("So geht's")}
      </button>
    </section>
  );
}
