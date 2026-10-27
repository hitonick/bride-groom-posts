// scan-templates.js — read-only scan of the Templates page. Run via use_figma.
// Before sending, replace the ARGS line with values from config.json (`pages.templates`, `scan.*`) and the mode:
//   mode: 'hash'      → { hash, scannerVersion, componentCount, pages } for the /new-post preflight (drift check + page check)
//   mode: 'meta'      → hash, lookHash, palettes, colorsByType, irregularities, templateCount
//   mode: 'templates' → one page of template entries (offset/limit; 10 per call stays under the 48 KB return cap)
//   mode: 'digest'    → fingerprints per template entry, to find what changed without fetching everything
// Slots are addressed by layer-name path ("content > photos > photo[1]"); "[k]" disambiguates same-name siblings.
// Never mutates the file.
const ARGS = { templatesPage: 'Templates', ignoreMarker: '(CLAUDE - IGNORE)', decorContainers: ['mockup', 'photoshop', 'decor', 'bg', 'card-bg'], colorTokens: ['Purple', 'Light Purple', 'Pink', 'Light Pink', 'Blue', 'Light Blue', 'Yellow', 'Light Yellow', 'Dark', 'Light', 'Light Color'], mode: 'meta', offset: 0, limit: 16 };

// Bump when the scan output gains or changes fields: /new-post re-syncs manifests built by an older scanner.
const SCANNER_VERSION = 5;
const TEXT_ROLES = ['tagline', 'title', 'body', 'quote-text', 'author-name', 'author-handle', 'author-role', 'source-label', 'tag-label', 'page-number', 'paragraph', 'bullet', 'button-label'];
const IMAGE_ROLES = ['photo', 'avatar'];
const AUTO_ROLES = ['page-number', 'tag-label'];

const page = figma.root.children.find(p => p.name === ARGS.templatesPage);
if (!page) throw new Error(`Page "${ARGS.templatesPage}" not found`);
await figma.setCurrentPageAsync(page);

const irregular = new Map();
const flag = (issue, who, proposal) => { const e = irregular.get(issue) || { issue, proposal: proposal || null, components: [] }; if (who && !e.components.includes(who)) e.components.push(who); irregular.set(issue, e); };

const isIgnored = n => { for (let p = n; p && p.type !== 'PAGE'; p = p.parent) if (p.name.includes(ARGS.ignoreMarker)) return true; return false; };
const sectionOf = n => { for (let p = n.parent; p && p.type !== 'PAGE'; p = p.parent) if (p.type === 'SECTION') return p.name; return null; };
const hasImageFill = n => 'fills' in n && Array.isArray(n.fills) && n.fills.some(f => f.type === 'IMAGE' && f.visible !== false);
const r1 = v => Math.round(v * 10) / 10;
// Figma stores soft line breaks as U+2028; the MCP transport splits on it, so normalize to \n everywhere.
const SOFT_BREAKS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029, 0x85) + ']', 'g');
const softBreaks = s => s.replace(SOFT_BREAKS, '\n');
const safe = o => JSON.parse(softBreaks(JSON.stringify(o)).replace(/\n/g, '\\n'));
// "paragraph-2-accent" → { base: 'paragraph', accent: true }
const parseRole = name => { const m = /^(.+?)(?:-(\d+))?(-accent)?$/.exec(name); return { base: m[1], accent: !!m[3] }; };

const comps = [];
for (const c of page.findAllWithCriteria({ types: ['COMPONENT'] })) {
  if (isIgnored(c)) continue;
  if (c.parent.type === 'COMPONENT_SET') { flag('Variant inside a component set (expected standalone components) — skipped', c.name); continue; }
  comps.push(c);
}

// ---- name parsing -------------------------------------------------------
// A third segment is a color if it is a known token or shows up under ≥2 different layouts; otherwise it is a sub-layout.
const seg = c => c.name.split('/').map(s => s.trim());
const thirdSeen = {};
for (const c of comps) { const p = seg(c); if (p.length >= 3) (thirdSeen[p[2]] = thirdSeen[p[2]] || new Set()).add(`${p[0]}/${p[1]}`); }
const isColor = s => ARGS.colorTokens.includes(s) || (thirdSeen[s] && thirdSeen[s].size >= 2);

