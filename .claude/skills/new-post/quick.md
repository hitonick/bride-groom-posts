# /new-post — Quick mode

The operator gives a brief and photos; Claude decides the rest and shows **one** review screen. Same rules, same build and checks as Detailed mode: only the questions go away. Paths are relative to `bg-post-generator/`.

## 1. Brief and photos (one message)
Ask once: "Tell me what the post is about: the topic, the key message, the call to action, and if you like the format (feed post, carousel, story, story set) and a color or mood. Then add the photos: drag files or a folder in, paste image links, or name photos on the Figma Media page. (type cancel at any time)"
- Take photos as in `steps/images.md` (files, folder, URLs, Media names). No photos is fine: text-only layouts are used.
- Ask a follow-up only when something essential is missing: no topic at all, or a review post without the real review text (quote, name, rating; never invent them). One question at a time.
- Record the brief verbatim as `brief.text`, plus what you read from it (`topic`, `keyMessage`, `audience`, `tone`, `callToAction`, `format`, `color`).

## 2. Compose
Follow `steps/compose.md` → *Deciding automatically*: format, content type, color (with fallbacks and their warnings), slide count, layouts (no `sharedWith` layouts), photos to slots (lowest crop, enough resolution, `steps/images.md`).

## 3. Draft
Follow `steps/copy.md`: draft every text slot within its budget and the caption. Text the operator wrote in the brief in quotes ("…") is used as written: if it doesn't fit, ask (Shorten it · Pick another layout); never change it silently.

## 4. Photo checks
Heavy crop (> 0.25) or low resolution: the operator still decides, in the review (step 5) as one line per photo with the choice Use it · Another image · Pick another layout.

## 5. Review
`steps/review.md` with the Quick options: Build it · Change something · Switch to detailed · Cancel. Repeat until Build it.

## 6. Build
`steps/build.md` (upload, build, verify **and** screenshot, fix loop, run log with `mode: "quick"` and `brief`, final message).
