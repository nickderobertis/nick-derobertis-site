# TanStack Start and Module Federation spike

**Verdict: yes. A single Rsbuild build can run TanStack Start's Rsbuild plugin
and the Module Federation Rsbuild plugin together, prerender a document, and
publish a container whose exposed page a separate host loads at runtime.** It
does not work from the plugins' defaults. The remote must attach federation to
Start's `client` environment, replace Start's root-relative public path for the
federation producer, and select Start's supported `iife` client output. Those
are explicit, supportable per-remote settings rather than generated-output
patches.

The final Chromium journey loaded the host at `http://127.0.0.1:3100/`. The host
fetched the combined remote's `mf-manifest.json`, exposed-page chunk, and
`remoteEntry.js` from `http://127.0.0.1:3101/`, then rendered **Federated Start
page** and **Loaded from the remote container.** There were no console errors,
failed requests, or uncaught page errors. This consumption journey, rather than
the successful build by itself, is the positive result.

## Scope and resolved versions

The packages were resolved from the public npm registry on 2026-08-31, not
copied from the earlier evaluation:

| Package | Resolved version |
| --- | ---: |
| Node.js | 26.5.0 |
| `@tanstack/react-start` | 1.168.49 |
| `@tanstack/start-plugin-core` (resolved by React Start) | 1.171.39 |
| `@tanstack/react-router` | 1.170.32 |
| `@rsbuild/core` | 2.2.1 |
| `@rsbuild/plugin-react` | 2.1.0 |
| `@module-federation/rsbuild-plugin` | 2.9.0 |
| React / React DOM | 19.2.8 / 19.2.8 |
| `@playwright/test` / bundled Chromium | 1.62.1 / 151.0.7922.34 |
| TypeScript | 7.0.2 |
| `@types/node` | 26.4.0 |
| `@types/react` / `@types/react-dom` | 19.2.18 / 19.2.5 |

The scratch workspace was under `/tmp` and is not part of this repository.

## Controls: each plugin worked alone

The controls used the same remote source and dependency installation as the
combined case.

**Start only.** `SPIKE_MODE=start npm run build -w remote` exited 0. Rsbuild
reported successful `client` and `ssr` builds followed by:

```text
[prerender] Prerendering pages...
[prerender] Crawling: /
[prerender] Prerendered 1 pages:
[prerender] - /
```

The emitted `remote/dist/start/client/index.html`, not a configuration object,
contained both `Federated Start page` and `Loaded from the remote container.`

**Federation only.** `SPIKE_MODE=federation npm run build -w remote` exited 0
and emitted `remote/dist/federation/remoteEntry.js`, `mf-manifest.json`, and
`static/js/async/__federation_expose_Page.3e86656a9e.js`. The emitted manifest's
expose record was:

```json
{
  "id": "start_remote:Page",
  "name": "Page",
  "path": "./Page",
  "assets": {
    "js": {
      "sync": [
        "static/js/async/__federation_expose_Page.3e86656a9e.js"
      ],
      "async": []
    },
    "css": { "sync": [], "async": [] }
  }
}
```

The separately built host loaded that control in Chromium. It rendered the two
page markers and recorded empty console-error and failed-request arrays. During
setup, using a synchronous host bootstrap produced Module Federation's
`loadShareSync failed!` error, and serving with a bare Python static server
produced the browser's `No 'Access-Control-Allow-Origin' header` error. The
control was repaired with the standard asynchronous bootstrap boundary and
Rsbuild's preview server, which applies the federation plugin's CORS response
headers. Neither repair involves Start, so the passing control establishes a
valid federation workspace before the combined result is considered.

## Combined build and host journey

The final command `SPIKE_MODE=combined npm run build -w remote` exited 0. The
emitted client files included:

```text
client/index.html
client/mf-manifest.json
client/mf-stats.json
client/remoteEntry.js
client/assets/js/index.56190df853.js
client/assets/js/async/__federation_expose_Page.fa4a3eeec6.js
```

The emitted manifest identified `remoteEntry.js` as a `global` container,
mapped `./Page` to the exposed chunk, and listed singleton React and React DOM
19.2.8 shares with required version `^19.2.8`. The emitted prerendered
`client/index.html` contained both page markers. Thus the container, exposed
module map, share scope, and prerendered markup all existed in the same build
output.

