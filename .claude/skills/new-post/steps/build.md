# Step: build, verify, log, report

Shared by both `/new-post` modes and by `/bulk-posts` (once per post). `/edit-run` uses the same build spec, verify inputs and log shape. Paths are relative to `bg-post-generator/`.

## 1. Upload photos
`upload_assets` (`count` = number of local files, at most 60 per call; `currentPageId` = the Media page id from preflight) → one `submitUrl` per file; then `bash scripts/upload-asset.sh '<submitUrl>' <file>` for each (it only posts PNG/JPEG/WebP to `https://mcp.figma.com/mcp/upload/…`) → `imageHash`, `placedOnNodeId`.
Then `use_figma` with `figma/stage-media.js`, `mode: 'stage'`, `runId`, `items: [{ nodeId: placedOnNodeId, file, width, height }]` → `imageHash` per file, `sectionId`.
Media names found with `mode: 'lookup'` are reused as they are (no upload).

## 2. Build spec
Inline `figma/build-run.js` into `use_figma`, ARGS:
```js
{
  generatedPage: config.pages.generated,
  layout: config.layout,
  exportSettings: { format: config.export.format, width: config.export[feed|story].value },
  tokens: <keep the defaults in the script>, font: 'DM Sans',
  sectionId: null,                                        // new run
  sectionName: '<runId> · <Format> · <short title>',      // e.g. "BG-20261023-1430-anna · Carousel · Wedding film tips"
  card: { title: runId, subtitle: '<Format> · <content type> · <color> · <Detailed|Quick>',
          blocks: [ { heading: 'Requested', lines: ['<handle> (<email>)', '<local> <tz>'] },
                    { heading: 'Batch', lines: ['<batchId> · post N of M'] },           // /bulk-posts only
                    { heading: 'Brief', lines: ['<the brief, as given>'] },            // Quick mode and /bulk-posts
                    { heading: 'Templates', lines: ['01 <component name>', …] },
                    { heading: 'Answers', lines: ['1/9 Which format? → Carousel', …] }, // Quick: the decisions and review changes
                    { heading: 'Images', lines: ['01 photo → IMG_2041.png 1080×1350', …] },
                    { heading: 'Caption', lines: [caption, hashtags.join(' ')] },
                    { heading: 'Warnings', tone: 'warn', lines: [...] } ],   // omit empty blocks
          runData: JSON.stringify(<run log>) },
  slides: [ { index: 1, name: '<runId>_01', label: '01 Cover',
              component: { key, nodeId, name },             // from the chosen manifest variant
              texts: [ { path, value, accent } ],           // accent only for a mixed-font node
              hide: [path], images: [ { path, imageHash } ], ratings: [ { path, stars } ] } ],
  removeSlides: [],
}
```
Keep each call ≤ 50k chars (split a long carousel: build the first slides with the card, then the rest with the same `sectionId` and `card: null`). Returns are capped at 48 KB. If `errors[]` is not empty, explain each (slide + field) and offer fixes; never change template styling to make things fit.

## 3. Verify
Inline `figma/verify-run.js` with `sectionId`, `export` as above, `slides: [{ name, nodeId, component, texts: [{ path, lines, maxW: box.availW, value, kept }] (every text slot of the template), images: [{ path, skipped }] }]`. For a mixed-font accent node, `value` = text + `"\n"` + accent.

## 4. Screenshot
`get_screenshot` of the section. Mandatory even when verify passes: look for text running past cards, cut words, leftover placeholder photos, blank (grey) photos, odd gaps. A photo that shows as flat grey did not decode in Figma (seen with some WebP files): convert it to PNG (`sips -s format png` on macOS, `convert` elsewhere) and upload it again.

## 5. Fix loop
Errors → name slide + field and offer: shorten/extend text · switch layout · different image. Text Claude drafted may be shortened directly (say so); the operator's own text only with their OK. Rebuild only the affected slides (same `sectionId`, `card: null` unless answers changed) and re-verify. Warnings (`underfill`, `lines`) → tell the operator and let them decide.
Figma rate limit or a transient error: wait (30 s, then 60 s, then 120 s) and retry the same call; after the third failure stop and report.

## 6. Run log
Write `runs/<runId>.json` (schema: `runs/run.schema.json`): `runId, mode ("detailed" | "quick"), batchId?, status ("verified" | "built-with-errors" | "failed" | "cancelled"), requestedBy, created, fileKey, manifestHash, format (feed | carousel | story | story-set), contentType, color, contentMode, brief?, slides[] (index, label, group, color, colorFallback, component {name,key}, text {slotId: {value, accent?, source: typed|draft|kept-default|auto}}, hidden, rating, images {slotId: {source, path, file, width, height, bytes, crop}}), caption, hashtags, warnings[], answers[], figma {sectionId, summaryCardId, slides[], mediaSectionId, media[]}, revisions: [], verification {at, errors, warnings, history}`.
The same JSON goes into the card's hidden `run-data` text. Re-render the card if the log changes after verification.

## 7. Final message
"Done. N slides, verified." + warnings in one line each + the link `https://www.figma.com/design/<fileKey>/?node-id=<sectionId with ":" → "-">` + caption and hashtags ready to copy + "Export: select the slides (not the card) → Export."
