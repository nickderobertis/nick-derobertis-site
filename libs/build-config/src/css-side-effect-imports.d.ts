// TypeScript 6 checks that every side-effect import resolves to a module it
// can type, and a stylesheet is not one: rspack's CSS support is what resolves
// `import "./page.css"`, not the compiler. Declaring the pattern as a module
// with no exports keeps that check on for every other side-effect import while
// still refusing a value import from a stylesheet, which nothing here does.
// Each app names this file in its tsconfig `types` through the
// `./css-side-effect-imports` export of its declared `@site/build-config`
// dependency, rather than reaching into this source tree.
declare module "*.css" {}
