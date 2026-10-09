import { useState } from "react";

interface Props {
  ownerName: string;
  onSubmit: (name: string) => void;
}

/** Asks friends for their profile name before they join a bill. */
export default function NamePrompt({ ownerName, onSubmit }: Props) {
  const [name, setName] = useState("");
  return (
    <div className="sheet-backdrop">
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <div className="sheet-emoji" aria-hidden="true">
          👋
        </div>
        <h2>Wie heißt du?</h2>
        <p className="muted">
          {ownerName || "Jemand"} hat die Rechnung bezahlt. Mit deinem Namen sehen alle, welche Positionen du übernimmst.
        </p>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" maxLength={40} autoComplete="given-name" />
        <button className="btn btn-primary btn-large" disabled={!name.trim()}>
          Zur Rechnung
        </button>
      </form>
    </div>
  );
}
