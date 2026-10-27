// scan-hash.js — read-only, light preflight check for /new-post: { hash, lookHash, scannerVersion, componentCount, pages }.
// Computes exactly the same hash and lookHash as scan-templates.js (mode 'hash') without measuring text, so it is ~3× smaller.
// Keep classify/walk/assignIds/background rules and look() in step with scan-templates.js: if the two ever disagree,
// /new-post sees a hash mismatch right after a fresh sync — the skill treats that as "scan-hash.js is out of date".
const ARGS = { templatesPage: 'Templates', ignoreMarker: '(CLAUDE - IGNORE)', decorContainers: ['mockup', 'photoshop', 'decor', 'bg', 'card-bg'] };
const SCANNER_VERSION = 5;
const IMAGE_ROLES = ['photo', 'avatar'];
const page = figma.root.children.find(p => p.name === ARGS.templatesPage);
if (!page) throw new Error(`Page "${ARGS.templatesPage}" not found`);
await figma.setCurrentPageAsync(page);
const isIgnored = n => { for (let p = n; p && p.type !== 'PAGE'; p = p.parent) if (p.name.includes(ARGS.ignoreMarker)) return true; return false; };
const hasImageFill = n => 'fills' in n && Array.isArray(n.fills) && n.fills.some(f => f.type === 'IMAGE' && f.visible !== false);
const parseRole = name => { const m = /^(.+?)(?:-(\d+))?(-accent)?$/.exec(name); return { base: m[1], accent: !!m[3] }; };
const comps = page.findAllWithCriteria({ types: ['COMPONENT'] }).filter(c => !isIgnored(c) && c.parent.type !== 'COMPONENT_SET');

function classify(node, parent, path, dupIndex, ctx) {
  if (node.type === 'TEXT') return { path, kind: 'text', name: node.name === 'title' && parent.name === 'title' && dupIndex > 0 ? 'title-accent' : node.name };
  if (IMAGE_ROLES.includes(parseRole(node.name).base)) {
    if (hasImageFill(node)) ctx.slotImages.push(...node.fills.filter(f => f.type === 'IMAGE').map(f => f.imageHash));
    return { path, kind: 'image', name: node.name };
  }
  if (node.name === 'rating') return { path, kind: 'rating', name: 'rating' };
  return null;
}
function walk(node, chain, out, ctx) {
  if (!('children' in node)) return;
  const counts = {}; for (const k of node.children) counts[k.name] = (counts[k.name] || 0) + 1;
  const seen = {};
  for (const k of node.children) {
    if (ARGS.decorContainers.includes(k.name)) continue;
    const dup = counts[k.name] > 1 ? (seen[k.name] = (seen[k.name] ?? -1) + 1) : 0;
    const ch = chain.concat(counts[k.name] > 1 ? `${k.name}[${dup}]` : k.name);
    const slot = classify(k, node, ch.join(' > '), dup, ctx);
    if (slot) out.push(slot);
    if (k.type === 'INSTANCE' || !slot || slot.kind !== 'rating') walk(k, ch, out, ctx);
  }
}
function assignIds(slots) {
  const byName = {};
  for (const s of slots) (byName[s.name] = byName[s.name] || []).push(s);
  for (const name in byName) {
    const g = byName[name];
    if (g.length === 1) { g[0].id = name; continue; }
    const segs = g.map(s => s.path.split(' > '));
    g.forEach((s, k) => {
      const mine = segs[k];
      const block = mine.slice(0, -1).find((p, i) => /-\d+$/.test(p) && segs.every((o, j) => j === k || o[i] !== p));
      s.id = block ? `${block}.${name}` : `${name}[${k}]`;
    });
  }
  const ids = new Set();
  slots.forEach((s, k) => { if (ids.has(s.id)) s.id = `${s.name}#${k}`; ids.add(s.id); });
}
function fnv(str, seed) { let h = seed >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); }
const digest = s => fnv(s, 2166136261) + fnv(s, 0x9747b28c);
// Same as scan-templates.js. Visual fingerprint of one component (geometry, fills, strokes, text, effects of every visible layer, decor
// included): it changes whenever the rendered template changes, so /sync-templates knows which preview to re-export.
const fp = v => (v === figma.mixed ? 'mixed' : Array.isArray(v) ? v.filter(p => p.visible !== false).map(p => [p.type, p.color ? ['r', 'g', 'b'].map(k => Math.round(p.color[k] * 255)).join('.') : '', p.opacity == null ? 1 : Math.round(p.opacity * 100) / 100, p.imageHash || '', p.scaleMode || '', p.gradientStops ? p.gradientStops.length : ''].join(':')).join('|') : '');
function look(c) {
  const parts = [];
  const visit = (n, depth) => {
    if (!n.visible) return;
    const b = [n.type, n.name, Math.round(n.x), Math.round(n.y), Math.round(n.width), Math.round(n.height), 'opacity' in n ? Math.round(n.opacity * 100) : '', 'fills' in n ? fp(n.fills) : '', 'strokes' in n ? fp(n.strokes) + ('strokeWeight' in n && n.strokeWeight !== figma.mixed ? n.strokeWeight : '') : '', 'cornerRadius' in n && n.cornerRadius !== figma.mixed ? n.cornerRadius : '', 'effects' in n ? n.effects.filter(e => e.visible).length : ''];
    if (n.type === 'TEXT') b.push(n.characters.slice(0, 64), n.fontName === figma.mixed ? 'mixed' : `${n.fontName.family}/${n.fontName.style}`, n.fontSize === figma.mixed ? 'mixed' : n.fontSize);
    parts.push(depth + '>' + b.join(','));
    if ('children' in n) for (const k of n.children) visit(k, depth + 1);
  };
  visit(c, 0);
  return digest(parts.join('\n'));
}
const sigLines = comps.map(c => {
  const ctx = { slotImages: [] };
  const slots = [];
  walk(c, [], slots, ctx);
  assignIds(slots);
  if (hasImageFill(c) && !c.fills.filter(f => f.type === 'IMAGE' && f.visible !== false).every(f => ctx.slotImages.includes(f.imageHash))) slots.unshift({ path: '', id: 'background' });
  return `${c.name}::${slots.map(s => `${s.id}@${s.path}`).join(',')}`;
});
const s = sigLines.sort().join('\n');
const lookHash = digest(comps.map(c => `${c.key}:${look(c)}`).sort().join('\n'));
return { hash: digest(s), lookHash, scannerVersion: SCANNER_VERSION, componentCount: comps.length, pages: figma.root.children.map(p => ({ id: p.id, name: p.name })) };
