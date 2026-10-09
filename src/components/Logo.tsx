/** billsplit brand mark: a receipt with a tick. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-mark">
      <rect width="48" height="48" rx="13" fill="var(--brand)" />
      <path
        d="M13 8h22v29l-2.75 2.5-2.75-2.5-2.75 2.5-2.75-2.5-2.75 2.5-2.75-2.5-2.75 2.5L13 37z"
        fill="var(--paper)"
      />
      <path d="M17.5 15h13M17.5 20.5h13M17.5 26h7" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="33" cy="33" r="8" fill="var(--mint)" stroke="var(--brand)" strokeWidth="2.5" />
      <path d="M29.6 33.2l2.3 2.3 4.4-4.6" fill="none" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark />
      <span>
        bill<b>split</b>
      </span>
    </span>
  );
}
