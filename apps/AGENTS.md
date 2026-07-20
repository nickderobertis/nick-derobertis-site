# Application instructions

Keep each application as an Nx project with uniform `build`, `lint`, `test`, and
`typecheck` targets. The shell owns routing and layout. Route applications are
federated remotes: pin their public paths below the GitHub Pages project base,
expose their route page, and consume other remotes only through declared
federation boundaries.
