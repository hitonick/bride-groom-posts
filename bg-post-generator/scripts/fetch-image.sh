#!/usr/bin/env bash
# Downloads one image (an operator's photo URL, or a get_screenshot URL) into runs/.cache/ and prints
# scripts/image-info.sh's JSON for it. Anything that is not a PNG/JPEG/WebP within config.media.maxBytes is deleted.
# Usage: scripts/fetch-image.sh '<https URL>' <name>
#   <name> is a path inside runs/.cache/ (letters, digits, . _ - /, no ".."), e.g. BG-20261027-1239-anna/photo-1.jpg
# Writes nowhere else, which is why it (not a bare curl) is pre-approved in .claude/settings.json.
set -euo pipefail
url="${1:-}"; name="${2:-}"
die() { printf '{"path":"%s","error":"%s"}\n' "$name" "$1"; exit 1; }
[ $# -eq 2 ] || die "usage: fetch-image.sh <url> <name>"
case "$url" in https://*) ;; *) die "only https URLs" ;; esac
case "$url" in *[[:space:]\"\'\`\$\;\|\<\>]*) die "unexpected characters in URL" ;; esac
case "$name" in ""|/*|*..*|*[!A-Za-z0-9._/-]*) die "name must be a relative path of letters, digits, . _ - /" ;; esac
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/runs/.cache/$name"
mkdir -p "$(dirname "$dest")"
max=$(sed -nE 's/.*"maxBytes"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$root/config.json" | head -1)
if ! curl -sS -f -L --max-time 120 --max-filesize "${max:-10485760}" -o "$dest" "$url"; then rm -f "$dest"; die "download failed"; fi
mime=$(file --mime-type -b "$dest" 2>/dev/null || echo unknown)
case "$mime" in image/png|image/jpeg|image/webp) ;; *) rm -f "$dest"; die "not a PNG/JPEG/WebP image ($mime)" ;; esac
bash "$root/scripts/image-info.sh" "$dest"
