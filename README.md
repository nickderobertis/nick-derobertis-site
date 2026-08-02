# Published fragment content store

Storage only. Every directory below `apps/` is one app's
independently published bytes (bundle, `fragment.html`, `fragment.css`,
`fragment.json`), written by that app's publish lane in
`.github/workflows/pages.yml` and by nothing else.

**This branch is never the served source.** GitHub Pages for this repository
stays on `build_type: workflow`: the compose-and-deploy lane assembles these
fragments into the real site and uploads it with `actions/upload-pages-artifact`.
Pointing Pages at this branch would serve unassembled fragments and would put
deploys back on the legacy branch builder, where a newer build kills an
in-flight one and records it `errored` with duration 0.
