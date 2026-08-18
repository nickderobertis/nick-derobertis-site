import { readFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { parseConfigFileTextToJson } from "typescript";
import type { TestUserConfig, ViteUserConfig } from "vitest/config";
import { z } from "zod";

export type WorkspaceTestConfig = ViteUserConfig & { test?: TestUserConfig };

export interface WorkspaceTestConfigOptions {
  project: string;
  dir: string;
  remotes?: Record<string, string>;
  coverageInclude?: string[];
  coverageExclude?: string[];
}

// Every mapping becomes an anchored alias pattern below, so the alias name is
// narrowed to the workspace package grammar where it is read rather than
// interpolated into a pattern as whatever tsconfig.base.json happened to spell.
const baseTsConfigSchema = z.object({
  compilerOptions: z.object({
    paths: z.record(
      z.string().regex(/^@site\/[a-z][a-z0-9-]*$/),
      z.array(z.string()).min(1),
    ),
  }),
});

export function resolveTsconfigAliases(
  root: string,
  config: unknown,
): Record<string, string> {
  const tsconfig = baseTsConfigSchema.parse(config);
  return Object.fromEntries(
    Object.entries(tsconfig.compilerOptions.paths).map(([alias, targets]) => {
      const target = targets[0];
      /* v8 ignore next -- Zod's min(1) enforces this boundary invariant, but its inferred array type does not retain tuple cardinality. */
      if (target === undefined)
        throw new Error(`Missing path target for ${alias}`);
      return [alias, path.resolve(root, target)];
    }),
  );
}

export function defineWorkspaceTestConfig({
  project,
  dir,
  remotes = {},
  coverageInclude = [`${dir}/src/**/*.{ts,tsx}`],
  coverageExclude,
}: WorkspaceTestConfigOptions): WorkspaceTestConfig {
  if (!/^[a-z][a-z0-9-]*$/.test(project))
    throw new Error(`Invalid test project name: ${project}`);
  const root = path.resolve(import.meta.dirname, "../../..");
  const tsconfigPath = path.join(root, "tsconfig.base.json");
  const parsed = parseConfigFileTextToJson(
    tsconfigPath,
    readFileSync(tsconfigPath, "utf8"),
  );
  /* v8 ignore next -- The committed workspace config is validated by TypeScript; this preserves a useful boundary error for corrupted checkouts. */
  if (parsed.error) throw new Error("Could not parse tsconfig.base.json");
  const aliases = resolveTsconfigAliases(root, parsed.config);
  const remoteAliases = Object.fromEntries(
    Object.entries(remotes).map(([alias, target]) => [
      alias,
      path.resolve(root, target),
    ]),
  );

  return {
    root,
    plugins: [react()],
    resolve: {
      // A tsconfig mapping names a package's entry point and nothing beneath
      // it, but Vite matches a string alias against every subpath under it too:
      // `@site/build-config` would swallow `@site/build-config/remotes.json`
      // and rewrite it onto a path no file sits at. Anchoring each mapping
      // leaves a subpath to resolve through the `exports` its library
      // publishes, which is where a subpath is declared. Federated remotes stay
      // string aliases, because each names one exposed module with nothing
      // beneath it.
      alias: [
        ...Object.entries(aliases).map(([alias, target]) => ({
          find: new RegExp(`^${alias}$`),
          replacement: target,
        })),
        ...Object.entries(remoteAliases).map(([alias, target]) => ({
          find: alias,
          replacement: target,
        })),
      ],
    },
    test: {
      environment: "jsdom",
      setupFiles: ["libs/testing/src/setup.ts"],
      include: [`${dir}/src/**/*.spec.{ts,tsx}`],
      coverage: {
        provider: "v8",
        reportsDirectory: `coverage/${dir}`,
        thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
        include: coverageInclude,
        ...(coverageExclude ? { exclude: coverageExclude } : {}),
      },
    },
  };
}
