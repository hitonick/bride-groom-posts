#!/usr/bin/env bash
# Prints {"path","bytes","mime","width","height"} for one image file, or {"path","error"} if it can't be read.
# Usage: scripts/image-info.sh <file>     — one image
#        scripts/image-info.sh <folder>   — every PNG/JPG/WebP directly in the folder (one line each); other files are listed as skipped
set -uo pipefail
f="$1"
if [ -d "$f" ]; then
  find "$f" -maxdepth 1 -type f | sort | while IFS= read -r x; do
    case "$(printf '%s' "$x" | tr '[:upper:]' '[:lower:]')" in
      *.png|*.jpg|*.jpeg|*.webp) "$0" "$x" ;;
      *) printf '{"path":"%s","skipped":"not a PNG/JPG/WebP file"}\n' "$x" ;;
    esac
  done
  exit 0
fi
if [ ! -f "$f" ]; then printf '{"path":"%s","error":"not found"}\n' "$f"; exit 0; fi
bytes=$(wc -c < "$f" | tr -d ' ')
mime=$(file --mime-type -b "$f" 2>/dev/null || echo unknown)
w=""; h=""
if command -v sips >/dev/null 2>&1; then
  w=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$f" 2>/dev/null | awk '/pixelHeight/{print $2}')
elif command -v identify >/dev/null 2>&1; then
  read -r w h < <(identify -format '%w %h' "$f[0]" 2>/dev/null)
elif command -v python3 >/dev/null 2>&1; then
  read -r w h < <(python3 -I - "$f" <<'PY'
import struct, sys
d = open(sys.argv[1], 'rb').read(1 << 20)
w = h = ''
if d[:8] == b'\x89PNG\r\n\x1a\n':
    w, h = struct.unpack('>II', d[16:24])
elif d[:4] == b'RIFF' and d[8:12] == b'WEBP':
    c = d[12:16]
    if c == b'VP8X': w, h = 1 + int.from_bytes(d[24:27], 'little'), 1 + int.from_bytes(d[27:30], 'little')
    elif c == b'VP8 ': w, h = struct.unpack('<HH', d[26:30]); w &= 0x3fff; h &= 0x3fff
    elif c == b'VP8L': b = int.from_bytes(d[21:25], 'little'); w, h = (b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1
elif d[:2] == b'\xff\xd8':
    i = 2
    while i < len(d) - 9:
        if d[i] != 0xff: i += 1; continue
        m = d[i + 1]
        if m in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
            h, w = struct.unpack('>HH', d[i + 5:i + 9]); break
        i += 2 + struct.unpack('>H', d[i + 2:i + 4])[0]
print(w, h)
PY
)
fi
printf '{"path":"%s","bytes":%s,"mime":"%s","width":%s,"height":%s}\n' "$f" "$bytes" "$mime" "${w:-null}" "${h:-null}"
