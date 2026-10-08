# Signpost Backend — API for Community Project Accountability on Stellar

![CI](https://github.com/Signpost-Labs/signpost-api/actions/workflows/ci.yml/badge.svg)
![Stellar](https://img.shields.io/badge/Stellar-Soroban-7D00FF?logo=stellar&logoColor=white)

Signpost helps communities track project commitments, milestones, updates, evidence, and responses. The frontend currently authenticates publishers with Stellar SEP-10 and stores accountability records off-chain.

## Table of Contents

- [Architecture and tree](#architecture-and-tree)
- [How the project uses Stellar](#how-the-project-uses-stellar)
- [Environment configuration](#environment-configuration)
- [Prerequisites](#prerequisites)
- [Development](#development)
- [Security](#security)

## Architecture and tree

The service starts in `src/index.ts`, builds its Express application in `src/app.ts`, and separates HTTP handlers under `src/routes/` from business logic in `src/services/`. Middleware, configuration, database access, and GraphQL support are organized in their corresponding `src/` modules. The event indexer consumes Soroban events and persists indexed state through the database layer. Stellar/Soroban calls and Pinata IPFS uploads are external integrations; Redis supports shared cache invalidation and security events.

- `src/` — API, middleware, services, GraphQL, and configuration.
- `tests/` — unit and integration tests.
- `db/` and `migrations/` — database drivers, schema, and migrations.
- `contracts/` — Soroban workspace maintained with this service.
- `clients/typescript/` — generated typed API client.
- `docs/` — authentication, data model, operations, and API references.

## How the project uses Stellar

Stellar SEP-10 provides wallet authentication in the current frontend flow. Existing Soroban contracts and the event indexer support the previous product; they do not yet store accountability projects, evidence, or community responses. A future Soroban revision anchor is under design and would attest to a record hash and timestamp, not prove the record's claims.

## Environment configuration

Copy `.env.example` to `.env`; its comments define defaults, accepted values, and production requirements. The main groups are Stellar (`NETWORK`, `HORIZON_URL`, `SOROBAN_RPC_URL`, contract IDs), auth (`JWT_SECRET`, SEP-10 and API-key settings), database (`DB_DRIVER`, `DB_PATH` or `DATABASE_URL`), IPFS (`PINATA_API_KEY`, `PINATA_SECRET`), and runtime/security settings (`PORT`, CORS, rate limits, logging). Use separate secrets per environment and never commit `.env`.

For local development, use the configured SQLite default and Stellar testnet endpoints. PostgreSQL deployments configure `DATABASE_URL`; Redis, Pinata, and signing credentials are needed only for the corresponding integrations. See [DEPLOYMENT.md](DEPLOYMENT.md) and the focused guides in [docs/](docs/README.md).

## Prerequisites

| Tool | Notes |
| --- | --- |
| **Node.js** | 22 (see `.nvmrc`) |
| **npm** | 10+ |
| **SQLite by default** | PostgreSQL for production |
| **Redis / Pinata** | optional integrations |

## Development

Use the Node version declared by `package.json`. Run `npm install`, `npm run dev`, `npm run build`, `npm test`, and `npm run lint` as needed. Contract checks use `npm run test:contracts` and the pinned Rust toolchain. PostgreSQL integration tests use `npm run test:postgres` with a configured database.

Update the OpenAPI contract and regenerate `clients/typescript/` when API types change. Pull requests should describe the behavior and compatibility impact, link an issue, and report validation performed. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Security

- **Never commit secrets** — keep keys, seed phrases, and `.env` files out of source control.
- **Testnet values have no real-world value**; treat testnet deployments as experimental.
- **Keys never leave the wallet** — signing is delegated to the user's Stellar wallet; the app does not store secret keys.
- Report vulnerabilities per `SECURITY.md` where present rather than opening a public issue.

## License

No `LICENSE` file is published in this repository yet.
