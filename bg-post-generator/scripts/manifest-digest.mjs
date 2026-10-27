#!/usr/bin/env node
// Prints the same fingerprints as scan-templates.js mode 'digest', computed from templates/manifest.json,
// or compares them with a live digest result: node scripts/manifest-digest.mjs [live.json]
import { readFileSync } from 'node:fs';
const m = JSON.parse(readFileSync(new URL('../templates/manifest.json', import.meta.url), 'utf8'));
function fnv(str, seed) { let h = seed >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); }
const digest = s => fnv(s, 2166136261) + fnv(s, 0x9747b28c);
const canon = v => Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v);
// `preview` is added locally by assemble-manifest.mjs (the live scan doesn't know it), so it is left out here.
const live_ = t => ({ ...t, variants: t.variants.map(({ preview, ...v }) => v) });
const local = { hash: m.hash, lookHash: m.lookHash, scannerVersion: m.scannerVersion, templateCount: m.templates.length,
  meta: digest(canon({ fontWidthRatios: m.fontWidthRatios, palettes: m.palettes, colorsByType: m.colorsByType, irregularities: m.irregularities })),
  templates: m.templates.map(t => [t.group, t.variants[0].color, digest(canon(live_(t)))]) };
const livePath = process.argv[2];
if (!livePath) { console.log(JSON.stringify(local)); process.exit(0); }
const live = JSON.parse(readFileSync(livePath, 'utf8'));
const diffs = [];
for (const k of ['hash', 'lookHash', 'scannerVersion', 'templateCount', 'meta']) if (live[k] !== local[k]) diffs.push(`${k}: live ${live[k]} ≠ manifest ${local[k]}`);
const key = t => `${t[0]} (${t[1]})`;
const lm = new Map(local.templates.map(t => [key(t), t[2]]));
for (const t of live.templates) if (lm.get(key(t)) !== t[2]) diffs.push(`template ${key(t)}: ${lm.has(key(t)) ? 'differs' : 'new'}`);
for (const k of lm.keys()) if (!live.templates.some(t => key(t) === k)) diffs.push(`template ${k}: removed`);
console.log(diffs.length ? diffs.join('\n') : `identical: ${local.templateCount} template entries + meta match the live scan`);
process.exit(diffs.length ? 1 : 0);
