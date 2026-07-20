import { createRoot } from "react-dom/client";
import Page from "./page";
import SelectedPage from "./selected-page";

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
const PageToRender = window.location.pathname.endsWith("/selected/")
  ? SelectedPage
  : Page;
createRoot(root).render(<PageToRender />);
