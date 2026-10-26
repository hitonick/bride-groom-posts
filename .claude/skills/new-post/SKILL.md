---
name: new-post
description: Guided questionnaire that builds a Bride&Groom Instagram post (feed post, carousel, story or story set) in Figma from the approved templates, verifies it and logs the run. Use when the operator types /new-post or asks to create a post.
---

# /new-post

All paths in this skill are relative to the project folder `bg-post-generator/`: read files and run commands from there, and its `CLAUDE.md` rules apply.

Ask the operator one question at a time, build the post from `templates/manifest.json` on the **Generated** page, verify it, and log the run.
`CLAUDE.md` rules always apply. Speak plainly: operators are not designers or developers.

## Conversation rules
- Prefix every question with the step counter `N/9`. Skipped steps are skipped silently, so the counter may jump.
- Use `AskUserQuestion` for choices: at most 4 options; when there are more, make the last one **More…** and name the rest in the question text. The operator can always type any option under **Other**. Free-text questions are plain messages.
- First question only: add "(type back or cancel at any step)".
- `back` → return to the previous question, keeping later answers where still valid. `cancel` → stop; nothing is built; nothing is uploaded.
- Every choice list comes from the manifest (never from memory). Record every question and answer verbatim for the run log (`answers[]`).

## 0. Preflight (before question 1)
1. Read `config.json` and `templates/manifest.json`.
2. Figma MCP tools available? If not: "Figma is not connected. Type `/mcp` → figma → Authenticate (or, in the desktop app, connect Figma under Settings → Connectors), then run /new-post again." Stop.
3. `whoami` → `handle` and `email` (requestedBy). Run ID handle = the Figma handle lowercased, non-alphanumerics → `-`.
4. `create_session` with `config.fileKey`; reuse its `sessionId` on every Figma call. `get_figma_skill` (`figma-use`) once; pass `skillNames: "resource:figma-use"` on every `use_figma`.
5. `use_figma` with `figma/scan-hash.js` (ARGS from `config.pages.templates` and `config.scan`). Then check:
   - pages `Templates`, `Media`, `Generated` exist (names from `config.pages`); otherwise name the missing page and stop;
   - `hash` and `scannerVersion` equal the manifest's. If not, say "Templates changed, refreshing the list…" and run the `/sync-templates` procedure, then reload the manifest.
6. Permission or seat errors at any point: stop and say exactly which access is missing ("your Figma account <email> needs **can edit** on the file").
7. `bash scripts/local-time.sh` → `stamp`, `iso`, `local`, `tz`. Run ID = `BG-<stamp>-<handle>` (e.g. `BG-20261023-1430-anna`).

## Questions

### 1/9 Format
Feed post (single) · Carousel · Story · Story set. Feed and carousel use `format: "feed"` templates; story and story set use `format: "story"`.

### 2/9 Content type
Offer only types that exist for the chosen format, from the manifest's template `type`s and layouts, described in operator words (Review, Cover, Carousel article, Reviews carousel, Poll / Question / Opinion story…). A carousel article is Cover → Carousel content slides → Outro/Thank You.

### 3/9 Color
List colors from the variants of the eligible templates, each with "N layouts". Most layouts first.
**Fallback** when a layout lacks the color: same hue lighter/darker (`Pink` ↔ `Light Pink`), then a neutral (`Light Color`, then `config.colorFallback.neutrals`). Never switch to another hue without asking. Tell the operator which slides fall back; record `colorFallback: "Pink → Light Color"` and a `color-fallback` warning.

### 4/9 Structure
- Single post / story: pick the layout (group) among those available in the color.
- Carousel / story set: number of slides (offer 5 recommended, 3, 7; limits `config.instagram.carouselMinSlides`..`carouselMaxSlides`), then **Auto-compose** or **Manual**.
  - Auto-compose: varied sequence cover → content → outro, no layout twice in a row, prefer layouts in the chosen color. Show it as `01 Cover · Text · Pink` lines and ask: Use this · Change a slide · Manual.
  - Manual: ask the layout for each slide.
- Never auto-pick a layout with `sharedWith` text slots (see manifest irregularities). If the operator picks one, warn that two fields will show the same text.
- Mention grayscale photos (variant `grayscale`) before the image step: "this layout shows photos in black and white".

### 5/9 Content mode
"I'll type the text" or "Draft it from a brief". **Reviews are always typed**: skip this step (never invent quotes, names, ratings or handles).
Draft: ask topic, key message, audience, tone, call to action (one at a time). Draft every text slot within its budget, show the full draft per slide, and ask: Use this draft · Edit a field · Write it myself.

### 6/9 Text
For each slide, each text slot (manifest `kind: "text"`, not `auto`, not `role: "fixed"`), one question:
`Slide 02 · title (≈30 chars, 2 lines; the last part is italic)`. Budget = `capacity`, `lines`. For quotes and long text also say how much fills the design (`defaultLength`): much shorter text leaves a gap.
- `|` splits a title from its `-accent` part. Without `|` and with an accent slot, pick the last words that fit the accent line and show the split. For a mixed-font single node, pass the accent separately (`accent` in the build spec).
- `keep` → keep the template text (record `source: "kept-default"`); offer it as a choice where it makes sense (story headlines, `button-label`).
- `hide` → hide an optional field (listed in `hide`).
- List slots (`list` set): bullets come from the template; strip typed `1.` / `•`.
- Over budget: Shorten it · Keep and check the real fit when building · Pick another layout.
- Auto slots: `page-number` = two-digit slide index; `tag-label` keeps its template text (`kept: true` in verify).
- After a draft, ask only for slots the draft didn't fill.
- Reviews: quote, author name, handle (if the layout shows one), source (Google/Facebook: pick a layout with that platform, or fill `source-label`), star rating (1..`stars`).

