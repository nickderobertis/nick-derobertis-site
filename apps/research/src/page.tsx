import type { Research } from "@site/data-access-core";
import type { ResearchPageProps } from "@site/route-state";
import { ResearchContent } from "./research-content";
import { ResearchState } from "./research-state";
import Skeleton from "./skeleton";
import { useResearchPage } from "./use-research-page";
import "./research.css";

export default function ResearchPage({
  initialState,
}: ResearchPageProps<Research>) {
  const state = useResearchPage(initialState);
  if (state.name === "loading") return <Skeleton />;
  if (state.name !== "ready") return <ResearchState state={state.name} />;
  if (!state.value.projects?.length) return <ResearchState state="empty" />;
  return <ResearchContent research={state.value} />;
}
