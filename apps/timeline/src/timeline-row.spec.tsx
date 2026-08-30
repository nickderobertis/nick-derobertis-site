import { timeline } from "@site/data-access-timeline";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { TimelineRow } from "./timeline-row";

const entries = timeline;
const FINAL_YEAR = 2026;

function entriesAt(organization: string) {
  return entries.filter((entry) => entry.organization === organization);
}

test("gathers every spell served at one organisation onto a single row", () => {
  const vcu = entriesAt("Virginia Commonwealth University");

  render(<TimelineRow entries={vcu} finalYear={FINAL_YEAR} />);

  expect(
    screen
      .getAllByRole("article")
      .map((period) => period.getAttribute("aria-label")),
  ).toEqual(
    vcu.map(
      (entry) =>
        `${"degree" in entry ? entry.degree : entry.title} at ${entry.organization}, ${entry.start} to ${entry.end ?? "present"}`,
    ),
  );
});

test("writes the organisation's name in full and abbreviated", () => {
  render(
    <TimelineRow
      entries={entriesAt("Virginia Commonwealth University")}
      finalYear={FINAL_YEAR}
    />,
  );

  // The phone layout swaps to the short form in CSS, so both have to be written
  // for the row to keep saying who it belongs to at any width.
  expect(
    screen.getByText("Virginia Commonwealth University"),
  ).toBeInTheDocument();
  expect(screen.getByText("VCU")).toBeInTheDocument();
});

test("takes an employer's own short name rather than inventing one", () => {
  render(
    <TimelineRow entries={entriesAt("Spendoso, LLC")} finalYear={FINAL_YEAR} />,
  );

  expect(screen.getByText("Spendoso, LLC")).toBeInTheDocument();
  expect(screen.getByText("Spendoso")).toBeInTheDocument();
});
