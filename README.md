# AI Website Organizer (local-first MVP)

Implements the core loop from the PRD: **Chrome bookmarks → synchronized library → visual cards → search**, scoped to run entirely on your machine with no external accounts (Google OAuth, Supabase, etc. are out of scope for this build — see "Scope" below).

## Structure

```
apps/
  web/         Next.js app — the frontend AND the backend (API routes + Prisma/SQLite)
  extension/   Manifest V3 Chrome extension (plain JS, load unpacked, no build step)
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [pnpm](https://pnpm.io/installation) 9.x (`npm install -g pnpm` if you don't have it)
- Google Chrome (or any Chromium-based browser) to load the extension

## Run it locally

```bash
git clone https://github.com/SandeepKapoor/ai-website-organizer.git
cd ai-website-organizer

pnpm install                              # installs deps for both apps/web and apps/extension
cp apps/web/.env.example apps/web/.env    # local DB config — not committed to git
pnpm db:push                              # creates your own empty local SQLite database
pnpm dev                                  # starts the web app at http://localhost:3000
```

Leave `pnpm dev` running in that terminal. Open [http://localhost:3000](http://localhost:3000) — the library will be empty until you either seed sample data or connect the Chrome extension (next section).

Optional: seed some sample bookmarks (with real metadata/thumbnails fetched live) so you can see the UI without installing the extension:

```bash
pnpm db:seed
```

> Every clone gets its own empty database (`apps/web/prisma/dev.db`, gitignored). No bookmarks or personal data are ever included in this repo — see [What gets shared vs. what stays local](#what-gets-shared-vs-what-stays-local) below.

### Connect the Chrome extension

The extension is what actually pulls bookmarks into the app — it isn't published on the Chrome Web Store, so it has to be loaded manually ("unpacked") in developer mode. This only takes a minute:

1. Make sure `pnpm dev` is still running (the extension talks to `http://localhost:3000` — it won't work if the app isn't up).
2. Open Chrome and go to `chrome://extensions` (paste that into the address bar).
3. Turn on **Developer mode** — the toggle is in the top-right corner of the page.
4. Click **Load unpacked** (this button only appears once Developer mode is on).
5. In the file picker, select the `apps/extension` folder from this cloned repo (select the folder itself, not a zip file).
6. The extension appears in your extensions list and a puzzle-piece icon shows up in the toolbar — click it and then pin the "AI Website Organizer" icon so it's always visible.
7. Click the extension icon → name the profile (e.g. "Personal") → **Connect this profile**.
8. It imports your full bookmark tree immediately, then enriches metadata/thumbnails in the background. Go to `http://localhost:3000` to watch cards appear and fill in.

From then on, any bookmark you create, rename, move, or delete in Chrome syncs automatically (§12 of the PRD) — no need to reopen the popup.

## What gets shared vs. what stays local

- **In this repo (shared with anyone who clones it):** the app's source code only.
- **Never in this repo:** your `.env` file and your `dev.db` SQLite database — both are in `.gitignore`. Your bookmarks, folders, thumbnails, and settings live only in `dev.db` on your own machine.
- Each person who clones this repo and follows the steps above gets a brand-new, empty database and only ever imports **their own** Chrome bookmarks when they connect the extension.

## What's implemented

- Full bookmark tree import via `chrome.bookmarks.getTree()`, preserving folder hierarchy.
- Live sync via `onCreated` / `onChanged` / `onMoved` / `onRemoved`.
- Website entity separate from Bookmark (dedupes metadata fetching across duplicate URLs, §36).
- Metadata pipeline: `<title>`, `meta[name=description]` → `og:description` priority, `og:image` → `twitter:image` → favicon → generated placeholder for thumbnails. Never invents a description.
- Progressive loading: bookmarks render immediately; metadata/thumbnails fill in async.
- Grid / masonry / list views, folder sidebar + breadcrumbs, search, sort, bookmark detail page.
- Settings: connected profiles (disconnect / delete imported data), account delete, light/dark/system theme.

## Scope decisions (local-first MVP)

- **Auth**: no real Google OAuth — a single local account is auto-created. Swapping in real auth later only touches `src/lib/currentUser.ts`.
- **Database**: SQLite via Prisma instead of hosted Postgres/Supabase — same schema shape as the PRD's data model, easy to point at Postgres later by changing the Prisma datasource.
- **Screenshot fallback** (PRD §17 priority 4) isn't implemented — no headless-browser/screenshot service is wired up. The thumbnail chain is og:image → twitter:image → favicon → generated placeholder, so cards never show a broken image.
- **Multi-user isolation / row-level security** isn't needed yet since there's only ever one local user, but the schema already scopes everything by `userId` → `ChromeProfile` for when that's added.
