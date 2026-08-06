# Awards rules

This remote publishes the Home awards pane and its standalone document. It also
exposes `preload`, which the shell's hover intent reaches through Home so a
warmed route mounts past the awards skeleton.

## Journeys

1. The selected awards subset renders with its optional card content, and the
   complete set renders with its statistics, through both the standalone remote
   and the host-composed Home page.
2. Its skeleton shows while the awards boundary is pending, and its empty and
   error data-boundary states render, through both render paths.
3. Both views fit each viewport, and every state fits onto a phone.
