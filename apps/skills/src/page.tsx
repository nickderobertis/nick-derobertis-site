import { createSkillTree } from "./skill-tree";
import { SkillsWidget } from "./skills-widget";
import { useSkills } from "./use-skills";

export default function SkillsPage() {
  const state = useSkills();
  if (state.status === "loading")
    return (
      <section className="skills-state" aria-live="polite">
        <h1>Skilled in…</h1>
        <p role="status">Loading skills…</p>
      </section>
    );
  if (state.status === "error")
    return (
      <section className="skills-state">
        <h1>Skills unavailable</h1>
        <p role="alert">{state.message} Please try again later.</p>
      </section>
    );
  const tree = createSkillTree(state.skills);
  if (tree.length === 0)
    return (
      <section className="skills-state">
        <h1>Skills</h1>
        <p>No skills are available yet.</p>
      </section>
    );
  return (
    <SkillsWidget
      tree={tree}
      count={state.skills.filter((skill) => skill.listed !== false).length}
    />
  );
}
