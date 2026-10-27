# Step: review (one screen before anything is uploaded or built)

Shared by Detailed 9/9, Quick mode and the per-post edits of `/bulk-posts`.

1. Send the strip of the chosen templates (`steps/previews.md`), one tile per slide in its final color; label each tile `NN Layout` + `\n` + `Color` (`(Pink → Light)` for a fallback). Say that the pictures show the template designs, not the new text and photos. Send it again after any change to layouts or colors.
2. A compact table: mode, format, content type, color (+ fallbacks), then each slide: layout, color, every field value (italic accent parts after `|`), image (file, orientation, crop), then caption, hashtags and warnings (one line each, plain words).
3. Ask:
   - Detailed: **Build it** · **Change something** (name the step) · **Cancel**.
   - Quick: **Build it** · **Change something** · **Switch to detailed** · **Cancel**.
   Before the screen, ask each open photo decision (heavy crop, low resolution, unused photo) as its own question; the screen then shows the answers.
4. **Change something** (Quick): the operator says it in plain words ("slide 3 title shorter", "use the other photo on the cover", "make it blue"). Apply it with the same rules (`steps/compose.md`, `steps/copy.md`, `steps/images.md`), show the changed lines as before → after, and show this screen again.
5. **Switch to detailed** keeps every decision so far as the answer to its question and continues the Detailed questionnaire at 1/9 with those answers pre-selected (the operator can accept each one).
6. **Cancel** → nothing is built or uploaded; write the run log with `status: "cancelled"` only if the operator already gave text or photos.
