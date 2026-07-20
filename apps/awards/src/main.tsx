import { createRoot } from "react-dom/client";
import Page from "./page";
import { parseAwardsRoute } from "./route";
import SelectedPage from "./selected-page";

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
const PageToRender =
  parseAwardsRoute(window.location.pathname) === "selected"
    ? SelectedPage
    : Page;
createRoot(root).render(<PageToRender />);
