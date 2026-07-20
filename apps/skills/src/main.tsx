import "@site/design-system";
import { createRoot } from "react-dom/client";
import SkillsPage from "./page";

const root = document.getElementById("root");
if (!root) throw new Error("Missing remote root");
createRoot(root).render(<SkillsPage />);
