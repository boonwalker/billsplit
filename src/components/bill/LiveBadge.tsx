/** "● live · 👤 3": connected live, and how many people of this bill have the app open right now. */
export default function LiveBadge({ live, online }: { live: boolean; online?: number }) {
  return (
    <span
      className={`live-dot${live ? " on" : ""}`}
      title={live ? `Live verbunden${online ? ` · ${online} ${online === 1 ? "Person hat" : "Personen haben"} die App gerade offen` : ""}` : "Verbinde …"}
    >
      {live ? "live" : "…"}
      {live && online ? (
        <span className="live-count" aria-label={`${online} online`}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <circle cx="8" cy="5" r="3" fill="currentColor" />
            <path d="M2.5 14.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" fill="currentColor" />
          </svg>
          {online}
        </span>
      ) : null}
    </span>
  );
}
