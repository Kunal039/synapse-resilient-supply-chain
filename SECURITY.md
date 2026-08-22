# Security Policy

## Project status

Synapse is a personal project and working prototype (see [README.md](README.md)),
not a production system. It has no authentication, is meant to be run locally
for a demo, and should not be exposed to the public internet or used to
process real, sensitive supply-chain data as-is.

## Supported versions

There is a single active line of development on `main`. Only the latest
commit on `main` receives fixes.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a vulnerability

If you find a security issue (e.g. something that could lead to remote code
execution, path traversal, or leaking the `ANTHROPIC_API_KEY` from the
server environment), please report it privately rather than opening a
public issue:

- Preferred: open a [GitHub Security Advisory](https://github.com/Kunal039/synapse-resilient-supply-chain/security/advisories/new) for this repository.
- Alternative: email kunalmittal039@gmail.com with details and, if possible,
  steps to reproduce.

Please do not open a public issue or pull request for undisclosed security
vulnerabilities.

We'll acknowledge reports as soon as we can and aim to follow up with a fix
or a mitigation plan. Since this is a small, single-maintainer personal
project, response times are best-effort rather than SLA-backed.
