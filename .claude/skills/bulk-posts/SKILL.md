---
name: bulk-posts
description: Builds several Bride&Groom Instagram posts at once (e.g. a week of posts) from one brief file or pasted brief, with one plan to approve, one Figma run per post, verification of each, and a batch summary. Use when the operator types /bulk-posts or wants to create many posts from one brief.
argument-hint: "[path to brief .md]"
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

# /bulk-posts

All paths in this skill are relative to the project folder `bg-post-generator/`: read files and run commands from there, and its `CLAUDE.md` rules apply. Speak plainly.

Each post is a Quick-mode post (`.claude/skills/new-post/quick.md`) built with the shared steps in `.claude/skills/new-post/steps/`. This skill only adds the batch around them: one brief in, one plan to approve, N runs out, one summary.
It is a separate skill (not a mode of `/new-post`) because its input, plan table and batch bookkeeping have nothing in common with the one-post questionnaire; keeping them apart keeps both skills short.

## 1. Preflight
`steps/preflight.md`. Batch ID = `BG-<stamp>-<handle>`; post N's run ID = `<batchId>-NN` (`-01`, `-02`, …).

## 2. Read the brief
- The argument, or ask: "Give me the brief file (see `briefs/TEMPLATE.md`), or paste the whole brief here."
- One entry per `## Post …` block (pasted text without headings: one entry per paragraph that has a topic). Keys: `date`/`label`, `format`, `topic`, `message`, `cta`, `color`, `photos`, `review` (quote, name, rating, source), free text.
- `photos` paths are relative to the brief file's folder: a folder, file names, `https://` links, or `Media: <name>` (Figma Media page). Collect and check them per `steps/images.md` (links via `fetch-image.sh` into `runs/.cache/<batchId>-NN/`).
- Anything still in `<angle brackets>` is missing. A review entry without the real quote, name or rating → ask for it now, one question per post; never invent it. Other missing essentials (no topic) → ask too. Optional things (format, color) are decided.
- Record each entry verbatim as that post's `brief.text`.

## 3. Plan
For every entry: `steps/compose.md` → *Deciding automatically*, then `steps/copy.md` (draft) and `steps/images.md` (assign photos, checks).
Across the batch:
- Vary layouts and colors over the week: never the same template (group) on two consecutive posts, and no color more than twice in a row, unless the brief asks for it.
- Keep each post's own fallbacks and warnings.

Show **one** plan:
1. For each post, its strip (`steps/previews.md`, `--strip`, labelled `NN · <date> · <format>`); for many posts, one contact sheet with each post's first slide (labels `NN · <date> · <template> · <color>`).
2. One table: `# · date · format · template + color · headline · photos · warnings`.
3. Ask: **Build all** · **Change a post** · **Cancel**.
   - Change a post → "which post and what?" in plain words; apply, show that post's review (`steps/review.md`, Quick options without *Switch to detailed*), then the plan again.
   - Heavy-crop and low-resolution photos are listed in the warnings column and need a decision (Use it · Another image · Pick another layout) before Build all.

## 4. Build
1. **Upload all photos first**: `steps/build.md` § 1 for the whole batch (`upload_assets` ≤ 60 per call), then `stage-media.js` once per post with that post's run ID (one Media section per run).
2. **Then one post after another**: `steps/build.md` § 2–5 (build, verify, screenshot, fix loop). Each post gets its own Section and summary card, with a `Batch` block (`<batchId> · post N of M`) and `batchId` in its run data. Respect the `use_figma` limits (≤ 50k chars of code, ≤ 48 KB returned); on a rate-limit error wait 30 s / 60 s / 120 s and retry.
3. **A post that fails** (build error that the fix loop can't solve, Figma error after the retries, a photo that can't be used): record it `status: "failed"` with `error` in plain words, keep whatever was built, and continue with the next post. Never skip a post silently. Ask the operator about a failed post only after the batch is done.
4. Write `runs/<runId>.json` for every post (`mode: "quick"`, `batchId`, `brief`) as in `steps/build.md` § 6.

## 5. Batch index
Write `runs/batch-<batchId>.json` (schema: `runs/batch.schema.json`): `batchId, createdBy, created, brief (file path or "pasted"), posts: [{ n, runId, date, label, format, template, color, status, sectionId, link, warnings, caption, hashtags }], summary { built, verified, failed }`.

## 6. Report
"Done. M of N posts verified." Then per post: `NN · date · format · template` + the Section link (`https://www.figma.com/design/<fileKey>/?node-id=<sectionId with ":" → "-">`) + its warnings, one line each + its caption and hashtags ready to copy. Failed posts: what went wrong and the choices (try again · change the post · skip it). End with "Export: open each link, select the slides (not the card) → Export." and the batch file path.
