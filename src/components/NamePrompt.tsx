import { useState, type ReactNode } from "react";
import { LogoMark } from "./Logo";

interface Props {
  ownerName: string;
  initialName?: string;
  onSubmit: (name: string) => void;
  /** Shown below the button, e.g. the offer to open the bill in the home-screen app. */
  extra?: ReactNode;
}

/** Asks friends for their profile name before they join a bill. */
export default function NamePrompt({ ownerName, initialName = "", onSubmit, extra }: Props) {
  const [name, setName] = useState(initialName);
  return (
    <div className="sheet-backdrop">
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <div className="sheet-logo" aria-hidden="true">
          <LogoMark size={52} />
        </div>
        <h2>Wie heißt du?</h2>
        <p className="muted">
          {ownerName || "Jemand"} hat die Rechnung bezahlt. Mit deinem Namen sehen alle, welche Positionen du übernimmst.
        </p>
        <input autoFocus={!initialName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" maxLength={40} autoComplete="given-name" />
        <button className="btn btn-primary btn-large" disabled={!name.trim()}>
          Zur Rechnung
        </button>
        {extra}
      </form>
    </div>
  );
}
