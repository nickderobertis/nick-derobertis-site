Stand-in modules for the federation specifiers `index.spec.ts` and
`alias-resolution.spec.ts` alias. They exist so a spec can import an aliased
specifier for real and be told which module it reached: each one exports the
specifier that is supposed to resolve to it, so a mapping that resolves to the
wrong module fails on the name it reported rather than on a missing file.

Nothing ships them. They sit outside `src/` because the harness publishes only
`src/index.ts`, and they are compiled by `libs/testing/tsconfig.json` so the
ambient declarations in `specifiers.d.ts` stay honest about what each stand-in
exports.
