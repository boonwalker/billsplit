import AccountForm from "../components/AccountForm";
import Header from "../components/Header";
import { t } from "../lib/i18n";
import { navigate } from "../lib/router";

/** "Schon ein Konto? Anmelden" from the start page: e-mail, code – and the bills are here. */
export default function SignIn() {
  return (
    <div className="page">
      <Header back="/" title={t("Anmelden")} />
      <main className="content">
        <div className="card account-card">
          <AccountForm onDone={() => navigate("/", { replace: true })} />
        </div>
      </main>
    </div>
  );
}
