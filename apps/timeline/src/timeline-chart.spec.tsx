import { cvDataClient } from "@site/data-access-core/bundled";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { TimelineChart } from "./timeline-chart";

const entries = cvDataClient.domain("timeline");

function chart() {
  return screen.queryByRole("region", {
    name: "Education and employment by year",
  });
}

function periodNames() {
  return screen
    .getAllByRole("article")
    .map((period) => period.getAttribute("aria-label"));
}

function filter(name: "Education" | "Employment") {
  return screen.getByRole("checkbox", { name });
}

test("draws every spell the CV records, grouped by organisation", () => {
  render(<TimelineChart entries={entries} />);

  expect(chart()).toBeInTheDocument();
  expect(periodNames()).toHaveLength(entries.length);
  expect(periodNames()).toContain(
    "Staff Software Engineer at Carbon Health Technologies, 2022-09-01 to present",
  );
  expect(periodNames()).toContain(
    "Ph.D. in Business Administration - Finance and Real Estate at University of Florida, 2014-08-15 to 2021-05-15",
  );
});

test("leaves only education showing when employment is filtered out", () => {
  render(<TimelineChart entries={entries} />);

  fireEvent.click(filter("Employment"));

  expect(periodNames()).toContain(
    "Ph.D. in Business Administration - Finance and Real Estate at University of Florida, 2014-08-15 to 2021-05-15",
  );
  expect(periodNames().join(" ")).not.toContain("Staff Software Engineer");
  // A graduate assistantship is employment served at a university, so it goes
  // with the employment filter rather than with the degree beside it.
  expect(periodNames().join(" ")).not.toContain("Graduate Assistant");
});

test("keeps academic alongside professional employment when education goes", () => {
  render(<TimelineChart entries={entries} />);

  fireEvent.click(filter("Education"));

  expect(periodNames()).toContain(
    "Graduate Assistant at University of Florida, 2014-08-15 to 2021-05-31",
  );
  expect(periodNames()).toContain(
    "Staff Software Engineer at Carbon Health Technologies, 2022-09-01 to present",
  );
  expect(periodNames().join(" ")).not.toContain("Ph.D.");
});

test("says so, rather than showing a blank chart, when no filter is left on", () => {
  render(<TimelineChart entries={entries} />);

  fireEvent.click(filter("Employment"));
  fireEvent.click(filter("Education"));

  expect(screen.getByRole("status")).toHaveTextContent(
    "No timeline entries match the selected filters.",
  );
  expect(chart()).not.toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("brings the history back when a visitor turns a filter on again", () => {
  render(<TimelineChart entries={entries} />);
  fireEvent.click(filter("Employment"));
  fireEvent.click(filter("Education"));

  fireEvent.click(filter("Education"));

  expect(chart()).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(periodNames().join(" ")).toContain("Ph.D.");
});
