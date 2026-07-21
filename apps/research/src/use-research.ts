import type { Research } from "@site/data-access-core";
import { validateCvDomain } from "@site/data-access-core";
import { useEffect, useState } from "react";

export type ResearchViewState =
  | { name: "loading" }
  | { name: "error" }
  | { name: "ready"; research: Research };

const researchScenarios = new Set(["empty", "error", "loading"]);

function researchUrl() {
  const url = new URL(
    "/nick-derobertis-site/cv-data/domains/research.json",
    window.location.origin,
  );
  const scenario = new URLSearchParams(window.location.search).get(
    "research-scenario",
  );
  if (scenario && researchScenarios.has(scenario)) {
    url.searchParams.set("scenario", scenario);
  }
  return url;
}

async function loadResearch(signal: AbortSignal) {
  const response = await fetch(researchUrl(), { signal });
  if (!response.ok) {
    throw new Error(`Research request failed: ${response.status}`);
  }
  return validateCvDomain("research", await response.json());
}

export function useResearch(): ResearchViewState {
  const [state, setState] = useState<ResearchViewState>({ name: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    loadResearch(controller.signal).then(
      (research) => setState({ name: "ready", research }),
      (error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ name: "error" });
        }
      },
    );
    return () => controller.abort();
  }, []);
  return state;
}
