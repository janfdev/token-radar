# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/janfdev/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/janfdev/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over a frozen DefiLlama snapshot (14 Nov 2026):
200 pre-token protocols ranked by an implied value calibrated per
category from live-token peers, with a farm plan for each and a
self-contained dashboard.

`main.ts` (Node, standard library only) reads the sealed snapshot,
scores every pre-token protocol with the model in `lib/model.ts`
(model `radar-2`), and writes the ranked board to `/output/board.json`,
the dashboard data to `/output/data.js`, a copy of `dashboard/` and
`screenshots/`, and the entry dossier.

How the model prices a protocol with no token:

- **Multiple.** Each category's live-token protocols give a market
  multiple: the median market-cap / TVL of that category's traded
  peers (128 peers; the global median is x0.21). A pre-token row is
  priced with its own category's multiple — Dexs x0.34, CDP x0.17,
  Cross Chain Bridge x1.22, and so on — falling back to the global
  median when a category has fewer than three traded peers, clamped
  to x0.05–x3.0.
- **Growth.** Seven-day TVL change, clamped to −60%…+120%, at half
  weight.
- **Maturity.** How long the protocol has run with no token, from
  0.6× at listing to 1.0× at three years.

The dashboard is sortable and filterable (search, category, chain),
separates the live-token protocols it calibrated from, and opens a
detail view per protocol that shows the multiple the row used, its
source, and the farm plan — recomputed in the page with the same
function that wrote the board, so the two always agree.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=7vky9s9c&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
