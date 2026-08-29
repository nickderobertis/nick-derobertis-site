import path from "node:path";
import react from "@vitejs/plugin-react";
import type { TestUserConfig, ViteUserConfig } from "vitest/config";
import { z } from "zod";

export type WorkspaceTestConfig = ViteUserConfig & { test?: TestUserConfig };

const coverageMetric = z.number().min(0).max(100);

/** The suffix a specifier and its target both carry to map a family. */
const family = "/*";

const escapeForRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Vite matches a string alias against whole path segments: `panes/card` claims
 * `panes/card` and everything beneath `panes/card/`. An object of string
 * aliases therefore swallows any longer specifier that begins with a shorter
 * one — `@site/data-access-core/site` becomes a path *inside*
 * `.../src/index.ts` — and which of the two wins is decided by the order the
 * keys happen to be written in, so sorting the map silently breaks resolution.
 * Anchored matchers make every mapping claim exactly what it names: an exact
 * expression for a plain specifier, and a capturing one that carries the
 * matched remainder into the target for a `/*` family. Exact mappings are
 * ordered ahead of the families, which is the one overlap anchoring cannot
 * rule out, so the more specific mapping wins there without depending on
 * order either.
 */
function aliasEntries(root: string, remotes: Record<string, string>) {
  const stem = (value: string) => value.slice(0, -family.length);
  return Object.entries(remotes)
    .map(([specifier, target]) =>
      specifier.endsWith(family)
        ? {
            find: new RegExp(`^${escapeForRegExp(stem(specifier))}/(.+)$`),
            replacement: `${path.resolve(root, stem(target))}/$1`,
            mapsAFamily: true,
          }
        : {
            find: new RegExp(`^${escapeForRegExp(specifier)}$`),
            replacement: path.resolve(root, target),
            mapsAFamily: false,
          },
    )
    .sort((left, right) => Number(left.mapsAFamily) - Number(right.mapsAFamily))
    .map(({ find, replacement }) => ({ find, replacement }));
}

/**
 * A component config is the one place a project states what its own tests are
 * held to, and nothing else typechecks it, so every option it passes is read
 * here rather than trusted. A misspelled key is refused instead of silently
 * dropped, which is what would otherwise turn a narrowed coverage boundary or
 * a declared floor into a setting that reads as present and applies to
 * nothing.
 */
const optionsSchema = z.strictObject({
  project: z.string().regex(/^[a-z][a-z0-9-]*$/),
  dir: z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/),
  /**
   * The floor this project holds itself to, on all four metrics. It is stated
   * per project rather than fixed here: AGENTS.md sets the workspace floor,
   * and `scripts/workspace/structure-contract.spec.ts` reads it from there and
   * holds every project outside the exemptions it names to exactly that.
   */
  thresholds: z.strictObject({
    lines: coverageMetric,
    functions: coverageMetric,
    branches: coverageMetric,
    statements: coverageMetric,
  }),
  /**
   * Federation specifiers this project's host composes, each pointed at the
   * source behind it. No manifest publishes them — they exist for the Module
   * Federation runtime Vitest does not run — so they are the only specifiers
   * that still need an alias. A specifier ending in `/*` maps a whole family,
   * and its target must end in `/*` too, or the remainder the specifier
   * matched would have nowhere to land.
   */
  remotes: z
    .record(z.string().min(1), z.string().min(1))
    .check((ctx) => {
      for (const [specifier, target] of Object.entries(ctx.value)) {
        if (specifier.endsWith(family) === target.endsWith(family)) continue;
        ctx.issues.push({
          code: "custom",
          input: target,
          path: [specifier],
          message: `A wildcard maps a family, so write ${family} on both the specifier and its target or on neither; ${specifier} carries a remainder ${target} has no place for`,
        });
      }
    })
    .optional(),
  /**
   * The ceiling this project's tests are held to, for a project whose tests
   * share one reason for needing more than the runner's 5000ms default —
   * evaluating a module graph, or driving a subject as a real process, whose
   * cost is set by the workspace's size and the host's load rather than by the
   * assertion that follows. A project with a body of fast tests beside the slow
   * ones states its ceiling at those tests instead, so the default keeps
   * detecting a hang everywhere it still can. Left unset, Vitest's default
   * stands. This is the only channel there is: the component config is the one
   * file in a project that may import this harness, because a spec that
   * imported it would key the project's whole typecheck on it.
   */
  testTimeout: z.number().int().positive().optional(),
  coverageInclude: z.array(z.string()).nonempty().optional(),
  coverageExclude: z.array(z.string()).nonempty().optional(),
});

export type WorkspaceTestConfigOptions = z.infer<typeof optionsSchema>;

export function defineWorkspaceTestConfig(
  options: WorkspaceTestConfigOptions,
): WorkspaceTestConfig {
  const read = optionsSchema.safeParse(options);
  if (!read.success)
    throw new Error(
      `Invalid workspace test configuration:\n${z.prettifyError(read.error)}`,
    );
  const {
    dir,
    thresholds,
    remotes = {},
    testTimeout,
    coverageInclude = [`${read.data.dir}/src/**/*.{ts,tsx}`],
    coverageExclude,
  } = read.data;
  const root = path.resolve(import.meta.dirname, "../../..");

  return {
    root,
    plugins: [react()],
    resolve: { alias: aliasEntries(root, remotes) },
    test: {
      environment: "jsdom",
      setupFiles: ["libs/testing/src/setup.ts"],
      include: [`${dir}/src/**/*.spec.{ts,tsx}`],
      ...(testTimeout === undefined ? {} : { testTimeout }),
      coverage: {
        provider: "v8",
        reportsDirectory: `coverage/${dir}`,
        thresholds,
        include: coverageInclude,
        ...(coverageExclude ? { exclude: coverageExclude } : {}),
      },
    },
  };
}
