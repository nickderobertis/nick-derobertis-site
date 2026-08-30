import artifact from "../../vendor/codegen/domains/awards.json" with {
  type: "json",
};

/**
 * The committed awards domain file, and nothing else.
 *
 * One module per domain, each published on its own subpath, is what lets a
 * feature reach its own slice without reaching any other: a module that
 * imports this one pulls in awards.json alone, where
 * `@site/data-access-core/bundled` pulls in the aggregate and all six domains.
 *
 * The value is `unknown` because nothing here has checked it. Awards is the
 * one domain no browser bundle reads from here — the awards pane fetches the
 * published slice and validates the response — so `bundled.ts` and the
 * integrity check beside it are this module's only consumers.
 */
export const awardsArtifact: unknown = artifact;
