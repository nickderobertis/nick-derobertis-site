import { type Awards, validateCvDomain } from "@site/data-access-core";
import { useEffect, useState } from "react";

export type AwardsViewState =
  | { name: "loading" }
  | { name: "error" }
  | { name: "ready"; awards: Awards };
const scenarios = new Set(["empty", "error", "loading"]);

// Warmed awards keyed by the exact request URL, so a preview scenario never
// resolves from the data warmed for the default view, or the other way round.
const warmedAwards = new Map<string, Awards>();

function awardsRequestUrl(): URL {
  const url = new URL(
    "/nick-derobertis-site/cv-data/domains/awards.json",
    window.location.origin,
  );
  const scenario = new URLSearchParams(window.location.search).get(
    "awards-scenario",
  );
  if (scenario && scenarios.has(scenario))
    url.searchParams.set("scenario", scenario);
  return url;
}

async function requestAwards(url: URL, signal?: AbortSignal): Promise<Awards> {
  const response = await fetch(url, signal ? { signal } : {});
  if (!response.ok)
    throw new Error(`Awards request failed: ${response.status}`);
  return validateCvDomain("awards", await response.json());
}

/**
 * Fetches the awards this pane needs ahead of its first render, so a host that
 * preloads the pane can mount it ready instead of on its loading skeleton. A
 * failed warm is deliberately swallowed: the pane's own request still runs and
 * owns the error state, so a warm that fails changes nothing a visitor sees.
 */
export async function preloadAwards(): Promise<void> {
  if (typeof window === "undefined") return;
  const url = awardsRequestUrl();
  if (warmedAwards.has(url.href)) return;
  try {
    warmedAwards.set(url.href, await requestAwards(url));
  } catch {
    return;
  }
}

export function useAwards(): AwardsViewState {
  // Seeding from the warm cache during the initial render is what removes the
  // loading frame. Server rendering never warms, so its markup is unchanged.
  const [state, setState] = useState<AwardsViewState>(() => {
    if (typeof window === "undefined") return { name: "loading" };
    const warmed = warmedAwards.get(awardsRequestUrl().href);
    return warmed ? { name: "ready", awards: warmed } : { name: "loading" };
  });
  useEffect(() => {
    const url = awardsRequestUrl();
    // A warm that lands between this render and this effect still has to reach
    // the pane; skipping the request without adopting it would strand the pane
    // on its skeleton forever.
    const warmed = warmedAwards.get(url.href);
    if (warmed) {
      setState((current) =>
        current.name === "ready" ? current : { name: "ready", awards: warmed },
      );
      return;
    }
    const controller = new AbortController();
    requestAwards(url, controller.signal).then(
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
