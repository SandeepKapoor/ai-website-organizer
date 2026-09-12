# AI Website Organizer

Turns your Chrome bookmarks into a searchable visual library. Install the companion Chrome extension, connect it, and your bookmarks import automatically — with titles, descriptions, and thumbnails pulled in for each one — into a web app you browse and search locally.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [pnpm](https://pnpm.io/installation) 9.x (`npm install -g pnpm` if you don't have it)
- Google Chrome (or any Chromium-based browser)

## Setup

```bash
git clone https://github.com/SandeepKapoor/ai-website-organizer.git
cd ai-website-organizer

pnpm install
cp apps/web/.env.example apps/web/.env
pnpm db:push
pnpm dev
```

Leave `pnpm dev` running — it starts the app at [http://localhost:3000](http://localhost:3000). The library will be empty until you connect the Chrome extension below.

## Install the Chrome extension

1. Make sure `pnpm dev` is still running.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the `apps/extension` folder from this repo.
6. Click the extension icon in your toolbar (pin it first if it's hidden) → name your profile → **Connect this profile**.
7. Your bookmarks import immediately, then fill in with metadata and thumbnails. Open [http://localhost:3000](http://localhost:3000) to watch them appear.

From then on, any bookmark you create, rename, move, or delete in Chrome syncs automatically — no need to reopen the extension.

## Using the app

- **Browse** your bookmarks as cards in grid, masonry, or list view, organized by folder.
- **Search** across titles, descriptions, and URLs.
- **Sort** by date added, title, or folder.
- Click a card to open its **detail page**, or manage connected profiles and themes in **Settings**.
