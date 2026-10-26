#!/usr/bin/env bash
# Prints the operator's local time as JSON: {"iso":"2026-10-23T14:30:05+03:00","local":"2026-10-23 14:30","tz":"Europe/Kyiv","stamp":"20261023-1430"}
# Works on macOS, Linux and Git Bash on Windows.
set -euo pipefail
iso=$(date +"%Y-%m-%dT%H:%M:%S%z" | sed -E 's/([+-][0-9]{2})([0-9]{2})$/\1:\2/')
tz="${TZ:-}"
if [ -z "$tz" ] && [ -L /etc/localtime ]; then tz=$(readlink /etc/localtime | sed -E 's|.*/zoneinfo/||'); fi
if [ -z "$tz" ] && [ -f /etc/timezone ]; then tz=$(cat /etc/timezone); fi
if [ -z "$tz" ] && command -v timedatectl >/dev/null 2>&1; then tz=$(timedatectl show -p Timezone --value 2>/dev/null || true); fi
if [ -z "$tz" ] && command -v powershell.exe >/dev/null 2>&1; then tz=$(powershell.exe -NoProfile -Command "[System.TimeZoneInfo]::Local.Id" 2>/dev/null | tr -d '\r'); fi
[ -z "$tz" ] && tz=$(date +%Z)
# Older tzdata names Kyiv "Kiev"; report the current IANA spelling.
[ "$tz" = "Europe/Kiev" ] && tz="Europe/Kyiv"
printf '{"iso":"%s","local":"%s","tz":"%s","stamp":"%s"}\n' "$iso" "$(date +"%Y-%m-%d %H:%M")" "$tz" "$(date +"%Y%m%d-%H%M")"
