---
name: new-post
description: Builds a Bride&Groom Instagram post (feed post, carousel, story or story set) in Figma from the approved templates, verifies it and logs the run. Detailed mode is a guided 9-step questionnaire; Quick mode takes a brief and photos and decides the rest. Use when the operator types /new-post (optionally `quick` or `detailed`) or asks to create a post.
argument-hint: "[quick|detailed]"
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
# /new-post

Project paths (`config.json`, `scripts/…`, `figma/…`, `templates/…`, `runs/…`) are relative to the project folder `bg-post-generator/`: read files and run commands from there, and its `CLAUDE.md` rules apply. Skill files are at the **repository root**: `steps/…` and `quick.md` below mean `<repository root>/.claude/skills/new-post/steps/…` (next to this file), not a folder inside `bg-post-generator/`. Speak plainly: operators are not designers or developers.

The shared steps are used by both modes, `/bulk-posts` and `/edit-run`:

| Step | File (`<repository root>/.claude/skills/new-post/`) |
|---|---|
| Preflight | `steps/preflight.md` |
| Choose format, type, color, slides | `steps/compose.md` |
| Text and caption | `steps/copy.md` |
| Photos | `steps/images.md` |
| Contact sheets and strips | `steps/previews.md` |
| Review screen | `steps/review.md` |
| Upload, build, verify, log, report | `steps/build.md` |

## Start
1. `steps/preflight.md`.
2. Mode: the argument `quick` or `detailed` decides it. Otherwise ask with `AskUserQuestion` (add "(type back or cancel at any step)"):
   - **Detailed** — "I answer 9 short questions and choose everything myself."
   - **Quick** — "I describe the post and add photos; Claude picks the layout, color and text, and I approve one summary."
3. Quick → follow `quick.md`. Detailed → the questionnaire below.

## Conversation rules (both modes)
- Use `AskUserQuestion` for choices: at most 4 options; when there are more, make the last one **More…** and name the rest in the question text. The operator can always type any option under **Other**. Free-text questions are plain messages.
- `back` → return to the previous question, keeping later answers where still valid. `cancel` → stop; nothing is built; nothing is uploaded.
- Every choice list comes from the manifest (never from memory). Record every question and answer verbatim for the run log (`answers[]`); in Quick mode record each decision Claude made the same way.

## Detailed questionnaire
Prefix every question with the step counter `N/9`. Skipped steps are skipped silently, so the counter may jump. Send the contact sheet or strip before the questions that have one (`steps/previews.md`).

### 1/9 Format
`steps/compose.md` → *Format*.

### 2/9 Content type
`steps/compose.md` → *Content type*.

### 3/9 Color
`steps/compose.md` → *Color*. Contact sheet first.

### 4/9 Structure
`steps/compose.md` → *Slides*.
- Single post / story: the layout, with a contact sheet of the candidates in that color.
- Carousel / story set: number of slides, then **Auto-compose** or **Manual**. Auto-compose: send the strip and the `01 Cover · Text · Pink` lines, then ask Use this · Change a slide · Manual. Manual: ask each slide's layout, with a contact sheet of its candidates.

### 5/9 Content mode
"I'll type the text" or "Draft it from a brief". **Reviews are always typed**: skip this step.
Draft: ask topic, key message, audience, tone, call to action (one at a time), draft per `steps/copy.md`, show the full draft per slide, and ask: Use this draft · Edit a field · Write it myself.

### 6/9 Text
For each slide, each text slot, one question: `Slide 02 · title (≈30 chars, 2 lines; the last part is italic)`. Rules: `steps/copy.md`. After a draft, ask only for slots the draft didn't fill.

### 7/9 Images
For each image slot, describe it and take the photo per `steps/images.md` (folders: Assign in order · Choose per slot).

### 8/9 Caption
`steps/copy.md` → *Caption*: Write my own · Draft it for me · Skip.

### 9/9 Review
`steps/review.md` (Detailed options).

## Build
`steps/build.md`, with `mode: "detailed"` in the run log.
