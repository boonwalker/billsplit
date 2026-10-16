import { t } from "../lib/i18n";
import { navigate } from "../lib/router";

/** "Datenschutz · Impressum" at the foot of the start page and the profile. */
export default function LegalLinks() {
  return (
    <nav className="legal-links" aria-label={t("Rechtliches")}>
      <button type="button" onClick={() => navigate("/datenschutz")}>
        {t("Datenschutz")}
      </button>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={() => navigate("/impressum")}>
        {t("Impressum")}
      </button>
    </nav>
  );
}
