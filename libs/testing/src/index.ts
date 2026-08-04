import { readFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { parseConfigFileTextToJson } from "typescript";
import type { TestUserConfig, ViteUserConfig } from "vitest/config";

export type UserConfig = ViteUserConfig & { test?: TestUserConfig };

export interface AppTestConfigOptions {
  project: string;
  dir: string;
  remotes?: Record<string, string>;
  coverageInclude?: string[];
  coverageExclude?: string[];
}

interface BaseTsConfig {
  compilerOptions: { paths: Record<string, [string, ...string[]]> };
}

export function defineAppTestConfig({
  project,
  dir,
  remotes = {},
  coverageInclude = [`${dir}/src/**/*.{ts,tsx}`],
  coverageExclude,
}: AppTestConfigOptions): UserConfig {
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
  const tsconfig = parsed.config as BaseTsConfig;
  const aliases = Object.fromEntries(
    Object.entries(tsconfig.compilerOptions.paths).map(([alias, targets]) => [
      alias,
      path.resolve(root, targets[0]),
    ]),
  );
  const remoteAliases = Object.fromEntries(
    Object.entries(remotes).map(([alias, target]) => [
      alias,
      path.resolve(root, target),
    ]),
  );

  return {
    root,
    plugins: [react()],
    resolve: { alias: { ...aliases, ...remoteAliases } },
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
