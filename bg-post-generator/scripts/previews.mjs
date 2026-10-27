#!/usr/bin/env node
// Keeps templates/previews/ (one ~270 px PNG per template variant) in step with templates/manifest.json.
// templates/previews/index.json records the `look` fingerprint each PNG was exported from, so a preview is
// stale as soon as the designers change that template (scan-templates.js recomputes `look`).
//
//   node scripts/previews.mjs status              → {"ok":N,"todo":[{key,name,nodeId,maxDimension,reason}],"orphans":[…],"bytes":N}
//   node scripts/previews.mjs import <dir>        → copies <dir>/<key>.png for every listed variant (e.g. runs/.cache/previews)
//   node scripts/previews.mjs import-file <key> <png>  → one file (e.g. an image the client saved from get_screenshot)
//   node scripts/previews.mjs prune               → deletes previews of variants that are no longer in the manifest
// Writes only inside templates/previews/.
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, statSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'templates', 'previews');
const indexPath = join(dir, 'index.json');
const WIDTH = 270;
const m = JSON.parse(readFileSync(join(root, 'templates', 'manifest.json'), 'utf8'));
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
const variants = m.templates.flatMap(t => t.variants.map(v => ({ ...v, w: t.width, h: t.height })));
const byKey = new Map(variants.map(v => [v.key, v]));
const file = key => join(dir, `${key}.png`);
const fresh = v => existsSync(file(v.key)) && v.look && index[v.key] === v.look;
const saveIndex = () => { const sorted = Object.fromEntries(Object.keys(index).sort().map(k => [k, index[k]])); writeFileSync(indexPath, JSON.stringify(sorted, null, 2) + '\n'); };
const pngSize = f => { const b = readFileSync(f); if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null; return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

function importOne(key, src) {
  const v = byKey.get(key);
  if (!v) return { key, error: 'not a variant key in the manifest' };
  const size = existsSync(src) ? pngSize(src) : null;
  if (!size) return { key, error: `not a PNG: ${src}` };
  if (Math.abs(size.w - WIDTH) > 4 && Math.abs(size.h - WIDTH) > 4) return { key, error: `expected ~${WIDTH} px wide, got ${size.w}×${size.h}` };
  mkdirSync(dir, { recursive: true });
  copyFileSync(src, file(key));
  index[key] = v.look || null;
  return { key, ok: true, w: size.w, h: size.h };
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'status') {
  const todo = variants.filter(v => !fresh(v)).map(v => ({
    key: v.key, name: v.name, nodeId: v.nodeId,
    // get_screenshot caps the longer edge: this makes the shot WIDTH px wide for feed and story formats alike.
    maxDimension: Math.round(WIDTH * Math.max(v.w, v.h) / v.w),
    reason: !existsSync(file(v.key)) ? 'missing' : !v.look ? 'manifest has no look fingerprint (re-sync)' : 'template changed',
  }));
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.png')) : [];
  const orphans = files.filter(f => !byKey.has(f.replace(/\.png$/, '')));
  const bytes = files.reduce((a, f) => a + statSync(join(dir, f)).size, 0);
  console.log(JSON.stringify({ ok: variants.length - todo.length, total: variants.length, todo, orphans, bytes }));
} else if (cmd === 'import' && args[0]) {
  const res = variants.filter(v => existsSync(join(args[0], `${v.key}.png`))).map(v => importOne(v.key, join(args[0], `${v.key}.png`)));
  saveIndex();
  console.log(JSON.stringify({ imported: res.filter(r => r.ok).length, errors: res.filter(r => r.error) }));
} else if (cmd === 'import-file' && args.length === 2) {
  const r = importOne(args[0], args[1]);
  saveIndex();
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
} else if (cmd === 'prune') {
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.png') && !byKey.has(f.replace(/\.png$/, ''))) : [];
  for (const f of files) { unlinkSync(join(dir, f)); delete index[f.replace(/\.png$/, '')]; }
  for (const k of Object.keys(index)) if (!byKey.has(k)) delete index[k];
  if (existsSync(dir)) saveIndex();
  console.log(JSON.stringify({ removed: files }));
} else {
  console.error('usage: node scripts/previews.mjs status | import <dir> | import-file <key> <png> | prune');
  process.exit(1);
}
