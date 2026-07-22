import { cvDataClient, type Research } from "@site/data-access-core";
import { ResearchContent } from "./research-content";
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
  const state = initialState ?? standaloneState();
  if (state.name !== "ready") return <StateMessage state={state.name} />;
  if (!state.research.projects?.length) return <StateMessage state="empty" />;
  return <ResearchContent research={state.research} />;
}
export type ResearchViewState =
  | { name: "loading" }
  | { name: "error" }
  | { name: "ready"; research: Research };

function standaloneState(): ResearchViewState {
  const scenario =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("research-scenario");
  if (scenario === "loading" || scenario === "error") return { name: scenario };
  if (scenario === "empty")
    return { name: "ready", research: { projects: [] } };
  return { name: "ready", research: cvDataClient.domain("research") };
}
