#!/usr/bin/env node
// Builds one PNG that shows several template previews side by side, numbered and labelled like the answer options.
// No dependencies (Node ≥ 18 only), so it works the same on macOS, Windows and Linux.
//
// Usage:
//   node scripts/contact-sheet.mjs <out.png> [--title "3/9 Which color?"] [--cols 4] [--width 200] [--strip]
//                                  -- <image.png> "<label>" [<image.png> "<label>" …]
//   A label is one line of dark text (wrapped as needed); text after a "\n" is a grey second line.
//   --cols    tiles per row (default: all in one row up to 5, then 4 per row)
//   --width   tile width in px (default 200; previews are 270 px wide and are scaled down)
//   --strip   one row, small tiles (140 px), "→" between them: for carousel / story-set sequences
// A missing or unreadable image becomes a grey "no preview" tile, so the sheet is always produced.
// <out.png> must be inside runs/.cache/ (the script is pre-approved in .claude/settings.json, so it writes nowhere else).
// Prints {"out","width","height","items","missing":[…]} as JSON. Exits 1 only if nothing could be written.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

// ---- arguments ------------------------------------------------------------
const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const opts = sep < 0 ? argv : argv.slice(0, sep);
const rest = sep < 0 ? [] : argv.slice(sep + 1);
const out = opts[0];
const opt = (name, dflt) => { const i = opts.indexOf(name); return i > 0 ? opts[i + 1] : dflt; };
const strip = opts.includes('--strip');
if (!out || out.startsWith('--') || rest.length < 2 || rest.length % 2) {
  console.error('usage: node scripts/contact-sheet.mjs <out.png> [--title T] [--cols N] [--width PX] [--strip] -- <img> <label> [<img> <label> …]');
  process.exit(1);
}
const cacheDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'runs', '.cache');
const rel = relative(cacheDir, resolve(out));
if (!out.endsWith('.png') || !rel || rel.startsWith('..') || isAbsolute(rel)) { console.error(`contact-sheet: <out.png> must be a .png inside ${cacheDir}`); process.exit(1); }
const items = [];
for (let i = 0; i < rest.length; i += 2) items.push({ path: rest[i], label: rest[i + 1] });
const tileW = +opt('--width', strip ? 140 : 200);
const cols = strip ? items.length : +opt('--cols', items.length <= 5 ? items.length : 4);
const title = opt('--title', '');

// ---- PNG decode (8/16-bit gray/RGB/RGBA/gray+alpha, palette ≤ 8-bit; non-interlaced) --------------
function crcTable() { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const CRC = crcTable();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, ihdr, plte, trns; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ctype: data[9], interlace: data[12] };
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const { w, h, depth, ctype, interlace } = ihdr;
  if (interlace) throw new Error('interlaced PNG');
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!chans || (ctype === 3 ? depth > 8 : depth !== 8 && depth !== 16)) throw new Error(`unsupported PNG (type ${ctype}, depth ${depth})`);
  const bpp = Math.max(1, (chans * depth) >> 3), stride = (w * chans * depth + 7) >> 3;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = up ? up[x] : 0, c = up && x >= bpp ? up[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 0xff;
    }
  }
  const rgba = Buffer.alloc(w * h * 4), sb = depth === 16 ? 2 : 1; // 16-bit samples: keep the high byte
  const at = (y, x, c) => px[y * stride + (x * chans + c) * sb];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (ctype === 3) {
      const per = 8 / depth, byte = px[y * stride + Math.floor(x / per)], idx = (byte >> (8 - depth * (x % per + 1))) & ((1 << depth) - 1);
      rgba[o] = plte[idx * 3]; rgba[o + 1] = plte[idx * 3 + 1]; rgba[o + 2] = plte[idx * 3 + 2]; rgba[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
    } else if (chans <= 2) { rgba[o] = rgba[o + 1] = rgba[o + 2] = at(y, x, 0); rgba[o + 3] = chans === 2 ? at(y, x, 1) : 255; }
    else { rgba[o] = at(y, x, 0); rgba[o + 1] = at(y, x, 1); rgba[o + 2] = at(y, x, 2); rgba[o + 3] = chans === 4 ? at(y, x, 3) : 255; }
  }
  return { w, h, data: rgba };
}

