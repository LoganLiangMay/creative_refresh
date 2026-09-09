#!/usr/bin/env bash
#
# update-github-remotes.sh — rewrite GitHub remote URLs after a username change.
#
# Scans a directory tree for git repositories and rewrites every remote whose
# owner segment matches OLD_USER so it points at NEW_USER instead. Handles
# HTTPS, SSH (scp-style and ssh://), git:// and token-embedded URLs, and both
# fetch URLs and push URLs, for every remote — not just "origin".
#
# Dry run by default; nothing is written until you pass --apply.
#
#   ./update-github-remotes.sh old-user new-user ~/code          # preview
#   ./update-github-remotes.sh old-user new-user ~/code --apply  # rewrite
#
set -u

OLD=""; NEW=""; ROOT="."
APPLY=0; VERIFY=0; VERBOSE=0

usage() {
  cat <<'USAGE'
Usage: update-github-remotes.sh OLD_USER NEW_USER [SEARCH_DIR] [options]

  SEARCH_DIR  directory to scan for git repos (default: current directory)

Options:
  --apply     actually rewrite the remotes (default is a dry run)
  --verify    after rewriting, contact GitHub to confirm each URL resolves
  -v          also list repos that were scanned but had nothing to change
  -h          show this help
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --apply)  APPLY=1 ;;
    --verify) VERIFY=1 ;;
    -v)       VERBOSE=1 ;;
    -h|--help) usage; exit 0 ;;
    -*)       echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *)
      if   [ -z "$OLD" ]; then OLD="$1"
      elif [ -z "$NEW" ]; then NEW="$1"
      else ROOT="$1"
      fi ;;
  esac
  shift
done

if [ -z "$OLD" ] || [ -z "$NEW" ]; then usage >&2; exit 2; fi
if [ ! -d "$ROOT" ]; then echo "not a directory: $ROOT" >&2; exit 2; fi

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
OLD_LC=$(lower "$OLD")

# Print the rewritten URL on stdout and return 0 if it is a GitHub URL owned by
# OLD (owner match is case-insensitive, as GitHub logins are). Return 1 to leave
# the URL untouched.
rewrite_url() {
  url="$1"; prefix=""; rest=""
  case "$url" in
    git@github.com:*)       prefix="git@github.com:"       ; rest="${url#git@github.com:}" ;;
    ssh://*@github.com/*)   prefix="${url%%github.com/*}github.com/"; rest="${url#*github.com/}" ;;
    ssh://github.com/*)     prefix="ssh://github.com/"     ; rest="${url#ssh://github.com/}" ;;
    git://github.com/*)     prefix="git://github.com/"     ; rest="${url#git://github.com/}" ;;
    https://*@github.com/*|http://*@github.com/*)
                            prefix="${url%%github.com/*}github.com/"; rest="${url#*github.com/}" ;;
    https://github.com/*)   prefix="https://github.com/"   ; rest="${url#https://github.com/}" ;;
    http://github.com/*)    prefix="http://github.com/"    ; rest="${url#http://github.com/}" ;;
    *) return 1 ;;
  esac

  owner="${rest%%/*}"
  [ "$owner" = "$rest" ] && return 1          # no repo segment after the owner
  [ -z "$owner" ] && return 1
  [ "$(lower "$owner")" = "$OLD_LC" ] || return 1

  printf '%s%s/%s' "$prefix" "$NEW" "${rest#*/}"
}

changed_remotes=0; changed_repos=0; scanned=0; failed=0

# -name .git catches both normal repos (directory) and worktrees/submodules (file).
while IFS= read -r gitpath; do
  repo=$(dirname "$gitpath")
  git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || continue
  scanned=$((scanned + 1))
  repo_header_shown=0

  for name in $(git -C "$repo" remote); do
    for key in url pushurl; do
      old_url=$(git -C "$repo" config --get "remote.$name.$key" 2>/dev/null) || continue
      [ -n "$old_url" ] || continue
      new_url=$(rewrite_url "$old_url") || continue

      if [ "$repo_header_shown" -eq 0 ]; then
        printf '\n%s\n' "$repo"
        repo_header_shown=1
        changed_repos=$((changed_repos + 1))
      fi
      printf '  %s (%s)\n    %s\n    -> %s\n' "$name" "$key" "$old_url" "$new_url"
      changed_remotes=$((changed_remotes + 1))

      [ "$APPLY" -eq 1 ] || continue

      if [ "$key" = "pushurl" ]; then
        git -C "$repo" remote set-url --push "$name" "$new_url"
      else
        git -C "$repo" remote set-url "$name" "$new_url"
      fi || { echo "    !! failed to update" >&2; failed=$((failed + 1)); continue; }

      if [ "$VERIFY" -eq 1 ]; then
        if GIT_TERMINAL_PROMPT=0 git -C "$repo" ls-remote --exit-code "$new_url" >/dev/null 2>&1; then
          echo "    ok: reachable"
        else
          echo "    !! not reachable (check the repo name, or your credentials)" >&2
          failed=$((failed + 1))
        fi
      fi
    done
  done

  if [ "$repo_header_shown" -eq 0 ] && [ "$VERBOSE" -eq 1 ]; then
    printf '\n%s\n  nothing to change\n' "$repo"
  fi
done <<EOF
$(find "$ROOT" \( -name node_modules -o -name vendor -o -name .Trash \) -prune -o -name .git -print 2>/dev/null)
EOF

echo
if [ "$changed_remotes" -eq 0 ]; then
  echo "Scanned $scanned repo(s) under $ROOT — no remotes owned by '$OLD' found."
  exit 0
fi

if [ "$APPLY" -eq 1 ]; then
  echo "Updated $changed_remotes remote(s) across $changed_repos of $scanned repo(s)."
else
  echo "Dry run: $changed_remotes remote(s) across $changed_repos of $scanned repo(s) would change."
  echo "Re-run with --apply to write these changes."
fi
[ "$failed" -gt 0 ] && { echo "$failed problem(s) reported above." >&2; exit 1; }
exit 0
