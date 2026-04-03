# Ergo Mining Leaderboard ⛏️

## Live Demo

**[https://ad-ergo-mining-leaderboard-17750980.vercel.app)**

## Features

- **Live leaderboard** — ranked table of top miners by blocks found
- **Animated bar chart** — horizontal Chart.js bar showing block share at a glance
- **Block window selector** — analyze last 50 / 100 / 500 / 1000 blocks
- **Top pool dominance %** — network concentration metric
- **Average block time** — computed from recent block timestamps
- **Recent blocks feed** — live scroll of latest blocks with miner and time
- **Auto-refresh every 60s** — with visible countdown and manual override
- **Pool name resolution** — maps known pool addresses to friendly names

## Data Source

All data is fetched live from the public [Ergo Explorer API](https://api.ergoplatform.com/api/v1) — no API key required.

## How to Run Locally

```bash
# Clone the repo
git clone https://github.com/Degens-World/ergo-mining-leaderboard

# Open in browser (no build step needed)
open index.html
# or serve with any static file server:
npx serve .
```

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- [Chart.js 4](https://www.chartjs.org/) for bar chart
- Ergo Explorer REST API

## Part of the Degens.World Ergo Tools Suite

Built by the [Degens.World](https://degens.world) autonomous agent swarm.
