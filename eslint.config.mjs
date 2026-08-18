import { fileURLToPath } from "node:url";
import nx from "@nx/eslint-plugin";
import parser from "@typescript-eslint/parser";
import {
  declaredAppProjects,
  federationRemotes,
  moduleBoundaryConstraints,
} from "./scripts/workspace/federation-registry.mjs";

// Each federated remote declares the library tags its own scope admits, in its
// own project.json, beside the federation alias it publishes under. Restating
// those twelve constraints here made adding a remote an edit in a root file
// that a remote added to only three of its four homes would pass silently.
// The apps are found relative to this file rather than to a working directory,
// because eslint resolves this configuration by walking up from wherever it was
// invoked, and a run started inside a project would otherwise silently drop
// every scope constraint.
const remoteScopes = moduleBoundaryConstraints(
  federationRemotes(
    declaredAppProjects(fileURLToPath(new URL("apps", import.meta.url))),
  ),
);

export default [
  { ignores: [".nx/**", "coverage/**", "dist/**", "node_modules/**"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser },
    plugins: { "@nx": nx },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          depConstraints: [
            {
              sourceTag: "type:shared",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            {
              sourceTag: "type:layout",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            // Workspace tooling composes the contract, build, and fixture
            // libraries the CLIs it owns already load, and nothing else: a
            // tooling project may never reach into an app or a feature domain.
            {
              sourceTag: "type:tooling",
              onlyDependOnLibsWithTags: ["type:shared", "type:data-core"],
            },
            {
              sourceTag: "type:app",
              onlyDependOnLibsWithTags: ["type:shared", "type:layout"],
            },
            {
              sourceTag: "type:remote",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:remote",
                "type:data-core",
                "type:data-domain",
              ],
            },
            {
              sourceTag: "type:data-core",
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: "type:data-domain",
              onlyDependOnLibsWithTags: ["type:data-core"],
            },
            ...remoteScopes,
            { sourceTag: "type:e2e", onlyDependOnLibsWithTags: ["type:app"] },
          ],
        },
      ],
    },
  },
];
