import { cvDataClient } from "@site/data-access-core";
import type { TimelineEntry } from "@site/data-access-timeline";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { TimelinePeriod } from "./timeline-period";

const entries = cvDataClient.domain("timeline");
// The axis the deployed pane draws reaches at least the current year, so every
// spell below is placed against the same span a visitor sees.
const FINAL_YEAR = 2026;

function entryFor(id: string): TimelineEntry {
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`The CV no longer records the ${id} entry`);
  return entry;
}

function renderPeriod(id: string) {
  render(<TimelinePeriod entry={entryFor(id)} finalYear={FINAL_YEAR} />);
  return screen.getByRole("article");
}

test("names a completed spell by its role, organisation, and both dates", () => {
  const period = renderPeriod(
    "uf-ph-d-in-business-administration-finance-and-real-estate",
  );

  expect(period).toHaveAccessibleName(
    "Ph.D. in Business Administration - Finance and Real Estate at University of Florida, 2014-08-15 to 2021-05-15",
  );
  // The bar has room for one label, so the full and abbreviated forms are both
  // written and the phone layout picks between them.
  expect(screen.getByText("Ph.D.")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Ph.D. in Business Administration - Finance and Real Estate",
    ),
  ).toBeInTheDocument();
});

test("reads a spell the CV leaves open as running to the present", () => {
  const period = renderPeriod("spendoso_cto");

  expect(period).toHaveAccessibleName(
    "Co-Founder and Chief Technology Officer at Spendoso, LLC, 2022-08-01 to present",
  );
  expect(period.style.width).toBe(
    `${100 - Number.parseFloat(period.style.left)}%`,
  );
});

test("keeps a spell too short to draw wide enough to see", () => {
  // A three-month internship is under a fiftieth of a fifteen-year axis, so
  // without a floor it would be drawn as a bar with no width at all.
  const period = renderPeriod("frb_intern");

  expect(Number.parseFloat(period.style.width)).toBe(2);
});

test("draws every spell the CV records in a colour of its own", () => {
  const colors = entries.map((entry) => {
    const { unmount } = render(
      <TimelinePeriod entry={entry} finalYear={FINAL_YEAR} />,
    );
    const color = screen
      .getByRole("article")
      .style.getPropertyValue("--period-color");
    unmount();
    return color;
  });

  expect(colors.filter(Boolean)).toHaveLength(entries.length);
});
