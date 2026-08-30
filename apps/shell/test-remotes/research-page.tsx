// eslint-disable-next-line @nx/enforce-module-boundaries -- This stand-in remote mirrors the validated payload the shell owns at its route boundary, for the shell's own tests.
import type { Research } from "@site/data-access-core";
import type { ResearchPageProps } from "@site/route-state";

export default function ResearchPage({
  initialState,
}: ResearchPageProps<Research>) {
  const state = initialState ?? { name: "loading" };
  return (
    <article aria-label="Research remote">
      <h1>Research</h1>
      <p>state: {state.name}</p>
      {state.name === "ready" ? (
        <p>projects: {state.value.projects?.length ?? 0}</p>
      ) : null}
    </article>
  );
}
