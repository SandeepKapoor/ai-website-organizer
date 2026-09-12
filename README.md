# AI Website Organizer (local-first MVP)

Implements the core loop from the PRD: **Chrome bookmarks → synchronized library → visual cards → search**, scoped to run entirely on your machine with no external accounts (Google OAuth, Supabase, etc. are out of scope for this build — see "Scope" below).

## Structure

```
apps/
  web/         Next.js app — the frontend AND the backend (API routes + Prisma/SQLite)
  extension/   Manifest V3 Chrome extension (plain JS, load unpacked, no build step)
```

## Run it

```bash
pnpm install
pnpm db:push        # create the local SQLite database
pnpm dev            # starts the web app at http://localhost:3000
```

Optional: seed some sample bookmarks (with real metadata/thumbnails fetched live) so you can see the UI without installing the extension:

```bash
pnpm db:seed
```

### Connect the Chrome extension

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `apps/extension`.
3. Make sure `pnpm dev` is running (the extension talks to `http://localhost:3000`).
4. Click the extension icon → name the profile (e.g. "Personal") → **Connect this profile**.
5. It imports your full bookmark tree immediately, then enriches metadata/thumbnails in the background. Open `http://localhost:3000` to watch cards appear and fill in.

From then on, any bookmark you create, rename, move, or delete in Chrome syncs automatically (§12 of the PRD) — no need to reopen the popup.

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
