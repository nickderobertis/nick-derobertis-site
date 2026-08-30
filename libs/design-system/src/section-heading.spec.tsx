import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SectionHeading } from "./section-heading";

test("opens a section with its eyebrow, title and description in that order", () => {
  render(
    <SectionHeading
      eyebrow="Contact"
      title="Let’s work together"
      titleId="contact-title"
      description="Reach me wherever you already are."
    />,
  );

  const heading = screen.getByRole("heading", {
    name: "Let’s work together",
    level: 2,
  });
  expect(heading).toHaveAttribute("id", "contact-title");
  expect(heading).toHaveClass("section-title");
  const header = heading.parentElement;
  expect(header?.tagName).toBe("HEADER");
  expect([...(header?.children ?? [])].map((child) => child.className)).toEqual(
    ["eyebrow", "section-title", "section-description"],
  );
  expect(screen.getByText("Contact").parentElement).toBe(header);
  expect(
    screen.getByText("Reach me wherever you already are.").parentElement,
  ).toBe(header);
});

test("renders the rank the route asks for so no heading level is skipped", () => {
  render(<SectionHeading level={1} title="Research Works" />);

  expect(
    screen.getByRole("heading", { name: "Research Works", level: 1 }),
  ).toBeInTheDocument();
});

test("omits the eyebrow and description a section does not have", () => {
  render(
    <SectionHeading
      className="timeline-header"
      title="Educated and Experienced"
    >
      <p>Extra copy the pane owns.</p>
    </SectionHeading>,
  );

  const header = screen.getByRole("heading", {
    name: "Educated and Experienced",
  }).parentElement;
  expect(header).toHaveClass("section-heading", "timeline-header");
  expect(header?.querySelector(".eyebrow")).toBeNull();
  expect(header?.querySelector(".section-description")).toBeNull();
  expect(screen.getByText("Extra copy the pane owns.")).toBeInTheDocument();
});
