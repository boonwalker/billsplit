import { useRoute } from "./lib/router";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Editor from "./pages/Editor";
import Share from "./pages/Share";
import ViewBill from "./pages/ViewBill";

export default function App() {
  const route = useRoute();
  switch (route.name) {
    case "settings":
      return <Settings />;
    case "editor":
      return <Editor />;
    case "share":
      return <Share data={route.data} />;
    case "view":
      return <ViewBill data={route.data} />;
    default:
      return <Home />;
  }
}
