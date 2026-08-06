import { expect, test, vi } from "vitest";
import {
  reactDependencies,
  renderFragmentHtml,
  sourceRevision,
} from "./published-fragment";

test("source revision falls back when Git is unavailable", () => {
  const readGitRevision = vi.fn(() => {
    throw new Error("not a git repository");
  });

  expect(sourceRevision(undefined, readGitRevision)).toBe("0000000");
  expect(readGitRevision).toHaveBeenCalledOnce();
});

test("an injected source revision avoids Git", () => {
  const readGitRevision = vi.fn(() => "deadbee");

  expect(sourceRevision("a11ce123", readGitRevision)).toBe("a11ce123");
  expect(readGitRevision).not.toHaveBeenCalled();
});

test("the workspace manifest supplies the stamped React versions", () => {
  expect(
    reactDependencies({
      name: "site",
      dependencies: { react: "19.2.7", "react-dom": "19.2.6" },
    }),
  ).toEqual({ react: "19.2.7", reactDom: "19.2.6" });
});

test.each([
  ["no dependencies", { name: "site" }],
  ["no react-dom", { dependencies: { react: "19.2.7" } }],
  [
    "a non-string react version",
    { dependencies: { react: 19, "react-dom": "19.2.7" } },
  ],
  ["nothing at all", null],
])("a manifest with %s cannot publish fragments", (_case, manifest) => {
  expect(() => reactDependencies(manifest)).toThrow(
    /must declare string react and react-dom dependencies/,
  );
});

test("a compiled remote renderer publishes the HTML it returns", async () => {
  await expect(
    renderFragmentHtml(
      { renderFragment: () => Promise.resolve("<main>awards</main>") },
      "awards",
    ),
  ).resolves.toBe("<main>awards</main>");
});

test("a compiled shell renderer publishes the HTML it returns", async () => {
  await expect(
    renderFragmentHtml(
      {
        renderShellFragment: () => Promise.resolve("<template></template>"),
        renderFragment: () => Promise.resolve("<main>wrong export</main>"),
      },
      "shell",
    ),
  ).resolves.toBe("<template></template>");
});

test("a renderer missing its fragment export is rejected", async () => {
  await expect(
    renderFragmentHtml(
      { renderShellFragment: () => Promise.resolve("") },
      "awards",
    ),
  ).rejects.toThrow("The awards fragment renderer is invalid");
});

test("a renderer module that is not an object is rejected", async () => {
  await expect(renderFragmentHtml(undefined, "shell")).rejects.toThrow(
    "The shell fragment renderer is invalid",
  );
});

test("a renderer that does not return HTML is rejected", async () => {
  await expect(
    renderFragmentHtml({ renderFragment: () => Promise.resolve(42) }, "bio"),
  ).rejects.toThrow("The bio fragment renderer did not return HTML");
});

// A publish lane stamps whichever revision it can reach, so the unstamped path
// is the one a developer's own build takes: it must resolve this checkout's own
// commit rather than fall through to the unavailable-Git sentinel.
test("an unstamped build reads the revision from the checkout it is building", () => {
  expect(sourceRevision(undefined)).toMatch(/^[0-9a-f]{7,64}$/i);
});

test("a revision that is not a commit is rejected before it is stamped", () => {
  expect(() => sourceRevision("not-a-revision")).toThrow(
    /must be a 7-64 character hexadecimal revision/,
  );
});