// ---- canvas ----------------------------------------------------------------
const BG = [255, 255, 255], INK = [34, 34, 40], MUTED = [120, 120, 130], TILE_BG = [236, 236, 240];
function canvas(w, h) { const d = Buffer.alloc(w * h * 3); for (let i = 0; i < d.length; i += 3) d.set(BG, i); return { w, h, d }; }
function fill(cv, x0, y0, w, h, rgb) { for (let y = Math.max(0, y0); y < Math.min(cv.h, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(cv.w, x0 + w); x++) cv.d.set(rgb, (y * cv.w + x) * 3); }
// Area-average downscale of an RGBA image into the canvas at (x0,y0), size dw×dh, over white.
function blit(cv, img, x0, y0, dw, dh) {
  const sx = img.w / dw, sy = img.h / dh;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const ax = Math.floor(x * sx), bx = Math.max(ax + 1, Math.floor((x + 1) * sx)), ay = Math.floor(y * sy), by = Math.max(ay + 1, Math.floor((y + 1) * sy));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = ay; yy < by && yy < img.h; yy++) for (let xx = ax; xx < bx && xx < img.w; xx++) {
      const o = (yy * img.w + xx) * 4, a = img.data[o + 3] / 255;
      r += img.data[o] * a + 255 * (1 - a); g += img.data[o + 1] * a + 255 * (1 - a); b += img.data[o + 2] * a + 255 * (1 - a); n++;
    }
    const cx = x0 + x, cy = y0 + y;
    if (n && cx >= 0 && cy >= 0 && cx < cv.w && cy < cv.h) cv.d.set([r / n, g / n, b / n].map(Math.round), (cy * cv.w + cx) * 3);
  }
}

// ---- text: 8×17 bitmap glyphs, 4-bit alpha, rasterized from DejaVu Sans Mono Bold 13px
// (DejaVu fonts license: free to use, copy and redistribute). Unknown characters print as "?".
const GLYPH_CHARS = [...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), '·', '×', '→', '…'];
const GW = 8, GH = 17;
const GLYPHS = Buffer.from(
  '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', 'base64');
// Typographic characters outside the glyph set get a close ASCII stand-in.
const STAND_IN = { '≈': '~', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '↔': '-', '←': '<', '•': '·', '\u00a0': ' ' };
function drawText(cv, text, x0, y0, rgb, scale = 1) {
  let x = x0;
  for (const raw of text) {
    const ch = STAND_IN[raw] || raw;
    let gi = GLYPH_CHARS.indexOf(ch); if (gi < 0) gi = GLYPH_CHARS.indexOf('?');
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const k = gi * GW * GH + gy * GW + gx, a = ((GLYPHS[k >> 1] >> (k & 1 ? 0 : 4)) & 15) / 15;
      if (!a) continue;
      for (let s = 0; s < scale * scale; s++) {
        const px = x + gx * scale + (s % scale), py = y0 + gy * scale + Math.floor(s / scale);
        if (px < 0 || py < 0 || px >= cv.w || py >= cv.h) continue;
        const o = (py * cv.w + px) * 3;
        for (let c = 0; c < 3; c++) cv.d[o + c] = Math.round(cv.d[o + c] * (1 - a) + rgb[c] * a);
      }
    }
    x += GW * scale;
  }
}
// Word-wrap into at most `max` lines of `perLine` chars; the last line ends with "…" when cut.
function wrap(text, perLine, max) {
  const words = text.split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w; else if ((cur + ' ' + w).length <= perLine) cur += ' ' + w; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const outL = lines.slice(0, max).map(l => (l.length > perLine ? l.slice(0, perLine - 1) + '…' : l));
  if (lines.length > max) { const l = outL[max - 1]; outL[max - 1] = (l.length >= perLine ? l.slice(0, perLine - 1) : l) + '…'; }
  return outL;
}

