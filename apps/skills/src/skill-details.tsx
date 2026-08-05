import type { SkillTreeNode } from "@site/data-access-skills";

/**
 * What the pane says about the skill a visitor is pointing at or has focused.
 * It is a live region because it is the only thing that changes as the pointer
 * or the focus ring moves, and the CV records neither hours nor a first use for
 * every skill, so both are reported as absent rather than as a zero.
 */
export function SkillDetails({ skill }: { skill: SkillTreeNode }) {
  const years = skill.firstUsed
    ? Math.max(
        0,
        new Date().getUTCFullYear() - Number(skill.firstUsed.slice(0, 4)),
      )
    : null;
  return (
    <aside
      className="skill-details"
      aria-live="polite"
      aria-label="Skill stats"
    >
      <strong>{skill.title}</strong>
      <span>{skill.experience}</span>
      <span>
        {skill.hours === null
          ? "Hours not recorded"
          : `Est. Hours: ${Math.round(skill.hours).toLocaleString("en-US")}`}
      </span>
      <span>
        {years === null
          ? "First use not recorded"
          : `First used: ${years} years ago`}
      </span>
    </aside>
  );
}
