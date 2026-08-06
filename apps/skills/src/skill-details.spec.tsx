import type { SkillTreeNode } from "@site/data-access-skills";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { SkillDetails } from "./skill-details";

function skill(overrides: Partial<SkillTreeNode> = {}): SkillTreeNode {
  return {
    children: [],
    experience: "High Aptitude",
    firstUsed: null,
    hours: null,
    id: "python",
    level: 5,
    title: "Python",
    ...overrides,
  };
}

function stats() {
  return screen.getByRole("complementary", { name: "Skill stats" });
}

test("reads out what the CV records about the skill in hand", () => {
  const startedYearsAgo = 6;

  render(
    <SkillDetails
      skill={skill({
        firstUsed: `${new Date().getUTCFullYear() - startedYearsAgo}-03-01`,
        hours: 12_289.6,
      })}
    />,
  );

  const panel = stats();
  expect(within(panel).getByText("Python")).toBeInTheDocument();
  expect(within(panel).getByText("High Aptitude")).toBeInTheDocument();
  // Hours are an estimate carried to a fraction, so they are rounded and
  // grouped rather than shown as the raw figure the CV holds.
  expect(within(panel).getByText("Est. Hours: 12,290")).toBeInTheDocument();
  expect(
    within(panel).getByText(`First used: ${startedYearsAgo} years ago`),
  ).toBeInTheDocument();
});

test("says a figure is unrecorded rather than reporting it as none", () => {
  render(<SkillDetails skill={skill({ experience: "Novice", level: 1 })} />);

  const panel = stats();
  expect(within(panel).getByText("Hours not recorded")).toBeInTheDocument();
  expect(within(panel).getByText("First use not recorded")).toBeInTheDocument();
  expect(within(panel).queryByText(/Est. Hours/)).not.toBeInTheDocument();
});

test("announces itself as it changes, because nothing else on the pane does", () => {
  render(<SkillDetails skill={skill()} />);

  expect(stats()).toHaveAttribute("aria-live", "polite");
});
