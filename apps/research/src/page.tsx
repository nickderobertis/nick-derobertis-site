import type { Research } from "@site/data-access";
import { validateCvDomain } from "@site/data-access";
import { useEffect, useState } from "react";
import { ResearchContent } from "./research-content";
import "@site/design-system";
import "./research.css";

type ResearchViewState =
  | { name: "loading" }
  | { name: "error" }
  | { name: "ready"; research: Research };

function researchUrl() {
  const url = new URL(
    "/nick-derobertis-site/cv-data/domains/research.json",
    window.location.origin,
  );
  const scenario = new URLSearchParams(window.location.search).get(
    "research-scenario",
  );
  if (scenario) url.searchParams.set("scenario", scenario);
  return url;
}

async function loadResearch(signal: AbortSignal) {
  const response = await fetch(researchUrl(), { signal });
  if (!response.ok)
    throw new Error(`Research request failed: ${response.status}`);
  return validateCvDomain("research", await response.json());
}

function StateMessage({ state }: { state: "empty" | "loading" | "error" }) {
  const messages = {
    empty: ["No research projects yet", "New research will appear here."],
    error: [
      "Research is unavailable",
      "The research collection could not be loaded. Please try again later.",
    ],
    loading: ["Loading research", "Gathering working papers and projects…"],
  } as const;
  const [heading, detail] = messages[state];
  return (
    <section className="research-state" aria-live="polite">
      <h2>{heading}</h2>
      <p>{detail}</p>
    </section>
  );
}

export default function ResearchPage() {
  const [state, setState] = useState<ResearchViewState>({ name: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    loadResearch(controller.signal).then(
      (research) => setState({ name: "ready", research }),
      (error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setState({ name: "error" });
      },
    );
    return () => controller.abort();
  }, []);
  if (state.name !== "ready") return <StateMessage state={state.name} />;
  if (!state.research.projects?.length) return <StateMessage state="empty" />;
  return <ResearchContent research={state.research} />;
}
