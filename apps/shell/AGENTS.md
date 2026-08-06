# Shell rules

The shell owns the Pages base path, routing, shared layout, and remote
composition. Keep feature content out of this app; remotes mount at route
boundaries and may consume or expose federated modules.

## Journeys

1. All five Pages-base routes load directly with header, footer, route content,
   and no failed assets; keyboard navigation works; each route retains useful
   substantive prerendered HTML without JavaScript, including the remote styling
   each document inlines; unknown paths show the static 404 recovery document
   and client-side redirect home; `/story` redirects to `/bio`; leaf routes
   reuse their prerendered DOM without hydration warnings and navigate as an
   SPA; every route recovers when the data host fails.
2. Startup fetches only the entry route's remote and leaves the other four route
   remotes unfetched until a nav link is hovered; hover intent preloads a
   route's code, data, and images, so a settled hover then click mounts Home's
   panes and Software's warm card logos without a skeleton, while a click that
   beats the preload still shows skeletons and settles, and a warmed Home
   recovers when the preloaded awards data is unavailable.
3. The deploy topology is covered apart from the local one: composing a
   content-store-shaped fragment root into a fresh output directory, serving
   that directory as Pages serves it, and loading every route and standalone
   remote from it produces no failed request.
