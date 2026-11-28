# Production visual baseline

These images capture the deployed site at <https://nickderobertis.com>. They are an
immutable import and are not regenerated; each app's screencomp scenarios own
ongoing capture.

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

`scripts/visual/verify-reference-migration.mjs` verifies that every recorded PR
#12 PNG is still present, every owner has a per-project screencomp baseline, and
no reference group is left unmapped. This preserves the original images as the
explicit fidelity reference while screencomp owns reproducible ongoing diffs.
