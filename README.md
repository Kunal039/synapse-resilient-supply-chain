# Synapse — Live Control Tower (Hackathon Prototype)

[![CI](https://github.com/Kunal039/synapse-resilient-supply-chain/actions/workflows/ci.yml/badge.svg)](https://github.com/Kunal039/synapse-resilient-supply-chain/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![GitHub issues](https://img.shields.io/github/issues/Kunal039/synapse-resilient-supply-chain)](https://github.com/Kunal039/synapse-resilient-supply-chain/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Kunal039/synapse-resilient-supply-chain)](https://github.com/Kunal039/synapse-resilient-supply-chain/pulls)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FKunal039%2Fsynapse-resilient-supply-chain%2Fbadges%2Fcoverage.json)](https://github.com/Kunal039/synapse-resilient-supply-chain/actions/workflows/ci.yml)

A working demo of **Synapse**, an autonomous nervous system for resilient supply
chains. It's a real, running Node.js + browser app — not a mockup: a synthetic
multi-tier supply chain graph, a genuine forward-propagation "blast radius"
simulation, a scored Autonomy Gate, and a live control-tower dashboard you can
click through in front of judges.

Theme: **Resilient Supply Chains** — "When the world fractures, supply chains
must think for themselves."

## What it actually does (no smoke and mirrors)

- **The graph is real data**, not decoration: `data/supplyChain.json` defines ~27
  nodes (raw-material suppliers → component suppliers → assemblers → ports/routes
  → distribution centers → SKUs → customer regions) across three product lines
  (electronics, textile, auto), with qualified/unqualified backups and
  compliance/single-source risk flags baked into the data.
- **The propagation is computed**, not scripted per scenario: `src/graphEngine.js`
  does a forward breadth-first traversal from whichever node you disrupt,
  correctly respecting product-line boundaries so a disruption doesn't
  "leak" into unrelated SKUs just because they share a warehouse.
- **The blast-radius score is a transparent formula** over that real data
  (affected node count, units at risk, single-source penalty, cost-shock
  size, backup-supplier qualification/compliance flags) — you can read the
  exact math in `computeImpact()` and see the reasons listed live in the
  console.
- **The Autonomy Gate is a real threshold**: score < 40 auto-executes and
  logs the action; score ≥ 40 escalates to a human approval card with
  Approve/Reject.
- **The reasoning trail is generated**, either by a real LLM call (if you set
  `ANTHROPIC_API_KEY`) or by a deterministic template that still reads the
  live numbers — so the demo never breaks if venue Wi-Fi drops.

## Run it

Requires Node.js 18+ (works out of the box on the sandbox this was built in,
Node 22).

```bash
cd synapse-app
npm install
npm start
```

Then open **http://localhost:3000** in a browser.

### Optional: real LLM reasoning

By default the Explainability Agent uses a template (100% reliable, no
internet dependency — recommended for the actual live demo). If you want the
reasoning trail generated live by Claude instead, set an API key before
starting the server:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

If the key is missing, invalid, or the network call fails for any reason, it
silently falls back to the template — the demo never shows an error to the
audience.

## Live demo script (2 minutes, matches the pitch deck exactly)

1. **Open the dashboard.** Point out the multi-tier graph on the left —
   suppliers, ports/routes, distribution centers, SKUs, customer regions —
   and the empty console + zeroed stats bar on the right.
2. **Click "Suez Canal Route Closure."** Narrate as it streams:
   Sensing detects it → Simulation propagates the shock and shows the exact
   node/unit count affected → Decision proposes rerouting via the Cape of
   Good Hope → the Gate scores it 30/100, **below** the threshold, so it
   **auto-executes** → the graph turns green and a toast confirms it. Say:
   *"That's the routine 80% — Synapse just fixed it, no one was paged."*
3. **Click "Single-Source Chip Fab Outage."** Same pipeline, but the score
   comes back 58/100 — **above** threshold — because it's flagged as a
   single-source dependency. An approval card appears with the full
   reasoning trail. Click **Approve & Execute**. Say: *"This is the
   consequential 20% — Synapse still did all the work, but a human made the
   final call."*
4. **Click "Overnight Tariff Spike."** Score comes back 90/100 — the only
   fallback is an unqualified, compliance-flagged supplier — click
   **Reject** to show that a human can also say no, and the risk stays
   visibly open (red) on the graph rather than being silently marked done.
5. **Point at the stats bar**: disruptions handled, auto-executed vs.
   escalated — the whole "graduated autonomy" pitch in one glance.

## Project structure

```
synapse-app/
├── data/supplyChain.json   # the synthetic multi-tier supply chain + 3 disruption scenarios
├── src/graphEngine.js      # sensing/simulation/decision/gate/explain logic (the actual "AI")
├── server.js               # Express API
├── public/                 # the control-tower dashboard (cytoscape.js graph, console, approval UI)
└── package.json
```

## Extending it after the hackathon

- Swap `data/supplyChain.json` for a real ERP/supplier export.
- Add more scenarios to the `scenarios` block — no code changes needed as
  long as `targetNodeId` and `backupNodeId` exist in the graph.
- Wire `/api/disrupt` to a real news/weather/shipping feed instead of a
  button click, for genuine continuous sensing.
- Persist the action log (currently client-side only) to a database for a
  real audit trail.
