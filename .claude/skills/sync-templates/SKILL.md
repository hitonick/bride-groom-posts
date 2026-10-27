---
name: sync-templates
description: Rebuild templates/manifest.json from the Figma Templates page. Use after designers change templates, when /new-post reports template drift, or when the operator types /sync-templates.
allowed-tools:
  - mcp__figma__whoami
  - mcp__figma__create_session
  - mcp__figma__get_figma_skill
  - mcp__figma__use_figma
  - mcp__figma__upload_assets
  - mcp__figma__get_screenshot
  - mcp__claude_ai_Figma__whoami
  - mcp__claude_ai_Figma__create_session
  - mcp__claude_ai_Figma__get_figma_skill
  - mcp__claude_ai_Figma__use_figma
  - mcp__claude_ai_Figma__upload_assets
  - mcp__claude_ai_Figma__get_screenshot
  - mcp__Figma__whoami
  - mcp__Figma__create_session
  - mcp__Figma__get_figma_skill
  - mcp__Figma__use_figma
  - mcp__Figma__upload_assets
  - mcp__Figma__get_screenshot
  - Bash(node scripts/manifest-digest.mjs *)
  - Bash(node scripts/assemble-manifest.mjs *)
  - Bash(node scripts/previews.mjs *)
  - Bash(bash scripts/fetch-image.sh *)
---

# /sync-templates

All paths in this skill are relative to the project folder `bg-post-generator/`: read files and run commands from there, and its `CLAUDE.md` rules apply.

Rebuilds `templates/manifest.json` from the live **Templates** page. Read-only on Figma unless the operator confirms a rename.
Follow every rule in `CLAUDE.md` (Figma MCP rules especially).

## 1. Preflight
1. Read `config.json`. All page names, scan settings and the fileKey come from there.
2. Check the Figma MCP tools are available. If not: tell the operator to type `/mcp` → **figma** → **Authenticate** (or connect the Figma connector in Settings → Connectors in the desktop app; in a cloud session, at claude.ai/customize/connectors and then start a new session), then stop.
3. `whoami` → remember the handle (used as `--by`).
4. `create_session` with `config.fileKey`; pass the `sessionId` to every later Figma call.
5. `get_figma_skill` for `skill://figma/figma-use/SKILL.md` before the first `use_figma`; pass `skillNames: "resource:figma-use"` on every `use_figma`.

## 2. Find what changed (digest)
1. Inline `figma/scan-templates.js` into `use_figma`, replacing the `const ARGS =` line with:
   `{ templatesPage: config.pages.templates, ignoreMarker: config.scan.ignoreMarker, decorContainers: config.scan.decorContainers, colorTokens: config.scan.colorTokens, mode: 'digest' }`.
2. Save the result to `templates/.scan/digest.json` and run `node scripts/manifest-digest.mjs templates/.scan/digest.json`.
3. Exit 0 (`identical: …`) → the manifest is current: skip to **4. Previews** (only missing previews get exported), then report "Templates are up to date (N layouts)". Do a full scan anyway if the operator asked for a full rebuild.
   The digest also covers each variant's `look` (a visual fingerprint), so a design change that keeps the slots (new colors, moved decor) shows up as a changed template here.

## 3. Full scan
`use_figma` returns are capped at 48 KB, so fetch in parts:
1. Empty `templates/.scan/` (keep the folder).
2. Mode `'meta'` → save as `templates/.scan/meta.json`.
3. Mode `'templates'` with `offset` = 0, `templatesPerCall`, 2×`templatesPerCall`, … up to `templateCount`, `limit: config.scan.templatesPerCall`. Run these calls in parallel. Save each as `templates/.scan/part-<offset>.json`, exactly as returned.
4. `node scripts/assemble-manifest.mjs --by "<handle>"`. It refuses if the file changed mid-scan (hash mismatch) or a part is missing; then redo step 3 for the missing parts or rerun from step 1.
5. Re-run step 2 (digest) and confirm it prints `identical`.

Never hand-edit `templates/manifest.json`.

## 4. Previews
One ~270 px PNG per template variant in `templates/previews/<component key>.png`, shown to operators while they choose (see /new-post → *Previews*). `templates/previews/index.json` records the `look` each file was exported from.
1. `node scripts/previews.mjs status` → `todo[]` (`key`, `nodeId`, `maxDimension`, `reason`: missing / template changed). Empty → skip to step 4.
2. For each todo item (about 10 calls in parallel): `get_screenshot` with `nodeId` and `maxDimension` (it makes the image 270 px wide). Read-only on the Templates page.
   - Download the returned URL: `bash scripts/fetch-image.sh '<image_url>' previews/<key>.png`.
   - If the download fails (cloud sessions often block `www.figma.com`), call `get_screenshot` again with `enableBase64Response: true`. When the client saves the inline image to a local file and names it in the result, run `node scripts/previews.mjs import-file <key> <that file>`.
   - If neither works, stop exporting, tell the operator previews were skipped and why, and carry on: the questionnaire works without them.
3. `node scripts/previews.mjs import runs/.cache/previews` (imports every downloaded `<key>.png`), then `node scripts/previews.mjs prune` (deletes previews of variants that no longer exist).
4. `node scripts/previews.mjs status` again: report `ok`/`total` and the folder size (`bytes`). Previews are committed with the manifest.

## 5. Report
- Counts: layouts and components per type (from `summary`), and what changed vs the previous manifest (new / changed / removed templates from the digest diff).
- **Irregularities** (`irregularities[]`): list each issue, the components it affects and its `proposal`. Call out layers bound to the same text property (`sharedWith`): /new-post never auto-picks those layouts.
- Renames are only proposals. The Templates page is changed only if the operator explicitly confirms a specific rename in this session; then make exactly that rename and rescan.

## Notes
- If the `hash` or `lookHash` from `figma/scan-hash.js` doesn't equal the fresh manifest's right after a sync, `scan-hash.js` is out of step with `scan-templates.js`: tell the operator (a maintainer must align `classify/walk/assignIds`), and don't loop on re-syncing.
- Frames whose name contains `config.scan.ignoreMarker` are never read or changed.
