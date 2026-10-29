import { lazy, Suspense, type ReactNode } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import HandoffPrompt from "./components/HandoffPrompt";
import MovedNotice from "./components/MovedNotice";
import { useAppEvents } from "./lib/liveEvents";
import { useRoute } from "./lib/router";
import BillPage from "./pages/BillPage";
import Dashboard from "./pages/Dashboard";
import DeviceLink from "./pages/DeviceLink";
import Editor from "./pages/Editor";
import Home from "./pages/Home";
import OriginalReceipt from "./pages/OriginalReceipt";
import Profile from "./pages/Profile";
import SignIn from "./pages/SignIn";
import Expense from "./pages/Expense";
import Move from "./pages/Move";
import Legal from "./pages/Legal";
import Restaurant from "./pages/Restaurant";
import TableWait from "./pages/TableWait";

// The scanner pulls in the QR decoder; only load it when needed.
const Scan = lazy(() => import("./pages/Scan"));

export default function App() {
  useAppEvents();
  return (
    <>
      <ErrorBoundary>
        <Page />
        <HandoffPrompt />
        <MovedNotice />
      </ErrorBoundary>
    </>
  );
}

function Page(): ReactNode {
  const route = useRoute();
  switch (route.name) {
    case "profile":
      return <Profile next={route.next} />;
    case "signin":
      return <SignIn />;
    case "expense":
      return <Expense />;
    case "new":
      return <Editor key="new" />;
    case "edit":
      return <Editor key={`edit-${route.id}`} billId={route.id} />;
    case "scan":
      return (
        <Suspense fallback={null}>
          <Scan />
        </Suspense>
      );
    case "bill":
      return <BillPage key={route.id} id={route.id} focus={route.focus} back={route.back} recipient={route.recipient} />;
    case "original":
      return <OriginalReceipt id={route.id} />;
    case "dashboard":
      return <Dashboard key={route.transfer ?? ""} focusTransfer={route.transfer} />;
    case "device":
      return <DeviceLink code={route.code} />;
    case "move":
      return <Move code={route.code} target={route.target} app={route.app} />;
    case "restaurant":
      return <Restaurant key={String(route.qr)} qr={route.qr} />;
    case "table":
      return <TableWait id={route.id} />;
    case "privacy":
      return <Legal kind="privacy" />;
    case "imprint":
      return <Legal kind="imprint" />;
    default:
      return <Home />;
  }
}
