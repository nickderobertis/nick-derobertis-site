import { cvDataClient } from "@site/data-access-core";
import { buildResearchProjectModels } from "@site/data-access-research";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ResearchProjectPane } from "./research-project-pane";

const research = cvDataClient.domain("research");
const workingPapers = buildResearchProjectModels(research, "working_paper");
const worksInProgress = buildResearchProjectModels(
  research,
  "work_in_progress",
);

function modelNamed(id: string) {
  const model = [...workingPapers, ...worksInProgress].find(
    (candidate) => candidate.project.id === id,
  );
  if (!model) throw new Error(`The CV no longer records the ${id} project`);
  return model;
}

function renderPane(id: string, index = 0) {
  const { categories, coauthors, project } = modelNamed(id);
  return render(
    <ResearchProjectPane
      categories={categories}
      coauthors={coauthors}
      index={index}
      project={project}
    />,
  );
}

test("names a working paper and marks which kind of work it is", () => {
  renderPane("are-investors-paying-for-attention");

  const pane = screen.getByRole("article", {
    name: "Are Investors Paying (for) Attention?",
  });
  expect(within(pane).getByText("Working paper")).toBeInTheDocument();
  expect(
    within(pane).getByRole("heading", {
      level: 3,
      name: "Are Investors Paying (for) Attention?",
    }),
  ).toBeInTheDocument();
});

test("marks an unfinished project as a work in progress instead", () => {
  renderPane("do-insiders-learn-from-short-sellers");

  expect(screen.getByText("Work in progress")).toBeInTheDocument();
  expect(screen.queryByText("Working paper")).not.toBeInTheDocument();
});

test("credits the coauthors the CV records on the paper", () => {
  renderPane("ospin-informed-trading-in-options-and-stock-markets");

  expect(
    screen.getByText("With Yong Jin, Mahendrarajah Nimalendran, Sugata Ray"),
  ).toBeInTheDocument();
});

test("says nothing about coauthors on a paper written alone", () => {
  renderPane("are-investors-paying-for-attention");

  expect(screen.queryByText(/^With /)).not.toBeInTheDocument();
});

test("lists the categories the paper is filed under", () => {
  renderPane("government-equity-capital-market-intervention-and-stock-returns");

  const categories = screen.getByRole("list", { name: "Research categories" });
  expect(
    within(categories)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([
    "Asset Pricing",
    "Portfolio Analysis",
    "Market Intervention",
    "Monetary Policy",
    "International Finance",
  ]);
});

test("links out to the resources a paper publishes alongside it", () => {
  renderPane("valuation-without-cash-flows-what-are-cryptoasset-fundamentals");

  const pane = screen.getByRole("article", {
    name: "Valuation without Cash Flows: What are Cryptoasset Fundamentals?",
  });
  expect(
    within(pane).getByRole("heading", { level: 4, name: "Resources" }),
  ).toBeInTheDocument();
  expect(
    within(pane).getByRole("link", { name: "Overview Video" }),
  ).toHaveAttribute("href", "https://youtu.be/8mMqLpFPK7M");
  expect(
    within(pane).getByText("3-minute video overview of the paper"),
  ).toBeInTheDocument();
});

test("offers no resources section for a paper that publishes none", () => {
  renderPane("are-investors-paying-for-attention");

  expect(
    screen.queryByRole("heading", { level: 4, name: "Resources" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("names a resource that is not published anywhere without offering a link", () => {
  render(
    <ResearchProjectPane
      categories={[]}
      coauthors={[]}
      index={0}
      project={{
        id: "under-review",
        status: "work_in_progress",
        title: "Under review",
        resources: [{ name: "Draft available on request" }],
      }}
    />,
  );

  expect(screen.getByText("Draft available on request")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("renders a bare record the CV has only titled", () => {
  // A paper enters the CV as a title and a status before it has a description,
  // coauthors, or a category, so the pane has to stay readable that early.
  render(
    <ResearchProjectPane
      categories={undefined}
      coauthors={undefined}
      index={1}
      project={{
        id: "newly-started",
        status: "work_in_progress",
        title: "Newly started",
      }}
    />,
  );

  const pane = screen.getByRole("article", { name: "Newly started" });
  expect(within(pane).getByText("Work in progress")).toBeInTheDocument();
  expect(
    within(pane).getByRole("list", { name: "Research categories" }),
  ).toBeEmptyDOMElement();
  expect(
    within(pane).queryByRole("heading", { level: 4 }),
  ).not.toBeInTheDocument();
});

test("alternates the tone of neighbouring panes so a reader can tell them apart", () => {
  const { container: light } = renderPane("are-investors-paying-for-attention");
  const { container: dark } = renderPane(
    "are-investors-paying-for-attention",
    1,
  );

  expect(light.querySelector("article")).toHaveAttribute("data-tone", "light");
  expect(dark.querySelector("article")).toHaveAttribute("data-tone", "dark");
});
