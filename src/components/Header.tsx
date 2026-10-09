import type { ReactNode } from "react";
import { navigate } from "../lib/router";
import { Wordmark } from "./Logo";

interface Props {
  title?: string;
  back?: string;
  action?: ReactNode;
}

export default function Header({ title, back, action }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {back !== undefined ? (
          <button className="icon-btn" aria-label="Zurück" onClick={() => navigate(back)}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <button className="brand-btn" onClick={() => navigate("/")} aria-label="billsplit Startseite">
            <Wordmark />
          </button>
        )}
      </div>
      <h1>{title}</h1>
      <div className="topbar-action">{action}</div>
    </header>
  );
}
