# Step: images (collect, check, assign)

Shared by Detailed 7/9, Quick mode, `/bulk-posts` and `/edit-run`. Nothing is uploaded until the review is confirmed (`steps/build.md`).

## Describe the slot
For each image slot (`photo`, `avatar`, optional `background`): orientation from `aspect` (portrait / landscape / square + ratio), best width ≈ slot width × 1080 / template width, and the grayscale note when the variant lists the slot in `grayscale`.

## Accepted inputs
A dragged file path, a typed path, a folder, a direct image URL, a name on the Media page, or `skip`.
- File / folder: `bash scripts/image-info.sh <path>`. Folders list PNG/JPG/WebP with sizes (others "skipped").
- URL: `bash scripts/fetch-image.sh '<url>' <runId>/<name>` downloads it into `runs/.cache/` (it rejects non-images and files over the limit) and prints the same JSON as `image-info.sh`; then treat it as a file. If the download is blocked, say which host and ask for the file instead (README → *Cloud sessions*).
- Media name: `use_figma` with `figma/stage-media.js` in `mode: 'lookup'` → reuse its `imageHash`.
- Reject: type not in `config.media.types`, larger than `config.media.maxBytes`, unreadable. Clipboard pastes have no file: ask the operator to save it as a file and drag that in.

## Checks (always, in every mode)
- `crop = 1 - min(imgAspect, slotAspect) / max(imgAspect, slotAspect)`. Warn when crop > 0.25.
- Warn when width < best width (`low-resolution`).
- The operator decides on every heavy-crop or low-resolution photo: Use it · Another image · (Quick/bulk: Pick another layout). Record the decision.
- `skip` keeps the template photo: warning `image-placeholder` (not for `background`; keeping a story background is fine and not a warning).

## Assigning several photos (folder, Quick mode, /bulk-posts)
- Detailed mode asks: Assign in order · Choose per slot.
- Automatic: fill slots in slide order, and within a slide the largest slot first. Give each slot the photo with the lowest crop among those not yet used, then the larger one when crops tie; never reuse a photo while unused ones remain; prefer the sharpest (widest) photo for the cover and full-bleed slots. Then run the checks above. Photos left over: `steps/compose.md` → *Layouts for photos*.
- Name slots in operator words, never by id: "cover: main photo" (the larger visible slot), "cover: background photo" (`photo` at the slide's root behind a card), "avatar". The ids `photo[0]`/`photo[1]` are for the build spec only.
- Show the assignment as `01 photo ← IMG_2041.jpg (portrait, crop 4%)` lines in the review.
