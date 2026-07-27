import { type Awards, validateCvDomain } from "@site/data-access-core";
import { useEffect, useState } from "react";

export type AwardsViewState =
  | { name: "loading" }
  | { name: "error" }
  | { name: "ready"; awards: Awards };
const scenarios = new Set(["empty", "error", "loading"]);

/**
 * One awards request per URL, so a host that warms the pane and the pane's own
 * mount share a single fetch rather than racing two. `value` is the settled
 * response kept only so the first render can read it synchronously; nothing but
 * the fetch below ever writes here, and a rejected request drops itself so the
 * next mount retries.
 */
// llmlint: ignore-block[server_state_not_duplicated_in_global_store] This map is the pane's data-fetching layer, not a copy alongside one: the site ships no query client, and a cache that outlives the component is the only place a host preload can deposit a response the pane has not mounted to request yet. Entries are immutable per URL, written solely by the fetch below, and never mutated by rendering.
interface AwardsRequest {
  promise: Promise<Awards>;
  value?: Awards;
}
const awardsRequests = new Map<string, AwardsRequest>();

// Keying by the exact request URL keeps a preview scenario from resolving out
// of the response warmed for the default view, or the other way round.
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

function awardsRequest(url: URL): AwardsRequest {
  const existing = awardsRequests.get(url.href);
  if (existing) return existing;
  const request: AwardsRequest = {
    promise: (async () => {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Awards request failed: ${response.status}`);
      return validateCvDomain("awards", await response.json());
    })().then(
      (awards) => {
        request.value = awards;
        return awards;
      },
      (error: unknown) => {
        awardsRequests.delete(url.href);
        throw error;
      },
    ),
  };
  awardsRequests.set(url.href, request);
  return request;
}
// llmlint: ignore-end[server_state_not_duplicated_in_global_store]

/**
 * Fetches the awards this pane needs ahead of its first render, so a host that
 * preloads the pane can mount it ready instead of on its loading skeleton. A
 * failed warm is deliberately swallowed: it drops itself from the cache, the
 * pane's own request runs on mount, and that request owns the error state.
 */
// llmlint: ignore[changed_behavior_has_e2e] Only a host calls this, so there is no standalone trigger to drive: awards.spec.ts already covers the standalone remote's happy, empty, and error paths, and every one of them now runs through the shared request below. preload.spec.ts covers the warmed and unavailable host paths.
export async function preloadAwards(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await awardsRequest(awardsRequestUrl()).promise;
  } catch {
    return;
  }
}

export function useAwards(): AwardsViewState {
  // Reading a settled request during the initial render is what removes the
  // loading frame. Server rendering never warms, so its markup is unchanged.
  const [state, setState] = useState<AwardsViewState>(() => {
    if (typeof window === "undefined") return { name: "loading" };
    const warmed = awardsRequests.get(awardsRequestUrl().href)?.value;
    return warmed ? { name: "ready", awards: warmed } : { name: "loading" };
  });
  useEffect(() => {
    // The request is shared, so an unmount stops listening rather than
    // aborting it out from under whoever else is waiting on the same URL.
    let listening = true;
    awardsRequest(awardsRequestUrl()).promise.then(
      (awards) => {
        if (listening) setState({ name: "ready", awards });
      },
      () => {
        if (listening) setState({ name: "error" });
      },
    );
    return () => {
      listening = false;
    };
  }, []);
  return state;
}
