import { lazy, Suspense } from "react";
import { useRoute } from "./lib/router";
import BillPage from "./pages/BillPage";
import Editor from "./pages/Editor";
import Home from "./pages/Home";
import Profile from "./pages/Profile";

// The scanner pulls in the QR decoder; only load it when needed.
const Scan = lazy(() => import("./pages/Scan"));

export default function App() {
  const route = useRoute();
  switch (route.name) {
    case "profile":
      return <Profile next={route.next} />;
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
      return <BillPage key={route.id} id={route.id} />;
    default:
      return <Home />;
  }
}
