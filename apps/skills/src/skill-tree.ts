import type { Skill, Skills } from "@site/data-access";

export interface SkillNode {
  skill: Skill;
  children: SkillNode[];
}

export function createSkillTree(skills: Skills): SkillNode[] {
  const listed = skills.filter((skill) => skill.listed !== false);
  const byParent = new Map<string, Skill[]>();
  for (const skill of listed) {
    if (!skill.primary_category_id) continue;
    const children = byParent.get(skill.primary_category_id) ?? [];
    children.push(skill);
    byParent.set(skill.primary_category_id, children);
  }
  const categoryIds = new Set(byParent.keys());
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  return [...categoryIds]
    .map((id) => byId.get(id))
    .filter((skill): skill is Skill => skill !== undefined)
    .map((skill) => ({
      skill,
      children: (byParent.get(skill.id) ?? [])
        .sort(
          (a, b) =>
            (b.priority ?? 0) - (a.priority ?? 0) ||
            a.name.localeCompare(b.name),
        )
        .map((child) => ({ skill: child, children: [] })),
    }))
    .sort((a, b) => b.children.length - a.children.length);
}

export function formatHours(hours?: number | null): string {
  return hours == null ? "Not estimated" : Math.round(hours).toLocaleString();
}
