import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SiteLayout } from "./site-layout";

describe("SiteLayout", () => {
  it("renders accessible shared navigation and content", () => {
    render(
      <MemoryRouter>
        <SiteLayout routes={[{ path: "/", label: "Home" }]}>
          <h1>Page</h1>
        </SiteLayout>
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Page" })).toBeTruthy();
    expect(screen.getByRole("contentinfo").textContent).toContain(
      "Nick DeRobertis",
    );
  });
});
