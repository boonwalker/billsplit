/** "/ 4" with pencilled arrows: what everything is divided by – the head count for the equal split. */
export default function DivideBy({
  value,
  onChange,
  label = "Alles geteilt durch",
  className = "",
}: {
  /** undefined: not chosen yet ("?"). */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`divide-by ${className}`.trim()} role="group" aria-label={label}>
      {/* A pencilled "/" – a firm stroke with a fainter second pass. */}
      <svg className="divide-by-sign" viewBox="0 0 40 90" aria-hidden="true">
        <path d="M33 5 C 28 28, 19 55, 7 86" />
        <path d="M35 9 C 29 33, 21 58, 10 84" className="divide-by-sign-thin" />
      </svg>
      <span className="divide-by-value" aria-live="polite">
        {value ?? "?"}
      </span>
      <div className="divide-by-arrows">
        <button type="button" onClick={() => onChange(Math.min(100, (value ?? 1) + 1))} aria-label="Eine Person mehr">
          <svg viewBox="0 0 40 20" aria-hidden="true">
            <path d="M4 16 C 12 10, 16 6, 20 3 C 25 7, 30 11, 36 16" />
          </svg>
        </button>
        <button type="button" onClick={() => onChange(value && value > 2 ? value - 1 : undefined)} aria-label="Eine Person weniger">
          <svg viewBox="0 0 40 20" aria-hidden="true">
            <path d="M4 4 C 12 10, 16 14, 20 17 C 25 13, 30 9, 36 4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
