import { Component, type ReactNode } from "react";
import { reportError } from "../lib/errorReport";
import { t } from "../lib/i18n";

/** A crashed screen shows a way out instead of a blank page – and the error reaches the admin page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    reportError(error, info.componentStack?.trim().split("\n")[0]?.trim());
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page">
        <main className="content crash">
          <h2>{t("Da ist etwas schiefgelaufen.")}</h2>
          <p className="muted">{t("Deine Rechnungen sind sicher gespeichert. Lade die Seite neu – meistens ist es dann erledigt.")}</p>
          <button type="button" className="btn btn-primary btn-large" onClick={() => window.location.reload()}>
            {t("Neu laden")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              window.location.hash = "/";
              window.location.reload();
            }}
          >
            {t("Zur Startseite")}
          </button>
        </main>
      </div>
    );
  }
}
