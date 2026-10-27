// read-run.js — read-only: load a run's live state from the Generated page. Run via use_figma.
// Before sending, replace the ARGS line: runId (e.g. "BG-20261023-1430-anna") and/or nodeId (from a Figma link,
// node-id "12-34" → "12:34"; any node inside the run's section works).
// Returns the section, the run-data JSON stored on the summary card, the slides as they are now (including
// detached or foreign layers), and the card's existing Revisions lines.
const ARGS = { generatedPage: 'Generated', runId: null, nodeId: null };

const page = figma.root.children.find(p => p.name === ARGS.generatedPage);
if (!page) throw new Error(`Page "${ARGS.generatedPage}" not found`);
await figma.setCurrentPageAsync(page);
const SOFT_BREAKS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029, 0x85) + ']', 'g');
const safe = o => JSON.parse(JSON.stringify(o).replace(SOFT_BREAKS, '\\n'));

let section = null;
if (ARGS.nodeId) {
  for (let n = await figma.getNodeByIdAsync(ARGS.nodeId); n && n.type !== 'PAGE'; n = n.parent) if (n.type === 'SECTION' && n.parent.type === 'PAGE') { section = n; break; }
}
// Test runs are named "TEST <runId> · …" so they are easy to find and delete; the prefix is not part of the run ID.
const bare = name => name.replace(/^TEST /, '');
if (!section && ARGS.runId) section = page.children.find(n => n.type === 'SECTION' && bare(n.name).startsWith(`${ARGS.runId} ·`)) || null;
if (!section) return { found: false, candidates: page.children.filter(n => n.type === 'SECTION').map(n => n.name).slice(-10) };

const runId = bare(section.name).split(' · ')[0];
const card = section.children.find(n => n.name === 'summary-card') || null;
const data = card ? card.findOne(n => n.type === 'TEXT' && n.name === 'run-data') : null;
let runData = null;
try { runData = data ? JSON.parse(data.characters) : null; } catch (e) { runData = { error: 'run-data is not valid JSON', raw: data.characters.slice(0, 200) }; }
const revBlock = card ? card.findOne(n => n.name === 'block/Revisions') : null;
const revisions = revBlock ? revBlock.children.filter(n => n.type === 'TEXT').slice(1).map(t => t.characters) : [];

const slides = [];
const other = [];
for (const n of section.children) {
  if (n === card || n.name.startsWith('label/')) continue;
  const m = new RegExp(`^${runId.replace(/[-]/g, '\\-')}_(\\d+)$`).exec(n.name);
  if (!m) { other.push({ id: n.id, name: n.name, type: n.type }); continue; }
  const main = n.type === 'INSTANCE' ? await n.getMainComponentAsync() : null;
  const label = section.children.find(l => l.name === `label/${n.name}`);
  slides.push({ index: +m[1], name: n.name, nodeId: n.id, type: n.type, detached: n.type !== 'INSTANCE' || undefined, component: main ? { name: main.name, key: main.key } : null, label: label && label.type === 'TEXT' ? label.characters : null, labelId: label ? label.id : null });
}
slides.sort((a, b) => a.index - b.index);

return safe({ found: true, runId, sectionId: section.id, sectionName: section.name, cardId: card ? card.id : null, runData, revisions, slides, otherLayers: other });
