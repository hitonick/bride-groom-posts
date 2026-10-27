# Bride&Groom post generator

Create Instagram posts for Bride&Groom by answering a few questions in Claude Code. Claude builds the post in Figma from the approved templates and places it on the **Generated** page, ready to review and export. You never design anything yourself.

Full operator guide (PDF): [`docs/Bride-Groom-Post-Generator-Operator-Guide.pdf`](docs/Bride-Groom-Post-Generator-Operator-Guide.pdf)

## Setup — 5 steps

Works the same in the **Claude desktop app (Code tab)** and in the **Claude Code terminal app**, on a personal (Pro/Max) or company (Team/Enterprise) Claude plan.

1. **Install Claude Code.**
   Desktop: download the Claude app from [claude.ai/download](https://claude.ai/download), sign in, open the **Code** tab.
   Terminal (macOS/Linux): `curl -fsSL https://claude.ai/install.sh | bash`. For Windows, see the [setup docs](https://docs.claude.com/en/docs/claude-code/setup).

2. **Open the repository root in Claude Code** (the folder that contains `bg-post-generator`, not this folder itself). `/new-post` and the Figma connection only load from there.
   Desktop: in the Code tab, choose the repository folder (for example `bride-groom-posts`).
   Terminal: `cd bride-groom-posts` then `claude`.
   If Claude Code asks whether to trust the folder or use the project's **figma** server, say yes.

3. **Connect your own Figma account.** Type `/mcp`, select **figma**, choose **Authenticate**, sign in to Figma in the browser and click **Allow access**. This works in both the terminal and the desktop app.
   In the desktop app you can instead connect the **Figma** connector (Settings → Connectors). Either one works.
   On company plans, an admin may first need to allow `https://mcp.figma.com/mcp`.

4. **Make sure you can edit the Figma file.** Open the [Bride&Groom templates file](https://www.figma.com/design/kjSjiNXV1FhVk8UBF9NY8t/Bride-Groom-templates-drafts). If it says *View only*, ask the owner to share it with you as **can edit**.

5. **Run `/new-post`** and answer the questions. Claude checks the connection, your access and the templates first, and tells you exactly what to fix if something is missing.

## Cloud sessions (claude.ai/code, GitHub-connected)

In a cloud session Claude runs in a container on Anthropic's side, not on your computer. Three things are different there.

**1. Connect Figma through the connector, once.** The project's own `figma` server (in `.mcp.json`) needs a browser sign-in, which a cloud session can't do, and its sign-in hosts (`www.figma.com`, `api.figma.com`) are usually blocked by the environment's network policy. Use the **Figma connector** instead:
1. Open [claude.ai/customize/connectors](https://claude.ai/customize/connectors), add **Figma** and sign in with your own Figma account.
2. Start a **new** cloud session (connectors are read when a session starts).
3. On Team/Enterprise plans an admin may first have to enable the Figma connector for the organization.
If Figma later asks to sign in again, reconnect it on the same page, not from inside the session.

**2. Network access (admin or environment owner).** Uploads go to `https://mcp.figma.com/mcp/upload/…`, which the default network policy allows. Two things need more:
- photos given as **links** (`https://…`) download only from hosts the environment allows;
- `/sync-templates` downloads template thumbnails from `www.figma.com`. When that host is blocked, it falls back to the image the Figma tool returns inline, so it still works, just with more steps.
To allow a host: the cloud environment menu in the session title bar → **Edit** → **Network access** → add it under *Allowed domains* ([steps](https://code.claude.com/docs/en/cloud-environments#network-access)).

**3. Permission prompts.** Cloud sessions run file edits without asking. Other tools ask unless a rule allows them:
- `.claude/settings.json` at the repository root pre-approves the Figma tools this project uses (`whoami`, `create_session`, `get_figma_skill`, `use_figma`, `upload_assets`, `get_screenshot`, `get_metadata`) and the project's own helper scripts. It is read in cloud sessions that have **one** repository; it is not applied in project threads.
- The Figma tools are listed under all three names they can have: `mcp__figma__…` (the project server), `mcp__claude_ai_Figma__…` (the connector, when Claude Code fetches it on your computer) and `mcp__Figma__…` (the connector, when the cloud host passes it in). These names contain no account id, so the file works for everyone.
- If your Figma tools show up under a different name (for example with a long id in it), the first prompt for each tool is a one-time step: choose **Always allow**. Or add the names to your own `~/.claude/settings.json` (not to this repository).
- Each skill also lists the same tools in its `allowed-tools`, which approves them for the turn that starts the skill.
- Downloads and uploads go through `scripts/fetch-image.sh` and `scripts/upload-asset.sh` rather than a bare `curl`. They only fetch images into `runs/.cache/` and only post images to Figma's upload endpoint, so they are safe to pre-approve. Nothing destructive is pre-approved.
- In the cloud you can also pick **Auto** in the mode menu next to the prompt box, when your organization allows it. It runs most tool calls without asking.

## Commands

| Command | What it does |
|---|---|
| `/new-post` | Builds and checks a new post on the Generated page. Asks which mode you want: |
| `/new-post detailed` | 9 short questions; you choose format, color, layouts and text, with pictures of the templates to pick from |
| `/new-post quick` | Describe the post and add photos; Claude picks the rest and shows you one summary to approve |
| `/bulk-posts` | Several posts at once (e.g. a week) from one brief file: one plan to approve, then each post is built, checked and linked. Start from `briefs/TEMPLATE.md` |
| `/edit-run` | Change an existing run (by run ID or Figma link); adds a Revisions entry |
| `/sync-templates` | Refresh the template list after designers change the Templates page (also runs automatically) |

During the questionnaire you can type `back` or `cancel` at any step.

## Nothing here is tied to an account

No tokens, personal IDs or paths are stored in this folder. Each person signs in to Figma with their own account (step 3). To switch Claude accounts, for example to a corporate one, sign in with the new account, open the same repository folder and repeat step 3. To work in a copy of the Figma file, put its key (the part of the link after `/design/`) in `config.json → fileKey` and run `/sync-templates`.

## What's in the folder

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Rules Claude always follows (brand safety, protected pages, Figma rules) |
| `../.mcp.json` (repository root) | The official Figma server (`https://mcp.figma.com/mcp`); no secrets |
| `config.json` | File key, page names, export sizes, layout, Instagram limits |
| `templates/manifest.json` | Template list generated by `/sync-templates`; never edit by hand |
| `templates/previews/` | A small picture of every template, shown while you choose (refreshed by `/sync-templates`) |
| `../.claude/skills/` (repository root) | `/new-post`, `/edit-run`, `/sync-templates` |
| `figma/` | Scripts Claude runs inside Figma (scan, stage photos, build, verify, read a run) |
| `scripts/` | Small local helpers (time zone, image size, image download/upload, contact sheets, previews, manifest assembly) |
| `briefs/` | Briefs for `/bulk-posts`; copy `TEMPLATE.md` to start |
| `runs/` | One JSON log per run (who, when, every answer, Figma node IDs); `runs/.cache/` holds temporary files and is not committed |
| `docs/` | Operator guide (PDF + its HTML source) |