// ---- text metrics -------------------------------------------------------
function textMetrics(n) {
  const len = n.characters.length;
  const fonts = len ? n.getRangeAllFontNames(0, len).map(f => `${f.family}/${f.style}`) : [`${n.fontName.family}/${n.fontName.style}`];
  let fs = n.fontSize, lh = n.lineHeight;
  if (fs === figma.mixed || lh === figma.mixed) {
    const big = n.getStyledTextSegments(['fontSize', 'lineHeight']).reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
    fs = big.fontSize; lh = big.lineHeight;
  }
  const lhPx = lh.unit === 'PIXELS' ? lh.value : lh.unit === 'PERCENT' ? fs * lh.value / 100 : fs * 1.2;
  const out = { fonts: [...new Set(fonts)], size: fs, lineHeight: r1(lhPx) };
  if (n.fontSize === figma.mixed) out.mixedSize = true;
  if (n.textCase !== 'ORIGINAL') out.textCase = n.textCase === figma.mixed ? 'MIXED' : n.textCase;
  return out;
}

// Average glyph width (in ems) per font, measured from single-line hugging texts in this file.
const ratioAcc = {};
for (const c of comps) for (const t of c.findAllWithCriteria({ types: ['TEXT'] })) {
  if (t.textAutoResize !== 'WIDTH_AND_HEIGHT' || t.fontSize === figma.mixed || t.fontName === figma.mixed || t.characters.includes('\n') || t.characters.length < 6) continue;
  const key = `${t.fontName.family}/${t.fontName.style}`;
  (ratioAcc[key] = ratioAcc[key] || []).push(t.width / (t.characters.length * t.fontSize));
}
const ratios = {};
for (const k in ratioAcc) ratios[k] = Math.round(ratioAcc[k].reduce((a, b) => a + b, 0) / ratioAcc[k].length * 1000) / 1000;
const rv = Object.values(ratios);
const globalRatio = rv.length ? rv.reduce((a, b) => a + b, 0) / rv.length : 0.5;

function availableWidth(n) {
  const p = n.parent;
  if (p && 'layoutMode' in p && p.layoutMode !== 'NONE') {
    const inner = p.width - (p.paddingLeft || 0) - (p.paddingRight || 0);
    if (p.layoutMode === 'VERTICAL') return inner;
    const sibs = p.children.filter(s => s !== n && s.visible);
    return inner - sibs.reduce((a, s) => a + s.width, 0) - p.itemSpacing * sibs.length;
  }
  return n.width;
}

