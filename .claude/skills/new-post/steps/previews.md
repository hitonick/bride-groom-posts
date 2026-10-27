# Step: previews (contact sheets and strips)

Show the operator what they are choosing, as one image per question, never one image per option. Paths are relative to `bg-post-generator/`.

- **Contact sheet**: `node scripts/contact-sheet.mjs runs/.cache/<runId>/<name>.png --title "<the question>" -- <preview> "<label>" …`, one pair per answer option, in the same order and with the same number and wording as the options (`1 · Hashtag · Pink`). `<preview>` = `templates/<variant.preview>` (= `templates/previews/<variant key>.png`). For a color question show each color's most typical layout for the chosen format and type.
- **Strip** (a carousel / story-set sequence, and every review screen): the same script with `--strip`, one tile per slide (`01 Cover`, `02 Text`, …), each in its final color.
- **Delivery**: send the PNG with `SendUserFile` (`display: "render"`) when that tool exists (the desktop app and the web show it inline); otherwise print its absolute path as a Markdown link `[contact sheet](/abs/path.png)` (clickable in the terminal). Then ask the question.
- `AskUserQuestion` options also get a short text `preview`: the layout's fields and budgets, e.g. `title ≈24 chars · 2 lines\nphoto portrait 4:5\ntagline ≈9 chars`.
- Missing previews show as grey "no preview" tiles. If the script fails or there are no previews at all, skip the image and ask as plain text: previews never block a post.
