// verify-run.js — check a built run on the Generated page. Run via use_figma. Read-only except for one auto-fix:
// missing export settings are restored. Every check compares the instance with its main component, so
// "placeholder" and "empty space" are judged against the template itself, not against fixed numbers.
// Before sending, replace the ARGS line. Per slide pass the manifest's slot data:
//   texts:  [{ path, lines, maxW, value, kept }]   maxW = manifest box.availW (width the template gives a hugging text)  every text slot of the template. value = the text the run asked for
//           (accent of a mixed-font node joined with "\n"); kept = template text kept on purpose (incl. auto tag-labels).
//           A slot with neither still showing the template text is a placeholder.
//   images: [{ path, skipped }]       skipped = operator chose "skip" (placeholder kept)
const ARGS = { generatedPage: 'Generated', sectionId: '0:0', export: { format: 'PNG', width: 1080 }, underfillMin: 16, slides: [] };

const page = figma.root.children.find(p => p.name === ARGS.generatedPage);
await figma.setCurrentPageAsync(page);
const section = await figma.getNodeByIdAsync(ARGS.sectionId);
if (!section) throw new Error(`Section ${ARGS.sectionId} not found on ${ARGS.generatedPage}`);
const SOFT_BREAKS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029, 0x85) + ']', 'g');
const r = v => Math.round(v);

function resolve(root, path) {
  if (!path) return root; // "" = the slide itself (optional background slot)
  let n = root;
  for (const seg of path.split(' > ')) {
    const m = /^(.*)\[(\d+)\]$/.exec(seg);
    const kids = 'children' in n ? n.children.filter(c => c.name === (m ? m[1] : seg)) : [];
    n = kids[m ? +m[2] : 0];
    if (!n) return null;
  }
  return n;
}
function pathOf(node, root) {
  const segs = [];
  for (let n = node; n && n !== root; n = n.parent) {
    const same = n.parent.children.filter(c => c.name === n.name);
    segs.unshift(same.length > 1 ? `${n.name}[${same.indexOf(n)}]` : n.name);
  }
  return segs.join(' > ');
}
function lineHeightPx(t) {
  const seg = t.getStyledTextSegments(['fontSize', 'lineHeight']).reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
  const lh = seg.lineHeight;
  return lh.unit === 'PIXELS' ? lh.value : lh.unit === 'PERCENT' ? seg.fontSize * lh.value / 100 : seg.fontSize * 1.2;
}
// Height the text needs at its current width (for fixed "NONE" boxes, which clip instead of growing).
async function neededHeight(t) {
  const fonts = t.getRangeAllFontNames(0, t.characters.length);
  for (const f of fonts) await figma.loadFontAsync(f);
  const p = figma.createText();
  p.fontName = fonts[0];
  p.characters = t.characters;
  for (const s of t.getStyledTextSegments(['fontName', 'fontSize', 'letterSpacing', 'lineHeight', 'textCase'])) {
    p.setRangeFontName(s.start, s.end, s.fontName);
    p.setRangeFontSize(s.start, s.end, s.fontSize);
    p.setRangeLetterSpacing(s.start, s.end, s.letterSpacing);
    p.setRangeLineHeight(s.start, s.end, s.lineHeight);
    p.setRangeTextCase(s.start, s.end, s.textCase);
  }
  p.resize(t.width, 10);
  p.textAutoResize = 'HEIGHT';
  const h = p.height;
  p.remove();
  return h;
}
// Free space along an auto-layout frame's main axis (negative = content doesn't fit).
function freeSpace(f) {
  const vert = f.layoutMode === 'VERTICAL';
  const kids = f.children.filter(c => c.visible && c.layoutPositioning !== 'ABSOLUTE');
  const size = vert ? f.height : f.width;
  const pad = vert ? f.paddingTop + f.paddingBottom : f.paddingLeft + f.paddingRight;
  const gaps = f.primaryAxisAlignItems === 'SPACE_BETWEEN' ? 0 : f.itemSpacing * Math.max(0, kids.length - 1);
  return size - pad - gaps - kids.reduce((a, c) => a + (vert ? c.height : c.width), 0);
}
const inside = (a, b) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;
const excerpt = s => { const t = s.replace(SOFT_BREAKS, ' ').replace(/\s+/g, ' '); return t.length > 40 ? t.slice(0, 37) + '…' : t; };

