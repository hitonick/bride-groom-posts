# Step: previews (contact sheets and strips)

Show the operator what they are choosing, as one image per question, never one image per option. Paths are relative to `bg-post-generator/`.

- **Contact sheet**: `node scripts/contact-sheet.mjs runs/.cache/<runId>/<name>.png --title "<the question>" -- <preview> "<label>" …`. `<preview>` = `templates/<variant.preview>` (= `templates/previews/<variant key>.png`).
  - Show **every** candidate, numbered (`1 · Hashtag · Pink`), not only the 3–4 that fit in the `AskUserQuestion` options: the options list the first ones plus **More…**, and the operator can answer any number or name under **Other**.
  - A label is one line (wrapped as needed); add `\n` and a grey second line for details (`2 · Title + Pagination\ntitle ~41 · body ~139`).
  - Color question: one tile per color, showing the chosen content type's *typical layout* = the layout available in the most colors (ties: manifest order); for a color that lacks it, that color's first layout of the type.
- **Strip** (a carousel / story-set sequence, and every review screen): the same script with `--strip`, one tile per slide (`01 Cover`, `02 Text`, …), each in its final color. A single post is a one-tile strip.
- **Delivery**: send the PNG with `SendUserFile` (`display: "render"`) when that tool exists (the desktop app and the web show it inline); otherwise print its absolute path as a Markdown link `[contact sheet](/abs/path.png)` (clickable in the terminal). Then ask the question.
- `AskUserQuestion` options also get a short text `preview`: the layout's fields and budgets, e.g. `title ≈24 chars · 2 lines\nphoto portrait 4:5\ntagline ≈9 chars`.
- Missing previews show as grey "no preview" tiles. If the script fails or there are no previews at all, skip the image and ask as plain text: previews never block a post.
