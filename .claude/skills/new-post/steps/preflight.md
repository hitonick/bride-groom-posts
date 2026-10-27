# Step: preflight

Shared by `/new-post` (both modes), `/bulk-posts` and `/edit-run`. Paths are relative to `bg-post-generator/`.

1. Read `config.json` and `templates/manifest.json`.
2. Figma MCP tools available (`whoami`, `use_figma`…, from the project's `figma` server or a Figma connector)? If not: "Figma is not connected. Type `/mcp` → figma → Authenticate (or, in the desktop app, connect Figma under Settings → Connectors), then run the command again." In a cloud session (claude.ai/code) say instead: "Connect the Figma connector at claude.ai/customize/connectors, then start a new session" (README → *Cloud sessions*). Stop.
3. `whoami` → `handle` and `email` (requestedBy). Run ID handle = the Figma handle lowercased, non-alphanumerics → `-`.
4. `create_session` with `config.fileKey`; reuse its `sessionId` on every Figma call. `get_figma_skill` (`figma-use`) once; pass `skillNames: "resource:figma-use"` on every `use_figma`.
5. `use_figma` with `figma/scan-hash.js` (ARGS from `config.pages.templates` and `config.scan`). Then check:
   - pages `Templates`, `Media`, `Generated` exist (names from `config.pages`); otherwise name the missing page and stop. Keep the page ids (the Media page id is `currentPageId` for uploads);
   - `hash` and `scannerVersion` equal the manifest's. If not, say "Templates changed, refreshing the list…" and run the `/sync-templates` procedure, then reload the manifest;
   - `lookHash` equals the manifest's. If only this differs, the designs changed but not their fields: say "Template designs changed, refreshing the previews…" and run the `/sync-templates` procedure (it re-exports only the changed previews).
6. Permission or seat errors at any point: stop and say exactly which access is missing ("your Figma account <email> needs **can edit** on the file").
7. `bash scripts/local-time.sh` → `stamp`, `iso`, `local`, `tz`. Run ID = `BG-<stamp>-<handle>` (e.g. `BG-20261023-1430-anna`); `/bulk-posts` appends `-01`…`-NN`.
