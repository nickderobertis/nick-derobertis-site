import { cvDataClient, type Research } from "@site/data-access-core";
import type { AsyncViewState } from "@site/route-state";
import { useEffect, useState } from "react";

export type ResearchViewState = AsyncViewState<Research>;

export function useResearchPage(
  initialState?: ResearchViewState,
): ResearchViewState {
  const [state, setState] = useState<ResearchViewState>(
    () =>
      initialState ?? {
        name: "ready",
        value: cvDataClient.domain("research"),
      },
  );
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
