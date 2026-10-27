#!/usr/bin/env node
// Assembles templates/manifest.json from the scan parts that /sync-templates saved in templates/.scan/:
//   meta.json            ← scan-templates.js mode 'meta'
//   part-<offset>.json   ← scan-templates.js mode 'templates'
// Usage: node scripts/assemble-manifest.mjs --by "<figma handle>"
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scanDir = join(root, 'templates', '.scan');
const config = JSON.parse(readFileSync(join(root, 'config.json'), 'utf8'));
const byIdx = process.argv.indexOf('--by');
const generatedBy = byIdx > 0 ? process.argv[byIdx + 1] : undefined;

const fail = msg => { console.error(`assemble-manifest: ${msg}`); process.exit(1); };
const read = f => JSON.parse(readFileSync(join(scanDir, f), 'utf8'));

const meta = read('meta.json');
const parts = readdirSync(scanDir).filter(f => /^part-\d+\.json$/.test(f)).map(read).sort((a, b) => a.offset - b.offset);
if (!parts.length) fail('no part-*.json files');
for (const p of parts) if (p.hash !== meta.hash) fail(`part at offset ${p.offset} has hash ${p.hash}, meta has ${meta.hash} — the file changed mid-scan, re-run the sync`);

const templates = parts.flatMap(p => p.templates);
// Every variant has a preview thumbnail at a fixed path; scripts/previews.mjs exports and tracks them.
for (const t of templates) for (const v of t.variants) v.preview = `previews/${v.key}.png`;
if (templates.length !== meta.templateCount) fail(`got ${templates.length} templates, meta says ${meta.templateCount} — a part is missing`);
const variants = templates.reduce((n, t) => n + t.variants.length, 0);
if (variants !== meta.componentCount) fail(`templates hold ${variants} components, meta says ${meta.componentCount}`);

const summary = { byType: {}, byFormat: {} };
for (const t of templates) {
  const s = summary.byType[t.type] = summary.byType[t.type] || { layouts: 0, components: 0, slots: 0 };
  s.layouts += 1; s.components += t.variants.length; s.slots += t.slots.length;
  summary.byFormat[t.format] = (summary.byFormat[t.format] || 0) + t.variants.length;
}

const now = execSync('date +"%Y-%m-%dT%H:%M:%S%z"').toString().trim().replace(/(\d{2})(\d{2})$/, '$1:$2');
const manifest = {
  $schema: './manifest.schema.json',
  version: 1,
  generatedAt: now,
  ...(generatedBy ? { generatedBy } : {}),
  fileKey: config.fileKey,
  templatesPage: config.pages.templates,
  scanArgs: config.scan,
  hash: meta.hash,
  lookHash: meta.lookHash,
  scannerVersion: meta.scannerVersion ?? 1,
  componentCount: meta.componentCount,
  templateCount: meta.templateCount,
  fontWidthRatios: meta.fontWidthRatios,
  summary,
  templates,
  palettes: meta.palettes,
  colorsByType: meta.colorsByType,
  irregularities: meta.irregularities,
};
writeFileSync(join(root, 'templates', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json: ${meta.componentCount} components, ${templates.length} layouts, hash ${meta.hash}`);
