# IPTV Web Player

A static IPTV web player optimized for keyboard and TV-remote style navigation. It runs directly on GitHub Pages with no build step.

## Audit Summary

The repository was cleaned up into a more conventional static-site layout:

- App assets moved into `assets/`
- Playlist data moved into `data/`
- Unused playlist manifest generation removed from the GitHub Pages workflow
- Repository hygiene improved with a license and `.gitignore`

## Features

- Single base playlist loaded from `data/playlist.m3u8`
- Category-based channel browsing
- Global channel numbering with direct numeric channel selection
- Keyboard and remote-style navigation across categories, channel list, and player controls
- HLS playback via `hls.js`
- Responsive Telegram-inspired UI with fluid motion

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── data/
│   └── playlist.m3u8
├── index.html
├── LICENSE
└── README.md
```

## Local Development

Serve the repository root with any static HTTP server:

```bash
python -m http.server 8000
```

Or:

```bash
npx serve .
```

Open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. Go to GitHub repository settings.
3. Under Pages, set the source to GitHub Actions.
4. Push to `main`.
5. The workflow in `.github/workflows/deploy-pages.yml` deploys the static site.

## Notes

- The player expects a valid M3U playlist at `data/playlist.m3u8`.
- Streams are third-party sources and may go offline or change without notice.
- This repository contains a client only; there is no backend or build pipeline.
