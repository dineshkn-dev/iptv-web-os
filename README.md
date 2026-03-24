# South Indian IPTV Player

A web-based M3U player that works on GitHub Pages.

## Features

- Browse Tamil, Telugu, Kannada, Hindi & English channels
- Search and filter by channel name or group
- HLS (m3u8) stream playback via hls.js
- Dark theme, responsive layout

## Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Under "Build and deployment", set **Source** to **GitHub Actions**
4. Push to `main` (or merge a PR) — the workflow deploys automatically
5. Your site will be live at `https://<username>.github.io/<repo-name>/`

## Local Development

```bash
# Using Python
python -m http.server 8000

# Or using npx
npx serve .
```

Then open http://localhost:8000
