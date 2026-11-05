// build-run.js — create or update one run's Section on the Generated page. Run via use_figma.
// Before sending, replace the whole ARGS declaration below (from its first line up to its closing `};`) with the build spec
// (see .claude/skills/new-post/steps/build.md → "2. Build spec", at the repository root).
// Re-runnable: slides are replaced by name, and the summary card is re-rendered when `card` is given.
// Slides are component instances with overrides only; nothing is detached and template styling is never changed.
const ARGS = {
  generatedPage: 'Generated',
  layout: { runOrder: 'append', sectionGap: 200, sectionPadding: 80, slideGap: 40, labelGap: 16, summaryCardWidth: 600 },
  exportSettings: { format: 'PNG', width: 1080 },
  tokens: { bg: 'surface/dark', text: 'text/on-dark', muted: 'text/inverse-muted', heading: 'text/highlight', warn: 'color/pink/300', label: 'text/secondary', section: 'surface/card' },
  font: 'DM Sans',
  sectionId: null,
  sectionName: 'BG-YYYYMMDD-HHMM-handle · Format · Title',
  card: null,          // { title, subtitle, blocks: [{ heading, lines: [], tone: 'warn' | undefined }], runData: '<json>' }
  slides: [],          // [{ index, name, label, component: { key, nodeId, name }, texts: [{ path, value, accent }], hide: [path], images: [{ path, imageHash }], ratings: [{ path, stars }] }]
  removeSlides: [],    // slide names to delete (edit-run)
};

const page = figma.root.children.find(p => p.name === ARGS.generatedPage);
if (!page) throw new Error(`Page "${ARGS.generatedPage}" not found`);
await figma.setCurrentPageAsync(page);

const L = ARGS.layout;
const errors = [];
const SOFT = String.fromCharCode(0x2028);
const SOFT_BREAKS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029, 0x85) + ']', 'g');
const safe = o => JSON.parse(JSON.stringify(o).replace(SOFT_BREAKS, '\\n'));

// ---- tokens & fonts -----------------------------------------------------
const colorVars = await figma.variables.getLocalVariablesAsync('COLOR');
const FALLBACK = { bg: { r: 0.1, g: 0.11, b: 0.125 }, text: { r: 0.97, g: 0.96, b: 0.965 }, muted: { r: 0.8, g: 0.8, b: 0.82 }, heading: { r: 0.65, g: 0.48, b: 0.99 }, warn: { r: 1, g: 0.61, b: 0.7 }, label: { r: 0.44, g: 0.44, b: 0.52 }, section: { r: 0.97, g: 0.96, b: 0.965 } };
function paint(role) {
  const v = colorVars.find(x => x.name === ARGS.tokens[role]);
  const p = { type: 'SOLID', color: FALLBACK[role] };
  return v ? figma.variables.setBoundVariableForPaint(p, 'color', v) : p;
}
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }); // createText() starts in Inter
for (const style of ['Regular', 'Medium', 'Bold']) await figma.loadFontAsync({ family: ARGS.font, style });

function text(chars, { size = 16, style = 'Regular', role = 'text', upper = false, spacing = 0 } = {}) {
  const t = figma.createText();
  t.fontName = { family: ARGS.font, style };
  t.fontSize = size;
  t.lineHeight = { unit: 'PERCENT', value: 140 };
  if (spacing) t.letterSpacing = { unit: 'PERCENT', value: spacing };
  if (upper) t.textCase = 'UPPER';
  t.characters = chars;
  t.fills = [paint(role)];
  return t;
}
function addFill(parent, node) { parent.appendChild(node); node.layoutSizingHorizontal = 'FILL'; if (node.type === 'TEXT') node.textAutoResize = 'HEIGHT'; return node; }

// ---- section ------------------------------------------------------------
let section = ARGS.sectionId ? await figma.getNodeByIdAsync(ARGS.sectionId) : null;
const isNew = !section;
if (isNew) { section = figma.createSection(); }
section.name = ARGS.sectionName;
section.fills = [paint('section')];

