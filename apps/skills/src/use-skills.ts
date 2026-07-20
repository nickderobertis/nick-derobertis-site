import { cvDataClient, type Skills } from "@site/data-access";
import { useEffect, useState } from "react";

type SkillsState =
  | { status: "loading" }
  | { status: "ready"; skills: Skills }
  | { status: "error"; message: string };

type SkillsScenario = "empty" | "error" | "loading" | null;
function requestedScenario(): SkillsScenario {
  const value = new URLSearchParams(window.location.search).get("skills-state");
  return value === "empty" || value === "error" || value === "loading"
    ? value
    : null;
}

export function useSkills(): SkillsState {
  const scenario = requestedScenario();
  const [state, setState] = useState<SkillsState>(() => {
    if (scenario === "loading") return { status: "loading" };
    if (scenario === "error")
      return { status: "error", message: "Skills could not be loaded." };
    return {
      status: "ready",
      skills: scenario === "empty" ? [] : cvDataClient.domain("skills"),
    };
  });
  useEffect(() => {
    if (scenario !== "loading") return;
    const timer = window.setTimeout(
      () =>
        setState({ status: "ready", skills: cvDataClient.domain("skills") }),
      800,
    );
    return () => window.clearTimeout(timer);
  }, [scenario]);
  return state;
}
