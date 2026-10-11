/** klicksplit brand mark: a receipt with a tick – the ring around it is the tap ("klick"). */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-mark">
      <rect width="48" height="48" rx="13" fill="var(--brand)" />
      <path
        d="M12 7h21v29l-2.62 2.4-2.63-2.4-2.62 2.4-2.63-2.4-2.62 2.4-2.63-2.4-2.62 2.4L12 36z"
        fill="var(--paper)"
      />
      <path d="M16.5 14h12M16.5 19.5h12M16.5 25h6.5" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="33.5" cy="33.5" r="11.5" fill="none" stroke="var(--mint)" strokeWidth="1.4" opacity="0.55" />
      <circle cx="33.5" cy="33.5" r="7.8" fill="var(--mint)" stroke="var(--brand)" strokeWidth="2.4" />
      <path d="M30.2 33.7l2.2 2.2 4.3-4.5" fill="none" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ size }: { size?: number }) {
  return (
    <span className="wordmark" style={size ? { fontSize: `${(size / 30) * 1.25}rem`, gap: `${(size / 30) * 8}px` } : undefined}>
      <LogoMark size={size} />
      <span>
        klick<b>split</b>
      </span>
    </span>
  );
}
