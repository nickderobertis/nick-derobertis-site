import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { z } from "zod";
import {
  fragmentContractSchema,
  serializeFragmentContract,
} from "./fragment-contract";

test("the checked-in fragment contract golden validates and round-trips", async () => {
  const golden: unknown = JSON.parse(
    await readFile(
      "libs/build-config/src/fragment-contract.golden.json",
      "utf8",
    ),
  );
  const parsed = fragmentContractSchema.parse(golden);
  expect(JSON.parse(serializeFragmentContract(parsed))).toEqual(golden);
});

test("the published JSON Schema is generated from the runtime contract", async () => {
  const published = JSON.parse(
    await readFile(
      "libs/build-config/src/fragment-contract.schema.json",
      "utf8",
    ),
  );
  const generated = z.toJSONSchema(fragmentContractSchema);
  expect(published).toEqual({
    ...generated,
    $id: published.$id,
    title: published.title,
  });
});

test("optional fragment fields are omitted when empty", () => {
  const serialized = serializeFragmentContract({
    schemaVersion: 1,
    name: "awards",
    react: "19.2.7",
    reactDom: "19.2.7",
    revision: "3418e8c",
  });
  expect(JSON.parse(serialized)).not.toHaveProperty("route");
  expect(serialized).not.toContain('"route"');
});

test("fragment contracts reject unknown fields", () => {
  expect(() =>
    fragmentContractSchema.parse({
      schemaVersion: 1,
      name: "awards",
      react: "19.2.7",
      reactDom: "19.2.7",
      revision: "3418e8c",
      unexpected: true,
    }),
  ).toThrow();
});
