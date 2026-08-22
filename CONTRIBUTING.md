# Contributing to Synapse

Thanks for your interest in contributing! This is a hackathon prototype, so
the workflow below is intentionally lightweight.

## Getting set up

```bash
git clone https://github.com/Kunal039/synapse-resilient-supply-chain.git
cd synapse-resilient-supply-chain
npm install
npm start
```

Then open http://localhost:3000.

## Branching

- `main` is protected — all changes land via pull request, not direct pushes.
- Create a branch off `main` named for what it does, e.g.
  `fix-blast-radius-scoring` or `add-tariff-scenario`.

## Making a change

1. Make your changes on your branch.
2. Keep commits focused — one logical change per commit, with a clear
   message describing *why*, not just *what*.
3. If you change `server.js`, anything in `src/`, or `public/*.js`, make
   sure it passes a syntax check locally before pushing:
   ```bash
   node --check server.js
   node --check src/graphEngine.js
   node --check public/app.js
   ```
4. Run the unit tests, and check coverage if you touched `src/graphEngine.js`:
   ```bash
   npm test
   npm run coverage
   ```
5. Push your branch and open a pull request against `main`.

## Pull request workflow

1. Open a PR from your branch into `main` with a description of what
   changed and why.
2. CI runs automatically (`.github/workflows/ci.yml`) — it installs
   dependencies, syntax-checks the source, runs the unit test suite with
   coverage, and smoke-tests that the server boots and serves
   `/api/graph` and `/api/scenarios` on Node 18.x and 20.x. All checks must
   pass before merging.
3. At least one approving code owner review is required before merging
   (repo admins may merge their own PRs once CI passes).
4. Once CI is green and the PR is approved, merge it. Prefer "Squash and
   merge" to keep `main` history readable.
5. Delete the branch after merging.

## Reporting issues

Open a GitHub issue describing the problem, the scenario you were running
(if applicable), and what you expected vs. what happened.
