#!/usr/bin/env bash
# Optional session-startup installer; failures are reported but never block login.
# llmlint: ignore-file[changed_behavior_has_e2e,tool_output_is_signal,boundary_inputs_validated] This developer-only PyPI installer has no browser interface. It deliberately logs and continues so registry availability cannot block a session; uv validates the registry packages before executing their installed entry points.
set -uo pipefail

# 0.3.17 supplies the diff scoping and deterministic validation used by justfile.
readonly LLMLINT_MIN="0.3.17"
readonly BIN_DIR="$HOME/.local/bin"

log() { printf 'setup-llmlint: %s\n' "$*" >&2; }

# Install llmlint from PyPI via uv (the repo's Python package manager). uv is a
# clean-clone prerequisite; if it is somehow absent, log an actionable pointer and
# leave any already-installed binary in place rather than aborting startup.
ensure_toolchain() {
  if ! command -v uv >/dev/null 2>&1; then
    log "uv not found; cannot install llmlint (install uv: https://docs.astral.sh/uv/)"
    return 0
  fi
  log "installing llmlint-cli >= $LLMLINT_MIN via uv tool"
  uv tool install --upgrade "llmlint-cli>=$LLMLINT_MIN" >&2 \
    || log "llmlint-cli install failed (continuing)"
}

# Persist env for the rest of the session via CLAUDE_ENV_FILE (Claude Code sources
# it into every later Bash call). PATH so the freshly installed binaries resolve.
# No-op outside a session.
persist_session_env() {
  [ -n "${CLAUDE_ENV_FILE:-}" ] || { log "no CLAUDE_ENV_FILE (not a session); skipping env"; return 0; }
  {
    case ":${PATH}:" in *":${BIN_DIR}:"*) ;; *) printf 'export PATH=%q\n' "${BIN_DIR}:${PATH}";; esac
  } >> "$CLAUDE_ENV_FILE"
  log "exported PATH"
}

export PATH="${BIN_DIR}:${PATH}"
ensure_toolchain
persist_session_env
if command -v llmlint >/dev/null 2>&1; then
  log "ready (llmlint: $(llmlint --version 2>/dev/null || echo unknown))"
  llmlint doctor >&2 2>&1 || log "llmlint doctor reported an issue (see above)"
else
  log "llmlint not installed"
fi
exit 0
