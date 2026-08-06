# Home rules

Home is a route remote and itself a host: it composes `home-carousel`,
`home-cards`, `home-story`, `home-contact`, `timeline`, `skills`, and `awards`.
It owns the composition and the panes' shared frame; each pane owns its own
content, states, and layout.

## Journeys

1. The composed page loads every pane boundary and exposes its happy, empty,
   loading, and error states — including the timeline pane's — through both the
   standalone remote and the host-composed route.
2. Action links navigate from the composed page through both render paths.
3. The build script entry points reject invalid inputs with recovery actions,
   and static routes tolerate malformed `Referer` headers.