// ---- summary card ---------------------------------------------------------
let card = section.children.find(n => n.name === 'summary-card') || null;
if (ARGS.card) {
  if (card) card.remove();
  card = figma.createAutoLayout('VERTICAL', { name: 'summary-card', itemSpacing: 24 });
  section.appendChild(card);
  card.set({ paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40, cornerRadius: 24, fills: [paint('bg')] });
  card.resize(L.summaryCardWidth, 100);
  card.counterAxisSizingMode = 'FIXED';
  card.primaryAxisSizingMode = 'AUTO';
  const head = addFill(card, figma.createAutoLayout('VERTICAL', { name: 'header', itemSpacing: 8, fills: [] }));
  addFill(head, text(ARGS.card.title, { size: 28, style: 'Bold' }));
  if (ARGS.card.subtitle) addFill(head, text(ARGS.card.subtitle, { size: 18, style: 'Medium', role: 'muted' }));
  for (const b of ARGS.card.blocks) {
    const block = addFill(card, figma.createAutoLayout('VERTICAL', { name: `block/${b.heading}`, itemSpacing: 8, fills: [] }));
    addFill(block, text(b.heading, { size: 13, style: 'Bold', role: b.tone === 'warn' ? 'warn' : 'heading', upper: true, spacing: 8 }));
    for (const line of b.lines) addFill(block, text(line, { size: 16, role: b.tone === 'warn' ? 'warn' : 'text' }));
  }
  if (ARGS.card.runData) {
    // Machine-readable copy of the run so /edit-run works without the local runs/ file.
    const data = addFill(card, text(ARGS.card.runData, { size: 8, role: 'muted' }));
    data.name = 'run-data';
    data.visible = false;
  }
}

// ---- slides ---------------------------------------------------------------
function resolve(root, path) {
  if (!path) return root; // "" = the slide itself (optional background slot)
  let n = root;
  for (const seg of path.split(' > ')) {
    const m = /^(.*)\[(\d+)\]$/.exec(seg);
    const name = m ? m[1] : seg;
    const kids = 'children' in n ? n.children.filter(c => c.name === name) : [];
    n = kids[m ? +m[2] : 0];
    if (!n) return null;
  }
  return n;
}
async function loadFonts(t) {
  const fonts = t.characters.length ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName];
  for (const f of fonts) await figma.loadFontAsync(f);
}
async function writeText(t, value, accent) {
  await loadFonts(t);
  const len = t.characters.length;
  const mixed = len > 1 && t.getRangeAllFontNames(0, len).length > 1;
  if (accent == null || !mixed) { t.characters = accent == null ? value : `${value} ${accent}`; return; }
  // One node holding "regular + italic accent": copy the last segment's style onto the accent range.
  const segs = t.getStyledTextSegments(['fontName', 'fills', 'fontSize', 'letterSpacing', 'textCase', 'textDecoration']);
  const last = segs[segs.length - 1]; // the returned array is frozen: no pop()
  const sep = t.characters.includes(SOFT) ? SOFT : '\n';
  t.characters = `${value}${sep}${accent}`;
  const s = value.length + sep.length, e = t.characters.length;
  t.setRangeFontName(s, e, last.fontName);
  t.setRangeFills(s, e, last.fills);
  t.setRangeFontSize(s, e, last.fontSize);
  t.setRangeLetterSpacing(s, e, last.letterSpacing);
  t.setRangeTextCase(s, e, last.textCase);
  t.setRangeTextDecoration(s, e, last.textDecoration);
}
const imageHashes = n => (Array.isArray(n.fills) ? n.fills.filter(f => f.type === 'IMAGE' && f.imageHash).map(f => f.imageHash) : []);
// Some templates stack several placeholder images in one layer: the photo replaces the top one (keeping its
// filters, e.g. grayscale) and the others are dropped so nothing of the placeholder shows through.
function setImage(node, imageHash) {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  const imgs = fills.map((f, i) => (f.type === 'IMAGE' ? i : -1)).filter(i => i >= 0);
  const img = { type: 'IMAGE', imageHash, scaleMode: 'FILL' };
  if (!imgs.length) { node.fills = [...fills, img]; return; }
  const top = imgs[imgs.length - 1], old = fills[top];
  for (const k of ['opacity', 'visible', 'blendMode', 'filters']) if (old[k] !== undefined) img[k] = old[k];
  node.fills = fills.filter((f, i) => f.type !== 'IMAGE' || i === top).map((f, i, a) => (f === old ? img : f));
}
async function getComponent(c) {
  if (c.nodeId) {
    const n = await figma.getNodeByIdAsync(c.nodeId);
    if (n && n.type === 'COMPONENT' && (n.key === c.key || n.name === c.name)) return { comp: n, keyMismatch: n.key !== c.key };
  }
  try { return { comp: await figma.importComponentByKeyAsync(c.key), keyMismatch: false }; } catch (e) { return null; }
}

for (const name of [...ARGS.removeSlides, ...ARGS.slides.map(s => s.name)]) {
  for (const n of section.children.filter(n => n.name === name || n.name === `label/${name}`)) n.remove();
}