The separate host was then built and both artifacts were served with `rsbuild
preview`, remote on 3101 and host on 3100. A Playwright Chromium page navigated
to the host, waited for the accessible heading, and observed:

```json
{
  "heading": "Federated Start page",
  "marker": "Loaded from the remote container.",
  "consoleErrors": [],
  "failedRequests": [],
  "pageErrors": [],
  "remoteResponses": [
    "200 http://127.0.0.1:3101/mf-manifest.json",
    "200 http://127.0.0.1:3101/assets/js/async/__federation_expose_Page.fa4a3eeec6.js",
    "200 http://127.0.0.1:3101/remoteEntry.js"
  ]
}
```

## What happened at the four collisions

| Collision | What the emitted build/load showed | Winner and configurability | Cost to this repository |
| --- | --- | --- | --- |
| Entry shape and HTML emission | The combined output used Start's one client bootstrap and did not emit Rsbuild's ordinary template during compilation; Start's post-build prerender nevertheless wrote `client/index.html` with the page markup. The exposed module was independently reachable through the container. | Start wins the application entry. Selecting federation's `client` environment is required; without it the build exited 0 but emitted no container, manifest, or expose chunk. | A remote gives up its ordinary standalone client entry to Start, but not `./Page`. Its standalone document becomes Start's prerendered document. That is a build rewrite, not a loss of the route or federation boundary. |
| Chunk splitting and runtime chunk | The final client artifact had one initial `assets/js/index.*.js`, `remoteEntry.js`, and async federation/share chunks; there was no separately emitted runtime chunk. The host loaded all three remote resources successfully. | Start's async-only split policy wins for its client entry; federation still creates the container and async exposed/share chunks. No override was needed, and the remote's no-separate-runtime requirement held in the emitted files. | The remote cannot keep an all-in-one chunk policy, but it does not have to accept a detached runtime chunk. The resulting async exposed chunk is normal federation output. |
| Output path and asset prefix | Start put browser output under `dist/combined/client`, even though the root configuration named `dist/combined`. It also changed the manifest public path from the configured absolute URL to `/`. In the first browser attempt, the host fetched `/remoteEntry.js` and the exposed chunk from port 3100, received host HTML, then reported `Unexpected token '<'` and federation `RUNTIME-001`. | Start wins the client subdirectory and asset prefix. Module Federation's documented producer option `getPublicPath: 'function() { return "http://127.0.0.1:3101/" }'` was required and made all remote requests go to port 3101. | Each publish lane must stage the contents of Start's `client` directory and supply its deployed per-app Pages URL through `getPublicPath`. Both are compatible with independent per-app lanes and static GitHub Pages, but neither is free migration work. Start's own document assets remain root-relative, fitting the composed site's root/base handling separately. |
| Exposes, share scope, and share strategy | The emitted manifest mapped `./Page`, and listed singleton React and React DOM shares at 19.2.8. The consuming host rendered the page. `shareStrategy: 'loaded-first'` was accepted in both producer and host configuration and the runtime journey had no share errors. | Module Federation owns these settings; Start neither removed nor replaced them after federation was attached to `client`. They are configurable in the normal federation options. | The repository gives up nothing in its expose map or loaded-first strategy. These remain federation-owned configuration alongside Start. |

One additional format interaction was observable only at the real consumption
boundary. With Start's default `rsbuild.client.output` (`module`), the combined
build and prerender both succeeded, but Chromium reported `Unexpected token
'export'` while loading the manifest-declared `global` container, followed by
`Failed to resolve module specifier ... The base URL is about:blank because
import() is called from a CORS-cross-origin script.` Setting Start's documented
`rsbuild.client.output` to `iife` aligned its client compilation with the
global container and made the journey pass. This repository's current remote
entries are classic scripts, so IIFE is acceptable; the cost is giving up
Start's default ESM client format for federated remotes.

## Reproduction

Create an npm workspace with `remote` and `host` packages. Install the exact
versions in the table. Both package scripts are `"build": "rsbuild build"`,
both packages use `"type": "module"`, and the remote TypeScript options are
`jsx: react-jsx`, `moduleResolution: Bundler`, `module: ESNext`, and target
ES2022.

Put the federation share contract in a workspace-root
`federation-shared.ts`, so the producer and consumer cannot silently drift:

```ts
import type { pluginModuleFederation } from '@module-federation/rsbuild-plugin'

type FederationOptions = Parameters<typeof pluginModuleFederation>[0]

export const shared: FederationOptions['shared'] = {
  react: { singleton: true, requiredVersion: '^19.2.8' },
  'react-dom': { singleton: true, requiredVersion: '^19.2.8' },
}
```