### 7/9 Images
For each image slot (`photo`, `avatar`, optional `background`): describe it: orientation from `aspect` (portrait/landscape/square + ratio), best width ≈ slot width × 1080 / template width, grayscale note.
Accept: a dragged file path, a typed path, a folder, a direct image URL, a name on the Media page, or `skip`.
- File / folder: `bash scripts/image-info.sh <path>`. Folders list PNG/JPG/WebP with sizes (others "skipped"); ask Assign in order · Choose per slot.
- URL: download into the scratchpad, then treat as a file.
- Media name: `use_figma` with `figma/stage-media.js` in `mode: 'lookup'` → reuse its `imageHash`.
- Reject: type not in `config.media.types`, larger than `config.media.maxBytes`, unreadable. Clipboard pastes have no file: ask the operator to save it as a file and drag that in.
- Warn when width < best width, or when crop > 0.25 (`crop = 1 - min(imgAspect, slotAspect) / max(imgAspect, slotAspect)`), and offer another image.
- `skip` keeps the template photo: warning `image-placeholder` (not for `background`; keeping a story background is fine and not a warning).
- Upload only after the review is confirmed (step 9).

### 8/9 Caption
Write my own · Draft it for me · Skip. At most `config.instagram.hashtagsMax` hashtags, caption ≤ `captionMaxChars`. Show a draft and ask: Use it · Edit · Skip.

### 9/9 Review
A compact table: format, type, color (+fallbacks), each slide (layout, color, every field value, image), caption, hashtags, warnings. Ask: Build it · Change something (name the step) · Cancel.

## Build
1. **Upload photos**: `upload_assets` for each local file onto the Media page. Then `use_figma` with `figma/stage-media.js`, `mode: 'stage'`, `runId`, `items: [{ nodeId: placedOnNodeId, file, width, height }]` → `imageHash` per file, `sectionId`.
2. **Build spec**: inline `figma/build-run.js` into `use_figma`, ARGS:
   ```js
   {
     generatedPage: config.pages.generated,
     layout: config.layout,
     exportSettings: { format: config.export.format, width: config.export[feed|story].value },
     tokens: <keep the defaults in the script>, font: 'DM Sans',
     sectionId: null,                                        // new run
     sectionName: '<runId> · <Format> · <short title>',      // e.g. "BG-20261023-1430-anna · Carousel · Wedding film tips"
     card: { title: runId, subtitle: '<Format> · <content type> · <color>',
             blocks: [ { heading: 'Requested', lines: ['<handle> (<email>)', '<local> <tz>'] },
                       { heading: 'Templates', lines: ['01 <component name>', …] },
                       { heading: 'Answers', lines: ['1/9 Which format? → Carousel', …] },
                       { heading: 'Images', lines: ['01 photo → IMG_2041.png 1080×1350', …] },
                       { heading: 'Caption', lines: [caption, hashtags.join(' ')] },
                       { heading: 'Warnings', tone: 'warn', lines: [...] } ],   // omit when empty
             runData: JSON.stringify(<run log>) },
     slides: [ { index: 1, name: '<runId>_01', label: '01 Cover',
                 component: { key, nodeId, name },             // from the chosen manifest variant
                 texts: [ { path, value, accent } ],           // accent only for a mixed-font node
                 hide: [path], images: [ { path, imageHash } ], ratings: [ { path, stars } ] } ],
     removeSlides: [],
   }
   ```
   Keep each call ≤ 50k chars. If `errors[]` is not empty, explain each (slide + field) and offer fixes; never change template styling to make things fit.
3. **Verify**: inline `figma/verify-run.js` with `sectionId`, `export` as above, `slides: [{ name, nodeId, component, texts: [{ path, lines, maxW: box.availW, value, kept }] (every text slot of the template), images: [{ path, skipped }] }]`. For a mixed-font accent node, `value` = text + `"\n"` + accent.
4. **Screenshot**: `get_screenshot` of the section. Mandatory even when verify passes; look for text running past cards, cut words, leftover placeholder photos, odd gaps.
5. Errors → name slide + field, offer: shorten/extend text · switch layout · different image. Rebuild only the affected slides (same `sectionId`, `card: null` unless answers changed) and re-verify. Warnings (`underfill`, `lines`) → tell the operator and let them decide.

## Run log
Write `runs/<runId>.json` (same shape as existing files in `runs/`): `runId, status ("verified" | "built-with-errors" | "cancelled"), requestedBy, created, fileKey, manifestHash, format, contentType, color, contentMode, brief?, slides[] (index, label, group, color, colorFallback, component {name,key}, text {slotId: {value, source: typed|draft|kept-default|auto}}, hidden, rating, images {slotId: {source, path, file, width, height, bytes, crop}}), caption, hashtags, warnings[], answers[], figma {sectionId, summaryCardId, slides[], mediaSectionId, media[]}, revisions: [], verification {at, errors, warnings, history}`.
The same JSON goes into the card's hidden `run-data` text. Re-render the card if the log changes after verification.

## Final message
"Done. N slides, verified." + warnings in one line each + the link `https://www.figma.com/design/<fileKey>/?node-id=<sectionId with ":" → "-">` + caption and hashtags ready to copy + "Export: select the slides (not the card) → Export."
