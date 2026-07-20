import type { Research } from "@site/data-access";
import { cvDataClient } from "@site/data-access";
import { ResearchContent } from "./research-content";
import "@site/design-system";
import "./research.css";

type ResearchState = "ready" | "empty" | "loading" | "error";

function requestedState(): ResearchState {
  const value = new URLSearchParams(window.location.search).get(
    "research-state",
  );
  return value === "empty" || value === "loading" || value === "error"
    ? value
    : "ready";
}

function StateMessage({ state }: { state: Exclude<ResearchState, "ready"> }) {
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

export default function ResearchPage() {
  const state = requestedState();
  let research: Research | undefined;
  try {
    research = cvDataClient.domain("research");
  } catch {
    return <StateMessage state="error" />;
  }
  if (state !== "ready") return <StateMessage state={state} />;
  if (!research.projects?.length) return <StateMessage state="empty" />;
  return <ResearchContent research={research} />;
}
