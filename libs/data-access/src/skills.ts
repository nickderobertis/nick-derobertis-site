import type { Skill, Skills } from "../vendor/codegen";

const CATEGORY_IDS = [
  "frameworks",
  "programming",
  "dev-ops",
  "data-science",
  "other",
  "presentation",
  "iot",
] as const;

type SkillCategoryId = (typeof CATEGORY_IDS)[number];

export interface SkillTreeNode {
  readonly children: readonly SkillTreeNode[];
  readonly experience: string;
  readonly firstUsed: string | null;
  readonly hours: number | null;
  readonly id: string;
  readonly level: number;
  readonly title: string;
}

export interface SkillTree {
  readonly children: readonly SkillTreeNode[];
  readonly skillCount: number;
  readonly title: "Skills";
}

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORY_IDS);

function categoryFor(skill: Skill): SkillCategoryId {
  const candidates = [
    skill.primary_category_id,
    ...(skill.related_skill_ids ?? []),
  ];
  return (
    candidates.find((candidate): candidate is SkillCategoryId =>
      CATEGORY_SET.has(String(candidate)),
    ) ?? "other"
  );
}

function experienceLabel(level: number) {
  return ["Novice", "Familiar", "Proficient", "Advanced", "High Aptitude"][
    Math.max(0, Math.min(4, level - 1))
  ] as string;
}

function toNode(skill: Skill, children: readonly SkillTreeNode[] = []) {
  const starts = skill.experience?.periods?.map((period) => period.start) ?? [];
  return {
    children,
    experience: experienceLabel(skill.level),
    firstUsed: starts.length > 0 ? (starts.sort()[0] as string) : null,
    hours: skill.experience?.total_hours ?? null,
    id: skill.id,
    level: skill.level,
    title: skill.name,
  } satisfies SkillTreeNode;
}

/** Builds the stable seven-category navigation tree used by skills views. */
export function buildSkillTree(skills: Skills): SkillTree {
  const listed = skills.filter((skill) => skill.listed !== false);
  if (listed.length === 0)
    return { children: [], skillCount: 0, title: "Skills" };
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const categories = CATEGORY_IDS.map((categoryId) => {
    const category = byId.get(categoryId);
    if (!category)
      throw new Error(`Skills data is missing category ${categoryId}`);
    const children = listed
      .filter(
        (skill) =>
          !CATEGORY_SET.has(skill.id) && categoryFor(skill) === categoryId,
      )
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
      )
      .map((skill) => toNode(skill));
    return toNode(category, children);
  });
  return { children: categories, skillCount: listed.length, title: "Skills" };
}