// ---- slot discovery -----------------------------------------------------
function classify(node, parent, path, dupIndex, ctx) {
  const base = { path };
  if (!node.visible) base.hidden = true;
  if (ctx.inInstance) base.inNestedInstance = true;
  if (node.type === 'TEXT') {
    let name = node.name;
    if (name === 'title' && parent.name === 'title' && dupIndex > 0) {
      name = 'title-accent';
      flag('Two text layers named "title" inside the "title" frame; the second is treated as "title-accent" by position', ctx.name, 'Rename the second "title" text layer to "title-accent"');
    }
    const { base: b, accent } = parseRole(name);
    const known = TEXT_ROLES.includes(b);
    if (!known) flag(`Text layer "${node.name}" outside decor containers is not in the slot vocabulary (kept as fixed text)`, ctx.name, 'Rename to a slot role, or move it into a decor container');
    const m = textMetrics(node);
    if (m.fonts.length > 1) flag(`Text layer "${node.name}" mixes fonts in one node (${m.fonts.join(' + ')}); build must re-apply the accent font to the last line`, ctx.name, 'Split the accent into its own "-accent" text layer');
    const charW = (ratios[m.fonts[0]] || globalRatio) * m.size;
    const hug = node.textAutoResize === 'WIDTH_AND_HEIGHT';
    const chars = softBreaks(node.characters);
    const lines = hug ? chars.split('\n').length : Math.max(1, Math.round(node.height / m.lineHeight));
    const w = hug ? Math.max(node.width, availableWidth(node)) : node.width;
    // The placeholder fits by design, so it is a lower bound for both estimates.
    const longest = Math.max(...chars.split('\n').map(l => Array.from(l).length));
    const charsPerLine = Math.max(1, Math.floor(w / charW), hug ? longest : 0);
    const prop = node.componentPropertyReferences && node.componentPropertyReferences.characters;
    if (prop) base._prop = prop;
    return Object.assign(base, {
      name, kind: 'text', role: known ? b + (accent ? '-accent' : '') : 'fixed',
      auto: AUTO_ROLES.includes(b) || undefined,
      defaultText: Array.from(chars).slice(0, 48).join(''), defaultLength: Array.from(chars).length,
      font: m, autoResize: node.textAutoResize,
      box: { w: r1(node.width), h: r1(node.height), availW: r1(w) },
      lines, charsPerLine, capacity: Math.max(Math.floor(charsPerLine * lines * 0.9), Array.from(chars).length),
      // Bullets/numbers come from the template's list style; the operator must not type them.
      list: (node.getStyledTextSegments(['listOptions']).map(x => x.listOptions.type).find(t => t !== 'NONE')) || undefined,
    });
  }
  const { base: ib } = parseRole(node.name);
  if (IMAGE_ROLES.includes(ib)) {
    if (!hasImageFill(node)) flag(`Image slot "${node.name}" has no image fill`, ctx.name, 'Give it a placeholder image fill');
    const img = hasImageFill(node) ? node.fills.find(f => f.type === 'IMAGE') : null;
    // The template's image filter is kept on build; grayscale is worth telling the operator about.
    const imageFilter = img && img.filters && img.filters.saturation <= -0.99 ? 'grayscale' : undefined;
    ctx.slotImages.push(...(hasImageFill(node) ? node.fills.filter(f => f.type === 'IMAGE').map(f => f.imageHash) : []));
    return Object.assign(base, { name: node.name, kind: 'image', role: ib, shape: node.type, box: { w: r1(node.width), h: r1(node.height) }, aspect: Math.round(node.width / node.height * 100) / 100, scaleMode: img ? img.scaleMode : null, imageFilter });
  }
  if (hasImageFill(node)) flag(`Image fill on "${node.name}" outside decor containers (kept as fixed artwork)`, ctx.name, 'Rename to "photo"/"avatar" if it should be replaceable');
  if (node.name === 'rating') {
    const stars = 'children' in node ? node.children.filter(s => s.name === 'star').length : 0;
    return Object.assign(base, { name: 'rating', kind: 'rating', role: 'rating', stars });
  }
  return null;
}

function walk(node, chain, out, ctx) {
  if (!('children' in node)) return;
  const counts = {}; for (const k of node.children) counts[k.name] = (counts[k.name] || 0) + 1;
  const seen = {};
  for (const k of node.children) {
    if (ARGS.decorContainers.includes(k.name)) { ctx.decor.add(k.name); continue; }
    const dup = counts[k.name] > 1 ? (seen[k.name] = (seen[k.name] ?? -1) + 1) : 0;
    const ch = chain.concat(counts[k.name] > 1 ? `${k.name}[${dup}]` : k.name);
    const slot = classify(k, node, ch.join(' > '), dup, ctx);
    if (slot) out.push(slot);
    if (k.type === 'INSTANCE') { ctx.nested.add(k.name); walk(k, ch, out, Object.assign({}, ctx, { inInstance: true })); }
    else if (!slot || slot.kind !== 'rating') walk(k, ch, out, ctx);
  }
}

// Slot ids: the (normalized) layer name; duplicates get "<numbered block>.<name>" (quote-1.quote-text) or "<name>[k]" in reading order.
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
  for (const s of slots) delete s.name;
}