const results = [];
const fixed = [];
for (const s of ARGS.slides) {
  const issues = [];
  const add = (severity, kind, slot, detail) => issues.push({ severity, kind, slot, detail });
  const inst = (s.nodeId && await figma.getNodeByIdAsync(s.nodeId)) || section.children.find(n => n.name === s.name);
  if (!inst) { add('error', 'missing', null, 'slide not found in the section'); results.push({ name: s.name, issues }); continue; }
  if (inst.type !== 'INSTANCE') { add('error', 'detached', null, 'slide is no longer a template instance'); results.push({ name: s.name, issues }); continue; }
  const main = await inst.getMainComponentAsync();
  if (s.component && main.key !== s.component.key && main.name !== s.component.name) add('warn', 'template', null, `instance of "${main.name}", expected "${s.component.name}"`);

  const ex = inst.exportSettings || [];
  if (!ex.some(e => e.format === ARGS.export.format && e.constraint && e.constraint.type === 'WIDTH' && e.constraint.value === ARGS.export.width)) {
    inst.exportSettings = [{ format: ARGS.export.format, suffix: '', constraint: { type: 'WIDTH', value: ARGS.export.width } }];
    fixed.push(`${s.name}: export settings restored`);
  }

  const frames = new Set();
  const box = inst.absoluteBoundingBox;
  for (const t of s.texts || []) {
    const n = resolve(inst, t.path);
    const m = resolve(main, t.path);
    if (!n || n.type !== 'TEXT') { add('error', 'slot-missing', t.path, 'text slot not found'); continue; }
    if (!n.visible) continue;
    for (let p = n.parent; p && p !== inst.parent; p = p.parent) frames.add(p);
    const norm = x => x.replace(SOFT_BREAKS, '\n').trim();
    if (t.value != null) { if (norm(n.characters) !== norm(t.value)) add('error', 'mismatch', t.path, `shows "${excerpt(n.characters)}" instead of "${excerpt(t.value)}"`); }
    else if (!t.kept && m && n.characters === m.characters) add('error', 'placeholder', t.path, `still shows the template text "${excerpt(n.characters)}"`);
    const lh = lineHeightPx(n);
    let lines;
    if (n.textAutoResize === 'NONE') {
      const need = await neededHeight(n);
      lines = Math.max(1, r(need / lh));
      if (need > n.height + 1) add('error', 'overflow', t.path, `needs ${lines} lines but the box fits ${Math.max(1, r(n.height / lh))}; the rest is cut off`);
    } else if (n.textAutoResize === 'HEIGHT') lines = Math.max(1, r(n.height / lh));
    else lines = n.characters.replace(SOFT_BREAKS, '\n').split('\n').length;
    if (t.lines && lines > t.lines && n.textAutoResize !== 'NONE') add('warn', 'lines', t.path, `runs to ${lines} lines; the layout is designed for ${t.lines}`);
    if (n.textAutoResize === 'WIDTH_AND_HEIGHT' && t.maxW && n.width > t.maxW + 2) add('error', 'overflow', t.path, `${r(n.width - t.maxW)}px wider than the space the template gives it (${r(t.maxW)}px)`);
    if (!inside(n.absoluteBoundingBox, box)) add('error', 'overflow', t.path, 'text extends outside the slide');
  }

  // Template photos: every image hash used by a (non-skipped) photo slot in the template must be gone from
  // the whole slide, including repeats outside the slot (story backgrounds) and stacked images in the slot.
  const visibleImages = n => (Array.isArray(n.fills) ? n.fills.filter(f => f.type === 'IMAGE' && f.visible !== false && f.opacity !== 0 && f.imageHash) : []);
  const placeholder = new Set();
  const slotIds = new Set(); // node ids: the API returns a new wrapper object per lookup
  for (const im of s.images || []) {
    const n = resolve(inst, im.path);
    const m = resolve(main, im.path);
    if (!n) { add('error', 'slot-missing', im.path, 'image slot not found'); continue; }
    slotIds.add(n.id);
    if (!n.visible) continue;
    for (let p = n.parent; p && p !== inst.parent; p = p.parent) frames.add(p);
    const imgs = visibleImages(n);
    const mHashes = m ? visibleImages(m).map(f => f.imageHash) : [];
    if (!imgs.length) { add('error', 'image-missing', im.path, 'no image fill'); continue; }
    if (im.skipped) { add('warn', 'image-placeholder', im.path, 'placeholder photo kept (operator skipped)'); continue; }
    mHashes.forEach(h => placeholder.add(h));
    if (mHashes.includes(imgs[imgs.length - 1].imageHash)) add('error', 'image-placeholder', im.path, 'still shows the template photo');
    else if (imgs.some(f => mHashes.includes(f.imageHash))) add('error', 'image-placeholder', im.path, 'a template photo is still stacked in this layer');
  }
  for (const o of [inst, ...inst.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'POLYGON', 'STAR'] })]) {
    if (slotIds.has(o.id) || !o.visible) continue;
    if (visibleImages(o).some(f => placeholder.has(f.imageHash))) add('error', 'image-placeholder', o === inst ? '(slide background)' : pathOf(o, inst), 'the template photo is still visible here');
  }

  // Containers: content that no longer fits, or leaves visibly more empty space than the template does.
  for (const f of frames) {
    if (!('layoutMode' in f) || f.layoutMode === 'NONE' || f.layoutWrap === 'WRAP') continue;
    const path = f === inst ? '(slide)' : pathOf(f, inst);
    const mf = f === inst ? main : resolve(main, path);
    const vert = f.layoutMode === 'VERTICAL';
    const free = freeSpace(f);
    const mFree = mf && 'layoutMode' in mf && mf.layoutMode === f.layoutMode ? freeSpace(mf) : 0;
    if (f.primaryAxisSizingMode === 'FIXED' && free < -1) add('error', 'overflow', path, `content is ${r(-free)}px ${vert ? 'taller' : 'wider'} than the frame`);
    else if (vert && f.primaryAxisSizingMode === 'FIXED' && ['MIN', 'MAX'].includes(f.primaryAxisAlignItems) && free - mFree >= ARGS.underfillMin) {
      add('warn', 'underfill', path, `${r(free - mFree)}px more empty space ${f.primaryAxisAlignItems === 'MIN' ? 'at the bottom' : 'at the top'} than the template — the text is shorter than the layout expects`);
    }
    const inner = vert ? f.width - f.paddingLeft - f.paddingRight : f.height - f.paddingTop - f.paddingBottom;
    for (const c of f.children) if (c.visible && c.layoutPositioning !== 'ABSOLUTE' && (vert ? c.width : c.height) > inner + 1) add('error', 'overflow', pathOf(c, inst), `${r((vert ? c.width : c.height) - inner)}px ${vert ? 'wider' : 'taller'} than its container`);
  }
  results.push({ name: s.name, issues });
}

const count = sev => results.reduce((a, x) => a + x.issues.filter(i => i.severity === sev).length, 0);
return { ok: count('error') === 0, errors: count('error'), warnings: count('warn'), fixed, slides: results.filter(x => x.issues.length), checked: results.length };
