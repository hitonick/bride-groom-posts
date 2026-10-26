// stage-media.js — organise uploaded photos on the Media page, or look up photos already there. Run via use_figma.
// Before sending, replace the ARGS line:
//   mode: 'stage'  → items = [{ nodeId, file, width, height }] from upload_assets (`placedOnNodeId`) + scripts/image-info.sh.
//                    Renames each node to media/<runId>/<file>, sizes it to the photo's aspect, and collects the
//                    run's photos in a Section named media/<runId>. Returns { sectionId, items: [{ nodeId, name, imageHash }] }.
//   mode: 'lookup' → query = text typed by the operator. Returns image nodes on Media whose name contains it.
// Only touches the Media page.
const ARGS = { mediaPage: 'Media', mode: 'stage', runId: 'BG-YYYYMMDD-HHMM-handle', items: [], query: '', thumbWidth: 400, gap: 40, sectionGap: 200, padding: 80 };

const page = figma.root.children.find(p => p.name === ARGS.mediaPage);
if (!page) throw new Error(`Page "${ARGS.mediaPage}" not found`);
await figma.setCurrentPageAsync(page);
const imageOf = n => 'fills' in n && Array.isArray(n.fills) ? n.fills.find(f => f.type === 'IMAGE') : null;

if (ARGS.mode === 'lookup') {
  const q = ARGS.query.toLowerCase();
  const hits = page.findAllWithCriteria({ types: ['FRAME', 'RECTANGLE', 'ELLIPSE'] }).filter(n => !!imageOf(n) && n.name.toLowerCase().includes(q)).slice(0, 25);
  return { matches: hits.map(n => ({ nodeId: n.id, name: n.name, imageHash: imageOf(n).imageHash, w: Math.round(n.width), h: Math.round(n.height) })) };
}

// One Section per run, appended below everything already on the page (same rule as Generated).
const sectionName = `media/${ARGS.runId}`;
let section = page.children.find(n => n.type === 'SECTION' && n.name === sectionName);
if (!section) {
  // Measure against every top-level node (operators may drop loose images on this page).
  const others = page.children.filter(n => !ARGS.items.some(i => i.nodeId === n.id));
  section = figma.createSection();
  section.name = sectionName;
  section.x = others.length ? Math.min(...others.map(n => n.x)) : 0;
  section.y = others.length ? Math.max(...others.map(n => n.y + n.height)) + ARGS.sectionGap : 0;
}

const used = new Set(section.children.map(n => n.name));
const out = [];
const missing = [];
for (const it of ARGS.items) {
  const node = await figma.getNodeByIdAsync(it.nodeId);
  if (!node || !imageOf(node)) { missing.push(it.nodeId); continue; }
  let name = `media/${ARGS.runId}/${it.file}`;
  for (let k = 2; used.has(name) && node.parent !== section; k++) name = `media/${ARGS.runId}/${it.file.replace(/(\.[^.]+)?$/, `-${k}$1`)}`;
  used.add(name);
  node.name = name;
  if (node.parent !== section) section.appendChild(node);
  if (it.width && it.height) node.resize(ARGS.thumbWidth, Math.round(ARGS.thumbWidth * it.height / it.width));
  out.push({ nodeId: node.id, name, imageHash: imageOf(node).imageHash });
}

// Lay the run's photos out in one row.
let x = ARGS.padding, maxH = 0;
for (const n of section.children) { n.x = x; n.y = ARGS.padding; x += n.width + ARGS.gap; maxH = Math.max(maxH, n.height); }
section.resizeWithoutConstraints(Math.max(x - ARGS.gap + ARGS.padding, 400), maxH + 2 * ARGS.padding);

return { sectionId: section.id, items: out, missing, mutatedNodeIds: [section.id, ...out.map(o => o.nodeId)] };
