import { cvDataClient, type Research } from "@site/data-access-core";
import {
  type AsyncViewState,
  parseRouteView,
  routeStateQueryKeys,
} from "@site/route-state";
import { useEffect, useState } from "react";

export type ResearchViewState = AsyncViewState<Research>;

export function useResearchPage(
  initialState?: ResearchViewState,
): ResearchViewState {
  const [state, setState] = useState<ResearchViewState>(() => {
    if (initialState) return initialState;
    const view = parseRouteView(
      typeof window === "undefined"
        ? undefined
        : new URLSearchParams(window.location.search).get(
            routeStateQueryKeys.research,
          ),
    );
    if (view === "loading" || view === "error") return { name: view };
    if (view === "empty") return { name: "ready", value: { projects: [] } };
    return {
      name: "ready",
      value: cvDataClient.domain("research"),
    };
  });
  useEffect(() => {
    if (state.name !== "loading") return;
    const timer = window.setTimeout(
      () =>
        setState({
          name: "ready",
          value: cvDataClient.domain("research"),
        }),
      1_500,
    );
    return () => window.clearTimeout(timer);
  }, [state.name]);
  return state;
}
