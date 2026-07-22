import "@site/design-system";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename="/nick-derobertis-site">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
