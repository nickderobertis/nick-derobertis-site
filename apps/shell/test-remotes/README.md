# Stand-in route remotes

The shell reaches its route pages across a Module Federation boundary: each one
is a separate deployable resolved by the federation runtime at load time, and
the declarations each remote's own build compiles from its exposes are the only
contract the shell has with them.

Vitest has no federation runtime, so `apps/shell/vite.config.ts` maps each of
those specifiers to a module here — that mapping is the single place the list
lives. They are the boundary the shell's own bootstrap is tested against, never
a stand-in for anything inside `apps/shell/src`, which is exercised as the real
thing. Each one renders what the shell handed it across the boundary, so a spec
can assert the route wiring by reading the page instead of by inspecting router
internals.

The remotes themselves are covered by their own apps' specs and by the
real-browser journeys in `apps/*/e2e`.