// ---- hashing (FNV-1a, two seeds → 16 hex chars) -------------------------
function fnv(str, seed) { let h = seed >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); }
const digest = s => fnv(s, 2166136261) + fnv(s, 0x9747b28c);
// Visual fingerprint of one component (geometry, fills, strokes, text, effects of every visible layer, decor
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

// ---- main ---------------------------------------------------------------
const items = [];
const sigLines = [];
const nameCount = {};
for (const c of comps) {
  const nm = c.name;
  nameCount[nm] = (nameCount[nm] || 0) + 1;
  if (nm !== nm.trim() || /\s{2,}/.test(nm)) flag('Extra whitespace in component name', nm, 'Trim / collapse spaces');
  const parts = seg(c);
  if (nm.split(' / ').length !== parts.length) flag('Inconsistent " / " separator in component name', nm, `Rename to "${parts.join(' / ')}"`);
  let [type, layout = '(none)', ...rest] = parts;
  let color = 'Default';
  if (rest.length) {
    const last = rest[rest.length - 1];
    if (isColor(last)) { color = last; rest = rest.slice(0, -1); }
    if (rest.length) { layout = [layout, ...rest].join(' / '); flag(`Third name segment "${rest.join(' / ')}" is a sub-layout, not a color; parsed as layout "${layout}", color "${color}"`, nm, `Rename to "${type} / ${layout}${color === 'Default' ? '' : ' / ' + color}" or move the variant into the layout segment`); }
  } else flag('Name has only Type / Layout; color treated as "Default"', nm, null);
  const format = c.height / c.width > 1.5 ? 'story' : 'feed';
  const ctx = { name: nm, decor: new Set(), nested: new Set(), inInstance: false, slotImages: [] };
  const slots = [];
  walk(c, [], slots, ctx);
  assignIds(slots);
  // Two text slots bound to one text property always show the same text (setting one sets both).
  const byProp = {};
  for (const s of slots) if (s._prop) (byProp[s._prop] = byProp[s._prop] || []).push(s);
  for (const g of Object.values(byProp)) if (g.length > 1) {
    for (const s of g) s.sharedWith = g.filter(o => o !== s).map(o => o.id);
    flag(`Text layers ${g.map(s => `"${s.id}"`).join(' and ')} are bound to the same text property, so they always show the same text`, nm, 'Give each layer its own text property (or unbind the accent layer)');
  }
  for (const s of slots) delete s._prop;
  // A photo on the component itself: if it repeats a photo slot's placeholder, the build replaces it together
  // with that slot; otherwise it becomes an optional "background" slot (path "" = the slide itself).
  if (hasImageFill(c)) {
    const rootImages = c.fills.filter(f => f.type === 'IMAGE' && f.visible !== false);
    if (rootImages.every(f => ctx.slotImages.includes(f.imageHash))) {
      flag('Slide background repeats the photo slot\'s placeholder image; it is replaced together with the photo', nm, null);
    } else {
      const top = rootImages[rootImages.length - 1];
      slots.unshift({ path: '', id: 'background', kind: 'image', role: 'background', optional: true, shape: c.type, box: { w: r1(c.width), h: r1(c.height) }, aspect: Math.round(c.width / c.height * 100) / 100, scaleMode: top.scaleMode, imageFilter: top.filters && top.filters.saturation <= -0.99 ? 'grayscale' : undefined });
      flag('Slide background is a template photo with no photo slot; exposed as the optional "background" image slot (operators may keep it)', nm, null);
    }
  }
  for (const s of slots) if (s.kind === 'text' && /\[\d+\]$/.test(s.id)) flag(`Repeated text layer name "${s.id.replace(/\[\d+\]$/, '')}"; addressed by position as ${s.id}`, nm, 'Give each text layer a distinct role name (e.g. "-accent" for the highlighted part)');
  sigLines.push(`${nm}::${slots.map(s => `${s.id}@${s.path}`).join(',')}`);
  items.push({ c, type, layout, color, format, slots, decor: [...ctx.decor], nested: [...ctx.nested] });
}
for (const n in nameCount) if (nameCount[n] > 1) flag(`Duplicate component name (${nameCount[n]}×)`, n, 'Make names unique');

