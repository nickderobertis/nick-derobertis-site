import { ResearchContent } from "./research-content";
import { type ResearchViewState, useResearchPage } from "./use-research-page";
import "@site/design-system";
import "./research.css";

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

export default function ResearchPage({
  initialState,
}: {
  initialState?: ResearchViewState;
}) {
  const state = useResearchPage(initialState);
  if (state.name !== "ready") return <StateMessage state={state.name} />;
  if (!state.value.projects?.length) return <StateMessage state="empty" />;
  return <ResearchContent research={state.value} />;
}
