# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-08-22

### Added

- README "Contributing & branch protection" section summarizing the PR/CI/review requirements on `main` and the admin merge exemption.

### Changed

- README version badge now links to the [v1.0.0 release](https://github.com/Kunal039/synapse-resilient-supply-chain/releases/tag/v1.0.0) instead of `package.json`.

## [1.0.0] - 2026-08-22

### Added

- Initial working prototype: a synthetic multi-tier supply chain graph
  (`data/supplyChain.json`), forward-propagation blast-radius simulation
  and scoring (`src/graphEngine.js`), an Express API (`server.js`), and a
  live control-tower dashboard (`public/`) with three demo disruption
  scenarios.
- GitHub Actions CI workflow: installs dependencies, syntax-checks source,
  and smoke-tests that the server boots and serves `/api/graph` and
  `/api/scenarios` on Node 18.x and 20.x.
- `CONTRIBUTING.md` documenting the branching model and pull request
  workflow.
- `CODEOWNERS` designating a default code owner for the repo.
- README badges: CI status, MIT license, version, open issues, open pull
  requests, test coverage, and contributor count.
- Branch protection on `main`: required passing CI status checks, one
  approving code owner review, and no force pushes or branch deletion
  (repo admins exempt).
- Unit test suite (`test/graphEngine.test.js`, via Node's built-in test
  runner) covering graph traversal/leak prevention, blast-radius scoring,
  the autonomy gate threshold, mitigation action selection, and the
  LLM/template reasoning fallback — 87.82% line coverage, 100% function
  coverage. Coverage tooling via `c8`, run in CI alongside the smoke test.
- Self-updating coverage badge: an orphan `badges` branch (outside branch
  protection) holds a shields.io endpoint badge JSON that CI regenerates
  and pushes after every merge to `main`.
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
- `SECURITY.md` with private vulnerability reporting instructions.
- GitHub issue templates (bug report, feature request) and a pull request
  template.

[Unreleased]: https://github.com/Kunal039/synapse-resilient-supply-chain/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Kunal039/synapse-resilient-supply-chain/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Kunal039/synapse-resilient-supply-chain/releases/tag/v1.0.0
