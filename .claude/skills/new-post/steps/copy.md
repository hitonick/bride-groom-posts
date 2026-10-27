# Step: copy (text slots, drafting, caption)

Shared rules for every text a post gets: typed by the operator (Detailed 6/9), drafted by Claude (Detailed "Draft it from a brief", Quick mode, `/bulk-posts`) or changed later (`/edit-run`).

## Which slots
Every slot with `kind: "text"` that is not `auto` and not `role: "fixed"`.
- Budget = `capacity` chars over `lines` lines. For quotes and long text also say how much fills the design (`defaultLength`): much shorter text leaves a gap.
- `|` splits a title from its `-accent` part. Without `|` and with an accent slot, pick the last words that fit the accent line and show the split. For a mixed-font single node, pass the accent separately (`accent` in the build spec).
- `keep` (an operator answer, not a manifest flag) → keep the template text (record `source: "kept-default"`); offer it as a choice where it makes sense (story headlines, `button-label`). In Quick mode, list every kept template text on the review screen ("button: *Swipe* (template text)"), so **Build it** is the operator's explicit OK.
- `hide` (an operator answer) → hide a field that is not essential (a tagline, a source label): its path goes into the build spec's `hide`.
- List slots (`list` set): bullets come from the template; strip typed `1.` / `•`.
- Auto slots: `page-number` = two-digit slide index (a single post shows "01"; `steps/compose.md` prefers layouts without one); `tag-label` keeps its template text (`kept: true` in verify).
- Reviews: quote, author name, handle (if the layout shows one), source (Google/Facebook: pick a layout with that platform, or fill `source-label`), star rating (1..`stars`).

## Over budget
- Text the **operator** wrote: never change it without asking. Offer: Shorten it · Keep and check the real fit when building · Pick another layout.
- Text **Claude** drafted: shorten it yourself until it fits, then show it.
- Never change fonts, sizes, colors or boxes to make text fit.

## Drafting
- Inputs: topic, key message, audience, tone, call to action (Detailed asks them one at a time; Quick mode and `/bulk-posts` take them from the brief and assume a warm, friendly tone and the Bride&Groom audience when the brief doesn't say).
- Draft every text slot within its budget, in the brief's language, without emoji in slide text.
- Put the call to action where it fits: an outro / button slot when the budget allows, otherwise in the caption, and say so.
- **Never invent** review quotes, names, handles, ratings, statistics, prices, dates or client details. Reviews are always the operator's real text: if a review post has none, ask for it (Detailed mode skips drafting for reviews). Missing facts become a question, not a guess.
- Record each text with `source: "draft"` (or `typed`, `kept-default`, `auto`).

## Caption
- At most `config.instagram.hashtagsMax` hashtags; caption ≤ `config.instagram.captionMaxChars`.
- Detailed mode asks: Write my own · Draft it for me · Skip; Quick mode drafts it. Show the draft and let the operator use, edit or skip it.
