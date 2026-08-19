import path from "node:path";
import react from "@vitejs/plugin-react";
import type { TestUserConfig, ViteUserConfig } from "vitest/config";

export type WorkspaceTestConfig = ViteUserConfig & { test?: TestUserConfig };

export interface WorkspaceTestConfigOptions {
  project: string;
  dir: string;
  remotes?: Record<string, string>;
  coverageInclude?: string[];
  coverageExclude?: string[];
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
  // Every `@site/*` specifier resolves through the workspace manifests, the
  // way Node resolves any other dependency. Only the federation specifiers a
  // host composes need an alias, because no manifest publishes them: they
  // exist for rspack's Module Federation runtime, which Vitest does not run.
  const remoteAliases = Object.fromEntries(
    Object.entries(remotes).map(([alias, target]) => [
      alias,
      path.resolve(root, target),
    ]),
  );

  return {
    root,
    plugins: [react()],
    resolve: { alias: remoteAliases },
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