Use this remote configuration (the validated environment variable makes the
controls repeatable without changing source):

```ts
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'
import { shared } from '../federation-shared.js'

const requestedMode = process.env.SPIKE_MODE ?? 'combined'
const mode = (() => {
  switch (requestedMode) {
    case 'start':
    case 'federation':
    case 'combined':
      return requestedMode
    default:
      throw new Error(`Unsupported SPIKE_MODE: ${requestedMode}`)
  }
})()
const useStart = mode === 'start' || mode === 'combined'
const useFederation = mode === 'federation' || mode === 'combined'

export default defineConfig({
  server: { port: 3101 },
  output: {
    distPath: { root: `dist/${mode}` },
    assetPrefix: 'http://127.0.0.1:3101/',
  },
  source: useStart ? undefined : { entry: { index: './src/client.tsx' } },
  performance: useStart ? undefined : {
    chunkSplit: { strategy: 'all-in-one' },
  },
  plugins: [
    pluginReact(),
    ...(useStart ? [tanstackStart(useFederation ? {
      prerender: { enabled: true, crawlLinks: false },
      rsbuild: { client: { output: 'iife' } },
    } : {
      prerender: { enabled: true, crawlLinks: false },
    })] : []),
    ...(useFederation ? [pluginModuleFederation({
      name: 'start_remote',
      filename: 'remoteEntry.js',
      ...(useStart ? {
        getPublicPath:
          'function() { return "http://127.0.0.1:3101/" }',
      } : {}),
      exposes: { './Page': './src/Page.tsx' },
      shared,
      shareStrategy: 'loaded-first',
    }, useStart ? { environment: 'client' } : undefined)] : []),
  ],
})
```

`src/Page.tsx` default-exports a component containing the two markers. For the
federation-only control, `src/client.tsx` mounts that component with
`createRoot`, and `index.html` supplies `<div id="root"></div>`. For Start,
follow its minimal file-route layout: `src/router.tsx` exports `getRouter()`
over generated `routeTree`; `src/routes/__root.tsx` renders `<html>`,
`<HeadContent>`, `<Outlet>`, and `<Scripts>`; and `src/routes/index.tsx` defines
`createFileRoute('/')({ component: Page })`. The Start build generates
`routeTree.gen.ts`.

Use this separate host configuration:

```ts
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
import { shared } from '../federation-shared.js'

export default defineConfig({
  server: { port: 3100 },
  output: { assetPrefix: 'http://127.0.0.1:3100/' },
  plugins: [pluginReact(), pluginModuleFederation({
    name: 'spike_host',
    remotes: {
      start_remote:
        'start_remote@http://127.0.0.1:3101/mf-manifest.json',
    },
    shared,
    shareStrategy: 'loaded-first',
  })],
})
```

The host's `src/index.tsx` contains only `import('./bootstrap')`. Its
`bootstrap.tsx` uses `React.lazy(() => import('start_remote/Page'))`, renders it
inside `Suspense` with `createRoot`, and its `index.html` supplies the root div.
Build in this order:

```console
$ SPIKE_MODE=start npm run build -w remote
$ SPIKE_MODE=federation npm run build -w remote
$ npm run build -w host
$ SPIKE_MODE=combined npm run build -w remote
```

For each federation journey, run `rsbuild preview` for the selected remote mode
on port 3101 and for the host on 3100. In a real browser, load the host—not the
remote document—and wait for the `Federated Start page` heading. Record console
messages, `requestfailed`, and uncaught page errors, and verify the remote
manifest, entry, and exposed chunk requests are all 200 responses from port
3101. Reading `dist/<mode>/client/index.html` for the markers and
`mf-manifest.json` for `./Page` completes the emitted-artifact checks.

## Consequence for the evaluation

The compatibility condition in `tanstack-start-evaluation.md` is now met for
the versions above. Integration is not zero-configuration: every federated
Start remote needs the `client` environment selection, IIFE output, and a
deployment-aware `getPublicPath`; its publish lane must stage Start's nested
client output. None requires collapsing the twelve remotes, abandoning
loaded-first sharing, adding a server, or changing static GitHub Pages hosting.
This settles compatibility only; it does not change the evaluation's separate
benefit-versus-migration-cost test.
