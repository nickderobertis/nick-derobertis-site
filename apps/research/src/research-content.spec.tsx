import { cvDataClient } from "@site/data-access-core";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ResearchContent } from "./research-content";

const research = cvDataClient.domain("research");

test("splits the portfolio into the two sections the CV files work under", () => {
  render(<ResearchContent research={research} />);

  const workingPapers = screen.getByRole("region", { name: "Working Papers" });
  const worksInProgress = screen.getByRole("region", {
    name: "Works in Progress",
  });
  expect(within(workingPapers).getAllByRole("article")).toHaveLength(4);
  expect(within(worksInProgress).getAllByRole("article")).toHaveLength(5);
  expect(
    within(workingPapers).getByRole("article", {
      name: "OSPIN: Informed Trading in Options and Stock Markets",
    }),
  ).toBeInTheDocument();
  expect(
    within(worksInProgress).getByRole("article", {
      name: "Do Insiders Learn From Short Sellers?",
    }),
  ).toBeInTheDocument();
});

test("sends a reader from the banner straight to the working papers", () => {
  render(<ResearchContent research={research} />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Research Works" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View research" })).toHaveAttribute(
    "href",
    "#working-papers",
  );
});

test("resolves each paper's categories and coauthors from the CV's own tables", () => {
  render(<ResearchContent research={research} />);

  // The projects carry ids, not names, so a paper reading out its coauthors and
  // categories is what proves the page joined them to the CV's tables.
  const paper = screen.getByRole("article", {
    name: "Government Equity Capital Market Intervention and Stock Returns",
  });
  expect(
    within(paper).getByText("With Andy Naranjo, Mahendrarajah Nimalendran"),
  ).toBeInTheDocument();
  expect(
    within(within(paper).getByRole("list", { name: "Research categories" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toContain("Market Intervention");
});

test("drops a reference the CV's tables cannot resolve rather than showing a gap", () => {
  render(
    <ResearchContent
      research={{
        categories: [{ id: "options", name: "Options" }],
        coauthors: [],
        projects: [
          {
            id: "half-linked",
            status: "working_paper",
            title: "Half linked",
            category_ids: ["options", "not-a-category"],
            coauthor_ids: ["not-a-person"],
          },
        ],
      }}
    />,
  );

  const paper = screen.getByRole("article", { name: "Half linked" });
  expect(
    within(paper)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["Options"]);
  expect(within(paper).queryByText(/^With /)).not.toBeInTheDocument();
});

test("still heads both sections for a CV with no projects at all", () => {
  render(<ResearchContent research={{ projects: [] }} />);

  for (const heading of ["Working Papers", "Works in Progress"]) {
    const section = screen.getByRole("region", { name: heading });
    expect(within(section).getByText("00")).toBeInTheDocument();
    expect(within(section).queryByRole("article")).not.toBeInTheDocument();
  }
});
