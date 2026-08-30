import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Skeleton } from "./skeleton";

test("says what is loading without claiming any content exists", () => {
  render(
    <Skeleton label="Loading awards" className="skeleton-awards">
      <div className="skeleton-grid">
        <i />
      </div>
    </Skeleton>,
  );

  const skeleton = screen.getByRole("status", { name: "Loading awards" });
  expect(skeleton.tagName).toBe("SECTION");
  expect(skeleton).toHaveClass("remote-skeleton", "skeleton-awards");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

test("stands in for a route that is one document as the same element", () => {
  render(
    <Skeleton as="article" label="Loading biography">
      <div className="skeleton-cover" />
    </Skeleton>,
  );

  expect(
    screen.getByRole("status", { name: "Loading biography" }).tagName,
  ).toBe("ARTICLE");
});
