// TypeScript 6 checks that every side-effect import resolves to a module it
// can type, and this library's entry imports its own stylesheet, which the
// consuming app's rspack CSS support resolves rather than the compiler. This
// library depends on no build package, so it declares the pattern itself; an
// app names the same declaration from `@site/build-config` in its tsconfig.
declare module "*.css" {}
