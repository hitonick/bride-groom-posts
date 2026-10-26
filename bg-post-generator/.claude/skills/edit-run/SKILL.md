---
name: edit-run
description: Change an existing Bride&Groom run on the Figma Generated page (text, photos, color, slides, caption), re-verify it and add a Revisions entry. Use when the operator types /edit-run or wants to change a post that was already generated.
---

# /edit-run

Edits one run in place. `CLAUDE.md` rules apply; the conversation rules (one question at a time, `back` / `cancel`, choices from the manifest) are the same as in `.claude/skills/new-post/SKILL.md`, which also defines the build spec, verify inputs, image handling and run-log shape reused here.

## 1. Preflight
Same as /new-post step 0 (Figma connected, `whoami`, `create_session`, `figma-use` skill, `scan-hash.js` drift check → re-sync if needed, `scripts/local-time.sh`).

## 2. Find the run
Ask for the run ID (`BG-YYYYMMDD-HHMM-handle`) or the Figma link to the run's section (any node inside it works; `node-id=12-34` → `12:34`).
`use_figma` with `figma/read-run.js` (ARGS `runId` and/or `nodeId`).
- `found: false` → show `candidates` and ask again.
- Prefer the card's `runData` (live); fall back to `runs/<runId>.json`. If they differ, trust Figma and mention it.
- Report anything unusual from the live state: `detached` slides, instances of a different component than logged, `otherLayers` (manual additions). These are never deleted unless the operator says so.

## 3. What to change
Show a short summary of the run (slides with layout, color and main text) and ask what to change:
- a text on a slide (same budget / `|` / `keep` / `hide` rules as /new-post step 6);
- a photo, including a story background (same image rules as step 7; stage new uploads under the **same** run ID);
- the color of the whole run (same fallback rules as step 3);
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
