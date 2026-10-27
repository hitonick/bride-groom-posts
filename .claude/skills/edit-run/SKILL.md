---
name: edit-run
description: Change an existing Bride&Groom run on the Figma Generated page (text, photos, color, slides, caption), re-verify it and add a Revisions entry. Use when the operator types /edit-run or wants to change a post that was already generated.
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
  - Bash(bash scripts/local-time.sh)
  - Bash(bash scripts/image-info.sh *)
  - Bash(file --mime-type *)
  - Bash(bash scripts/upload-asset.sh *)
  - Bash(bash scripts/fetch-image.sh *)
  - Bash(node scripts/contact-sheet.mjs *)
---

# /edit-run

All paths in this skill are relative to the project folder `bg-post-generator/`: read files and run commands from there, and its `CLAUDE.md` rules apply.

Edits one run in place. `CLAUDE.md` rules apply; the conversation rules (one question at a time, `back` / `cancel`, choices from the manifest) are the same as in `/new-post`. The shared steps in `<repository root>/.claude/skills/new-post/steps/` (not inside `bg-post-generator/`) define what is reused here: `preflight.md`, `compose.md` (colors, fallbacks, layouts), `copy.md` (text rules), `images.md`, `previews.md` and `build.md` (build spec, verify inputs, run-log shape).

Works the same for every run, whatever made it: Detailed or Quick mode (`mode`), or one post of a `/bulk-posts` batch (`batchId`). The brief is kept for reference and never re-applied; only the changes the operator asks for are made.

## 1. Preflight
`steps/preflight.md` (Figma connected, `whoami`, `create_session`, `figma-use` skill, `scan-hash.js` drift check → re-sync if needed, `scripts/local-time.sh`).

## 2. Find the run
Ask for the run ID (`BG-YYYYMMDD-HHMM-handle`, or `…-NN` for a post of a batch) or the Figma link to the run's section (any node inside it works; `node-id=12-34` → `12:34`).
`use_figma` with `figma/read-run.js` (ARGS `runId` and/or `nodeId`).
- `found: false` → show `candidates` and ask again.
- Prefer the card's `runData` (live); fall back to `runs/<runId>.json`. If they differ, trust Figma and mention it.
- Report anything unusual from the live state: `detached` slides, instances of a different component than logged, `otherLayers` (manual additions). These are never deleted unless the operator says so.

## 3. What to change
Show a short summary of the run (mode, the brief if any, slides with layout, color and main text; the strip from `steps/previews.md` when previews exist) and ask what to change:
- a text on a slide (`steps/copy.md`: budget / `|` / `keep` / `hide`; text the operator wrote is never shortened without asking);
- a photo, including a story background (`steps/images.md`; stage new uploads under the **same** run ID);
- the color of the whole run (`steps/compose.md` fallback rules; contact sheet first);
- add, remove or reorder slides (reorder = rename slides `_NN` and labels to the new order; every affected slide is rebuilt);
- the caption or hashtags (card only, no slide rebuild);
- the layout of one slide.

Show **before → after** for every change and ask: Apply · Change something · Cancel.
Before applying, say which slides will be rebuilt and that manual Figma edits on those slides are lost.

## 4. Apply
`figma/build-run.js` with `sectionId` = the existing section (it stays in place), `sectionName` (updated if the title changed), `slides` = only the rebuilt slides (full spec: all texts, images, ratings, hides, carried over from the run data plus the changes), `removeSlides` = names of deleted slides, and `card` re-rendered with:
- all previous blocks updated to the new state;
- a `Revisions` block (heading exactly `Revisions`): the earlier lines from read-run's `revisions`, plus `<local time> · <handle> · <change>`;
- `runData` = the updated log.

## 5. Verify
`figma/verify-run.js` on **every** slide of the run (not only rebuilt ones), then `get_screenshot` of the section (mandatory). Fix or report issues as in /new-post.

## 6. Log
Update `runs/<runId>.json` (create it from `runData` if missing): apply the changes, append to `revisions[]` `{ at, by: { handle, email }, via: "/edit-run", change }`, update `figma.slides`, `verification` (append to `history`). Final message: what changed, verification result, the section link.