const hash = digest(sigLines.sort().join('\n'));
// One fingerprint for the look of every template: the /new-post preflight compares it to spot stale previews.
const lookHash = digest(comps.map(c => `${c.key}:${look(c)}`).sort().join('\n'));
// Preflight uses this mode: the page list lets it check Media/Generated exist (and get their ids) in the same call.
if (ARGS.mode === 'hash') return { hash, lookHash, scannerVersion: SCANNER_VERSION, componentCount: comps.length, pages: figma.root.children.map(p => ({ id: p.id, name: p.name })) };

// One template entry per Type / Layout + slot structure; colors become variants.
const groups = new Map();
for (const it of items) {
  const g = `${it.type} / ${it.layout}`;
  const key = `${g}||${Math.round(it.c.width)}x${Math.round(it.c.height)}||${it.slots.map(s => `${s.id}:${s.kind}:${s.path}`).join(',')}`;
  if (!groups.has(key)) groups.set(key, { group: g, type: it.type, layout: it.layout, format: it.format, section: sectionOf(it.c), width: r1(it.c.width), height: r1(it.c.height), decor: it.decor.length ? it.decor : undefined, nestedInstances: it.nested.length ? it.nested : undefined, slots: it.slots, variants: [] });
  // Image filters differ between colors of one layout (e.g. Light/Dark grayscale, Light Color in color), so they live on the variant.
  const grayscale = it.slots.filter(s => s.imageFilter === 'grayscale').map(s => s.id);
  groups.get(key).variants.push({ color: it.color, name: it.c.name, key: it.c.key, nodeId: it.c.id, section: sectionOf(it.c), grayscale: grayscale.length ? grayscale : undefined, look: look(it.c) });
}
for (const g of groups.values()) for (const s of g.slots) delete s.imageFilter;
const templates = [...groups.values()];
const perGroup = {};
for (const t of templates) perGroup[t.group] = (perGroup[t.group] || 0) + 1;
for (const t of templates) {
  if (perGroup[t.group] > 1) { t.structureVariant = true; flag(`Colors of "${t.group}" differ in slot structure; listed as separate template entries`, t.variants.map(v => v.name).join(', '), 'Align slot layer names/paths across colors of this layout'); }
  for (const v of t.variants) { if (v.section !== t.section) flag(`Component sits in section "${v.section}" unlike its siblings`, v.name, null); delete v.section; }
}

const palettes = {};
for (const t of templates) { const p = palettes[t.group] = palettes[t.group] || []; for (const v of t.variants) if (!p.includes(v.color)) p.push(v.color); }
const colorsByType = {};
for (const it of items) { const m = colorsByType[it.type] = colorsByType[it.type] || {}; m[it.color] = (m[it.color] || 0) + 1; }

// use_figma returns are capped at 48 KB, so the body is fetched in parts (run them in parallel):
//   mode 'meta'      → everything except templates, plus templateCount
//   mode 'templates' → templates.slice(offset, offset + limit)
// mode 'digest': one fingerprint per template entry + one for the rest, over sorted keys. /sync-templates compares
// them with the saved manifest and only fetches the entries that changed (scripts/manifest-digest.mjs computes the local side).
const canon = v => Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(softBreaks(String(v)) === String(v) ? v : softBreaks(v));
if (ARGS.mode === 'digest') return { hash, lookHash, scannerVersion: SCANNER_VERSION, templateCount: templates.length, meta: digest(canon({ fontWidthRatios: ratios, palettes, colorsByType, irregularities: [...irregular.values()] })), templates: templates.map(t => [t.group, t.variants[0].color, digest(canon(t))]) };
if (ARGS.mode === 'templates') return safe({ hash, templateCount: templates.length, offset: ARGS.offset, templates: templates.slice(ARGS.offset, ARGS.offset + ARGS.limit) });
return safe({ hash, lookHash, scannerVersion: SCANNER_VERSION, componentCount: comps.length, templateCount: templates.length, fontWidthRatios: ratios, palettes, colorsByType, irregularities: [...irregular.values()] });
