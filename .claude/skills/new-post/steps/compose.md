# Step: compose (format → content type → color → slides)

Shared rules for choosing templates. Detailed mode asks the operator at each point (questions 1/9–4/9); Quick mode and `/bulk-posts` decide with the same rules and show the result for approval. Every list comes from `templates/manifest.json`, never from memory.

## Format
Feed post (single) · Carousel · Story · Story set. Feed and carousel use `format: "feed"` templates; story and story set use `format: "story"`.

## Content type
Only types that exist for the format, from the manifest's template `type`s and layouts, in operator words: Review, Cover, Carousel article, Reviews carousel, Poll / Question / Opinion story…
- Feed post (single): Review or Cover layouts. `Carousel` layouts are content slides of a carousel and are not offered for a single post.
- Carousel article = Cover → Carousel content slides → Outro/Thank You.
- Reviews carousel = Review slides only.

## Color
- Candidates: colors of the eligible templates' variants, each with "N layouts", most layouts first; ties in the order of `config.scan.colorTokens`.
- `Default` is not a palette color: it is the color of layouts whose name has none (see the manifest's irregularities). List it last, as "The layout's own colors (N layouts)".
- **Fallback** when a layout lacks the color: the same hue lighter/darker (`Pink` ↔ `Light Pink`), then a neutral (`Light Color`, then `config.colorFallback.neutrals`). Never switch to another hue without asking. Tell the operator which slides fall back; record `colorFallback: "Pink → Light Color"` and a `color-fallback` warning.

## Slides
- Single post / story: one layout (group) among those available in the color. Layouts with a "Swipe" button (`button-label`, e.g. `Cover / Swipe`, `Cover / Swipe Centered`) invite swiping and are carousel covers only; for a single post prefer layouts without a `page-number` slot (on a single post it shows "01").
- Carousel / story set: number of slides (5 recommended; 3, 7; limits `config.instagram.carouselMinSlides`..`carouselMaxSlides`).
- **Auto-compose**: a varied sequence cover → content → outro, no layout twice in a row, layouts in the chosen color preferred. Shown as a strip (`steps/previews.md`) and as `01 Cover · Text · Pink` lines.
- Never auto-pick a layout with `sharedWith` text slots (see the manifest's irregularities). If the operator picks one, warn that two fields will show the same text.
- Grayscale (variant `grayscale` lists the image slots): say "this layout shows photos in black and white" before photos are chosen.

## Deciding automatically (Quick mode, /bulk-posts)
Use the brief and the photos; ask only when the brief can't settle something that matters.
1. **Format**: the one the brief names. Otherwise: several photos or a list / steps / tips → carousel; one photo and one message → feed post; a question, poll or "what do you think" → story; several story frames → story set.
2. **Content type**: a review or testimonial → Review (Reviews carousel when there are several); an article, tips or a guide → Carousel article; an announcement → Cover; a question or poll → the matching story type.
3. **Color**: the brief's color, else its mood (warm → Pink/Yellow family, calm → Blue/Purple family, elegant → Dark, clean → Light; when mood words point to different families, the first one wins). Otherwise the color with the most layouts for the content type.
   - For a carousel or story set count **all** the types the post uses (cover + content + outro) and prefer the color that needs the fewest fallbacks.
   - When content slides must fall back, use **one** neutral for all of them (prefer the neutral every chosen content layout has), not a mix of `Light` and `Light Color`, which look almost the same.
   - Apply the fallback rules above, with the same warnings.
4. **Slides**: as many as the content needs (a carousel article: cover + one slide per point + outro, within the limits; when unsure, 5). Auto-compose as above.
5. **Layouts for photos**: count the photos and pick layouts whose image slots they fill well. Prefer the layout where the photos' crops (`steps/images.md`) are lowest; a text-only layout for a slide without a photo; never leave a photo slot to its template placeholder when the brief gave enough photos. Use every photo the operator gave when a layout can take it with crop ≤ 0.25; a photo left out gets a `photo-unused` warning saying why, and the review asks whether that's fine.
6. **Fit**: prefer layouts whose text budgets (`capacity`, `lines`, `defaultLength`) suit the copy: long copy → a layout with a body slot, a short quote → a quote layout.
7. Record every decision as an `answers[]` entry with `step: "decide"`, `question` = what was decided and `answer` = the choice + one short reason (`"Color → Pink (brief: warm, 6 layouts)"`). Other Quick-mode steps: `draft`, `photo-check`, `review`, `review-change` (Detailed mode uses `1/9`…`9/9`).
