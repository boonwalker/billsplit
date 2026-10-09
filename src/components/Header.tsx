import type { ReactNode } from "react";
import { navigate } from "../lib/router";

interface Props {
  title: string;
  back?: string;
  action?: ReactNode;
}

export default function Header({ title, back, action }: Props) {
  return (
    <header className="topbar">
      {back !== undefined ? (
        <button className="icon-btn" aria-label="Zurück" onClick={() => navigate(back)}>
          ←
        </button>
      ) : (
        <span className="logo" aria-hidden="true">
          🧾
        </span>
      )}
      <h1>{title}</h1>
      <div className="topbar-action">{action}</div>
    </header>
  );
}
