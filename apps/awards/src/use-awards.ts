import { type Awards, validateCvDomain } from "@site/data-access-core";
import { useEffect, useState } from "react";

export type AwardsViewState =
  | { name: "loading" }
  | { name: "error" }
  | { name: "ready"; awards: Awards };
const scenarios = new Set(["empty", "error", "loading"]);

export function useAwards(): AwardsViewState {
  const [state, setState] = useState<AwardsViewState>({ name: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const url = new URL(
      "/nick-derobertis-site/cv-data/domains/awards.json",
      window.location.origin,
    );
    const scenario = new URLSearchParams(window.location.search).get(
      "awards-scenario",
    );
    if (scenario && scenarios.has(scenario))
      url.searchParams.set("scenario", scenario);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Awards request failed: ${response.status}`);
        return validateCvDomain("awards", await response.json());
      })
      .then(
        (awards) => setState({ name: "ready", awards }),
        (error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError"))
            setState({ name: "error" });
        },
      );
    return () => controller.abort();
  }, []);
  return state;
}
