import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { TimelineFilters } from "./timeline-filters";

function renderFilters(
  overrides: Partial<Parameters<typeof TimelineFilters>[0]> = {},
) {
  const props = {
    education: true,
    employment: true,
    onEducationChange: vi.fn(),
    onEmploymentChange: vi.fn(),
    ...overrides,
  };
  render(<TimelineFilters {...props} />);
  return props;
}

test("offers both halves of the CV as named, keyboard-reachable checkboxes", () => {
  renderFilters();

  const employment = screen.getByRole("checkbox", { name: "Employment" });
  const education = screen.getByRole("checkbox", { name: "Education" });
  expect(employment).toBeChecked();
  expect(education).toBeChecked();
  education.focus();
  expect(document.activeElement).toBe(education);
});

test("reports each filter a visitor turns off", () => {
  const props = renderFilters();

  fireEvent.click(screen.getByRole("checkbox", { name: "Employment" }));

  expect(props.onEmploymentChange).toHaveBeenCalledWith(false);
  expect(props.onEducationChange).not.toHaveBeenCalled();
});

test("reports a filter a visitor turns back on", () => {
  const props = renderFilters({ education: false });
  const education = screen.getByRole("checkbox", { name: "Education" });
  expect(education).not.toBeChecked();

  fireEvent.click(education);

  expect(props.onEducationChange).toHaveBeenCalledWith(true);
});
