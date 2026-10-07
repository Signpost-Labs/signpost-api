# Promiscope Backend

This repository contains the Node.js and TypeScript API for Promiscope, a community project accountability platform built around transparent project commitments and progress updates. The product is being migrated to this purpose. The current API, database schema, and Soroban integrations still support the previous product workflows; project accountability features are not implemented here yet.

## Repository layout

- `src/` — API application, routes, middleware, and services.
- `tests/` — backend unit and integration tests.
- `contracts/` — Soroban contracts maintained with the backend.
- `migrations/` — database schema migrations.
- `clients/typescript/` — generated, typed API client.
- `docs/` — API, architecture, operations, and deployment documentation.

## Development

Use the Node.js version declared in `package.json` and copy `.env.example` to configure local services. From the repository root:

```sh
npm install
npm run dev          # Start the API in development mode
npm run build        # Compile TypeScript
npm test             # Run backend tests
npm run lint         # Run ESLint
```

Contract checks are available with `npm run test:contracts`; they require the pinned Rust toolchain and may require a Linux target. PostgreSQL integration tests use `npm run test:postgres` and need a configured database.

## Product migration

Treat existing routes, tables, and contract calls as legacy behavior. Before adding accountability features, define their data model and API in the relevant design docs, then implement and test the full flow. Do not present existing football scouting endpoints or records as Promiscope project data. Update the OpenAPI specification and regenerate the TypeScript client when API contracts change.

## Contributions and security

Use focused Conventional Commit messages such as `feat: add project update endpoint` or `fix: validate evidence references`. Pull requests should explain the behavior change, list validation performed, and link the relevant issue. Never commit secrets, populated environment files, or wallet credentials. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