const built = [];
for (const s of ARGS.slides) {
  const got = await getComponent(s.component);
  if (!got) { errors.push({ slide: s.index, error: `Template "${s.component.name}" not found — run /sync-templates` }); continue; }
  const inst = got.comp.createInstance();
  section.appendChild(inst);
  inst.name = s.name;
  const miss = p => errors.push({ slide: s.index, path: p, error: 'slot not found in instance' });
  for (const p of s.hide || []) { const n = resolve(inst, p); n ? (n.visible = false) : miss(p); }
  const propValues = {};
  for (const t of s.texts || []) {
    const n = resolve(inst, t.path);
    if (!n || n.type !== 'TEXT') { miss(t.path); continue; }
    // Layers bound to one text property can't hold different texts: setting one would overwrite the other.
    const prop = n.componentPropertyReferences && n.componentPropertyReferences.characters;
    if (prop && prop in propValues && propValues[prop] !== t.value) { errors.push({ slide: s.index, path: t.path, error: 'shares a text property with another field in this template, so it cannot show different text — pick another layout or fix the template' }); continue; }
    if (prop) propValues[prop] = t.value;
    n.visible = true;
    await writeText(n, t.value, t.accent);
  }
  // The same placeholder photo is sometimes repeated outside its slot (e.g. a story's background):
  // replace it there too, except in other photo slots.
  const slotIds = new Set((s.images || []).map(im => resolve(inst, im.path)).filter(Boolean).map(n => n.id)); // ids: the API returns a new wrapper per lookup
  const fillNodes = [inst, ...inst.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'POLYGON', 'STAR'] })];
  for (const im of s.images || []) {
    const n = resolve(inst, im.path);
    if (!n) { miss(im.path); continue; }
    const m = resolve(got.comp, im.path);
    const placeholder = new Set(m ? imageHashes(m) : imageHashes(n));
    setImage(n, im.imageHash);
    for (const o of fillNodes) if (!slotIds.has(o.id) && imageHashes(o).some(h => placeholder.has(h))) setImage(o, im.imageHash);
  }
  for (const r of s.ratings || []) {
    const n = resolve(inst, r.path);
    if (!n) { miss(r.path); continue; }
    n.children.filter(k => k.name === 'star').forEach((k, i) => { k.visible = i < r.stars; });
  }
  inst.exportSettings = [{ format: ARGS.exportSettings.format, suffix: '', constraint: { type: 'WIDTH', value: ARGS.exportSettings.width } }];
  const label = text(s.label, { size: 20, style: 'Medium', role: 'label' });
  label.name = `label/${s.name}`;
  section.appendChild(label);
  built.push({ index: s.index, name: s.name, nodeId: inst.id, labelId: label.id, keyMismatch: got.keyMismatch || undefined });
}

// ---- layout: card, then slides left → right with labels underneath -------
const pad = L.sectionPadding;
let x = pad, bottom = pad;
if (card) { card.x = pad; card.y = pad; x += card.width + L.slideGap; bottom = Math.max(bottom, pad + card.height); }
const slides = section.children.filter(n => n.type === 'INSTANCE').sort((a, b) => a.name.localeCompare(b.name));
for (const inst of slides) {
  inst.x = x; inst.y = pad;
  const label = section.children.find(n => n.name === `label/${inst.name}`);
  if (label) { label.x = x; label.y = pad + inst.height + L.labelGap; bottom = Math.max(bottom, label.y + label.height); }
  bottom = Math.max(bottom, pad + inst.height);
  x += inst.width + L.slideGap;
}
section.resizeWithoutConstraints(x - L.slideGap + pad, bottom + pad);
// Keep the layers panel in slide order too (replaced slides would otherwise end up last).
[card, ...slides.flatMap(i => [i, section.children.find(n => n.name === `label/${i.name}`)])].filter(Boolean).forEach((n, i) => section.insertChild(i, n));

// ---- placement (same call as creation, so two operators can't collide) ---
if (isNew) {
  // Measure against every top-level node, so loose layers on the page are never overlapped.
  const others = page.children.filter(n => n.id !== section.id);
  section.x = others.length ? Math.min(...others.map(n => n.x)) : 0;
  if (!others.length) section.y = 0;
  else if (L.runOrder === 'prepend') section.y = Math.min(...others.map(n => n.y)) - L.sectionGap - section.height;
  else section.y = Math.max(...others.map(n => n.y + n.height)) + L.sectionGap;
}

return safe({ sectionId: section.id, sectionName: section.name, cardId: card ? card.id : null, slides: built, errors, size: { w: section.width, h: section.height } });
