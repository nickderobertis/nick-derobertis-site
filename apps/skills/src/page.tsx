import { buildSkillTree, skills } from "@site/data-access-skills";
import { previewState } from "./preview-state";
import Skeleton from "./skeleton";
import { SkillsExperience } from "./skills-experience";
import { SkillsState } from "./skills-state";
import "./skills.css";

export default function SkillsPage() {
  const state = previewState();
  if (state === "loading") return <Skeleton />;
  if (state === "error") return <SkillsState name="error" />;
  const tree = buildSkillTree(state === "empty" ? [] : skills);
  if (tree.skillCount === 0) return <SkillsState name="empty" />;
  return <SkillsExperience tree={tree} />;
}
