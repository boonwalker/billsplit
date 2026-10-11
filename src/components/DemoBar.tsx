import { FRIENDS, setPersona, usePersona, type PersonaId } from "../lib/demo";
import { t } from "../lib/i18n";
import { loadOwnProfile } from "../lib/storage";

/** Demo only: look at the same bill as the payer or as one of the friends. */
export default function DemoBar() {
  const persona = usePersona();
  const ownName = loadOwnProfile().name || t("Du");
  const options: { id: PersonaId; label: string; hint: string }[] = [
    { id: "me", label: ownName, hint: t("zahlt") },
    ...FRIENDS.map((f) => ({ id: f.id, label: f.name, hint: t("Freund") })),
  ];
  return (
    <div className="demo-bar">
      <span className="demo-label">{t("Demo · Ansicht als")}</span>
      <div className="seg" role="radiogroup" aria-label={t("Ansicht als")}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={persona === o.id} className={persona === o.id ? "on" : ""} onClick={() => setPersona(o.id)}>
            <b>{o.label}</b>
            <small>{o.hint}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
