#!/usr/bin/env bash
# Uploads one image to a Figma upload URL returned by the upload_assets tool, and prints Figma's JSON reply
# ({"success":true,"imageHash":…,"placedOnNodeId":…}).
# Usage: scripts/upload-asset.sh '<submitUrl>' <image file>
# Only https://mcp.figma.com/mcp/upload/… URLs and PNG/JPEG/WebP files up to config.media.maxBytes are accepted,
# which is why this script (not a bare curl) is pre-approved in .claude/settings.json.
set -euo pipefail
url="${1:-}"; f="${2:-}"
die() { printf '{"success":false,"error":"%s"}\n' "$1"; exit 1; }
[ $# -eq 2 ] || die "usage: upload-asset.sh <submitUrl> <file>"
case "$url" in https://mcp.figma.com/mcp/upload/*) ;; *) die "not a Figma upload URL" ;; esac
# '&' is allowed: Figma's URLs carry ?scaleMode=…&currentPageId=…; the URL is passed to curl as one quoted argument.
case "$url" in *[[:space:]\"\'\`\$\;\|\<\>]*) die "unexpected characters in URL" ;; esac
[ -f "$f" ] || die "file not found: $f"
mime=$(file --mime-type -b "$f" 2>/dev/null || echo unknown)
case "$mime" in image/png|image/jpeg|image/webp) ;; *) die "not a PNG/JPEG/WebP image ($mime)" ;; esac
max=$(sed -nE 's/.*"maxBytes"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$(dirname "$0")/../config.json" | head -1)
bytes=$(wc -c < "$f" | tr -d ' ')
[ "$bytes" -le "${max:-10485760}" ] || die "file is $bytes bytes, limit ${max:-10485760}"
# Figma accepts cut-off files but shows them grey, so refuse them here.
bash "$(dirname "$0")/image-info.sh" "$f" | grep -q '"complete":true' || die "the file is damaged or cut off; save or export it again"
curl -sS --fail-with-body --max-time 120 -X POST -F "file=@${f};type=${mime}" "$url"
echo
