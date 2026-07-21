# Production visual baseline

These images capture the deployed site at <https://nickderobertis.com>. Regenerate
them from the repository root with `just screenshots` after installing Node
dependencies and the Playwright Chromium browser (`npx playwright install chromium`).

The baseline contains full-page captures for every public route and focused
captures for each substantial home-page pane at mobile, tablet, and desktop
widths. Interaction variants cover a rotated carousel, hovered and expanded
skills sunburst, and an employment-only timeline filter.

## Screencomp migration

The PNGs remain the immutable look-and-feel source imported by PR #12 (commit
`c7fe035`). They are intentionally separate from screencomp's image-free digest
manifests under each `apps/<remote>/visual/baseline/` directory. The checked-in
`screencomp-migration.json` records which remote owns every reference group and
the review disposition used when seeding those manifests.

`just verify-visual-reference` verifies that every recorded PR
#12 PNG is still present, every owner has a per-project screencomp baseline, and
no reference group is left unmapped. This preserves the original images as the
explicit fidelity reference while screencomp owns reproducible ongoing diffs.
