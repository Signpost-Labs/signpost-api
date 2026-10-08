# Promiscope Backend — Stellar Community Project Accountability

Promiscope is a community project accountability platform concept. The current API is a mature Node.js service, but its routes and data models still serve the prior product domain; project commitments, evidence submissions, and community review are not implemented yet.

## Architecture and tree

The service starts in `src/index.ts`, builds its Express application in `src/app.ts`, and separates HTTP handlers under `src/routes/` from business logic in `src/services/`. Middleware, configuration, database access, and GraphQL support are organized in their corresponding `src/` modules. The event indexer consumes Soroban events and persists indexed state through the database layer. Stellar/Soroban calls and Pinata IPFS uploads are external integrations; Redis supports shared cache invalidation and security events.

- `src/` — API, middleware, services, GraphQL, and configuration.
- `tests/` — unit and integration tests.
- `db/` and `migrations/` — database drivers, schema, and migrations.
- `contracts/` — Soroban workspace maintained with this service.
- `clients/typescript/` — generated typed API client.
- `docs/` — authentication, data model, operations, and API references.

## How the project uses Stellar

The current accountability flow uses SEP-10 wallet authentication in the frontend to attribute publishing and updates to a Stellar address. The existing Soroban contracts and event indexer support the prior product domain; they do not currently store accountability projects, evidence, or community reviews. The new project records are off-chain, and this API has not yet been migrated to serve them. Backend support is tracked in [issue #13](https://github.com/Stellar-Promiscope/promiscope-backend/issues/13). Future Soroban anchoring of revision hashes is under design and would attest to a published hash and time, not prove a project's claims.

## Environment configuration

Copy `.env.example` to `.env`; its comments define defaults, accepted values, and production requirements. The main groups are Stellar (`NETWORK`, `HORIZON_URL`, `SOROBAN_RPC_URL`, contract IDs), auth (`JWT_SECRET`, SEP-10 and API-key settings), database (`DB_DRIVER`, `DB_PATH` or `DATABASE_URL`), IPFS (`PINATA_API_KEY`, `PINATA_SECRET`), and runtime/security settings (`PORT`, CORS, rate limits, logging). Use separate secrets per environment and never commit `.env`.

For local development, use the configured SQLite default and Stellar testnet endpoints. PostgreSQL deployments configure `DATABASE_URL`; Redis, Pinata, and signing credentials are needed only for the corresponding integrations. See [DEPLOYMENT.md](DEPLOYMENT.md) and the focused guides in [docs/](docs/README.md).

## Development

Use the Node version declared by `package.json`. Run `npm install`, `npm run dev`, `npm run build`, `npm test`, and `npm run lint` as needed. Contract checks use `npm run test:contracts` and the pinned Rust toolchain. PostgreSQL integration tests use `npm run test:postgres` with a configured database.

Update the OpenAPI contract and regenerate `clients/typescript/` when API types change. Pull requests should describe the behavior and compatibility impact, link an issue, and report validation performed. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
