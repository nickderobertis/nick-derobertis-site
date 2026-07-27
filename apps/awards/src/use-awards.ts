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

/**
 * Fetches the awards this pane needs ahead of its first render, so a host that
 * preloads the pane can mount it ready instead of on its loading skeleton. A
 * failed warm is deliberately swallowed: it drops itself from the cache, the
 * pane's own request runs on mount, and that request owns the error state.
 */
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