// ---- PNG encode (RGB, adaptive filter) --------------------------------------
function encodePng({ w, h, d }) {
  const stride = w * 3, raw = Buffer.alloc((stride + 1) * h), cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = d.subarray(y * stride, (y + 1) * stride), up = y ? d.subarray((y - 1) * stride, y * stride) : null;
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const o = cand[f]; let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 3 ? row[x - 3] : 0, b = up ? up[x] : 0, c = up && x >= 3 ? up[x - 3] : 0;
        let pred = 0;
        if (f === 1) pred = a; else if (f === 2) pred = b; else if (f === 3) pred = (a + b) >> 1;
        else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        const v = (row[x] - pred) & 0xff; o[x] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    raw[y * (stride + 1)] = best; cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- layout -------------------------------------------------------------------
const imgs = items.map(it => { try { return decodePng(readFileSync(it.path)); } catch (e) { return null; } });
const missing = items.filter((_, i) => !imgs[i]).map(it => it.path);
const rows = Math.ceil(items.length / cols);
// Each row is as tall as its tallest preview (a missing one counts as a 4:5 feed tile).
const rowH = Array.from({ length: rows }, (_, r) => Math.round(tileW * Math.max(...imgs.slice(r * cols, (r + 1) * cols).map(im => (im ? im.h / im.w : 1.25)))));
const pad = 16, gap = strip ? 28 : 20, lineH = GH + 2, labelLines = 3;
const perLine = Math.floor(tileW / GW);
const titleH = title ? GH * 2 + 12 : 0;
const labelH = 8 + labelLines * lineH;
const rowY = rowH.map((_, r) => rowH.slice(0, r).reduce((a, h) => a + h + labelH + gap, 0));
// Wide enough for the title (a one-tile strip would otherwise cut it).
const W = Math.max(pad * 2 + cols * tileW + (cols - 1) * gap, title ? pad * 2 + Math.min(title.length, 60) * GW * 2 : 0);
const H = pad * 2 + titleH + rowH.reduce((a, h) => a + h + labelH, 0) + (rows - 1) * gap;
const cv = canvas(W, H);
if (title) drawText(cv, wrap(title, Math.floor((W - 2 * pad) / (GW * 2)), 1)[0], pad, pad, INK, 2);
items.forEach((it, i) => {
  const r = Math.floor(i / cols), tileH = rowH[r];
  const cx = pad + (i % cols) * (tileW + gap), cy = pad + titleH + rowY[r];
  const im = imgs[i];
  if (im) { const dh = Math.round(tileW * im.h / im.w); blit(cv, im, cx, cy, tileW, Math.min(dh, tileH)); }
  else { fill(cv, cx, cy, tileW, tileH, TILE_BG); drawText(cv, 'no preview', cx + Math.max(4, (tileW - 10 * GW) >> 1), cy + (tileH >> 1) - 8, MUTED); }
  const [main, sub = ''] = it.label.split('\n');
  const mainLines = wrap(main, perLine, sub ? labelLines - 1 : labelLines), subLines = sub ? wrap(sub, perLine, labelLines - mainLines.length) : [];
  [...mainLines.map(l => [l, INK]), ...subLines.map(l => [l, MUTED])].forEach(([l, rgb], k) => drawText(cv, l, cx, cy + tileH + 8 + k * lineH, rgb));
  if (strip && i < items.length - 1) drawText(cv, '→', cx + tileW + ((gap - GW) >> 1), cy + (tileH >> 1) - 8, MUTED);
});
try {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePng(cv));
} catch (e) { console.error(`contact-sheet: ${e.message}`); process.exit(1); }
console.log(JSON.stringify({ out, width: W, height: H, items: items.length, missing }));
