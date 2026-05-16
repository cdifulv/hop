# hop

A self-hosted URL shortener. One Deployment serves a single organization. Anyone can shorten a URL without signing in; signing in lets a person see and manage the Links they created.

See `CONTEXT.md` for the domain language and `docs/adr/` for the architectural decisions that govern this codebase.

## Stack

- **Runtime:** Nuxt 4 with the Nitro server (`typescript: strict`)
- **Database:** PostgreSQL only
- **ORM:** Drizzle + drizzle-kit
- **Auth:** Better Auth (SSO via the Better Auth SSO plugin)

## Database Setup

hop uses Postgres, Drizzle migrations, and Better Auth's Drizzle schema generator.
There are two schema sources, but only one migration history under `drizzle/`.

### Postgres via Docker

Run on the host (the project and Docker run on the host, not in the agent container). These credentials match the example `DATABASE_URL` below:

```bash
docker run --name hop-postgres \
  -e POSTGRES_USER=hop \
  -e POSTGRES_PASSWORD=hop \
  -e POSTGRES_DB=hop \
  -p 5432:5432 \
  -d postgres:16
```

`docker stop hop-postgres` / `docker start hop-postgres` to pause and resume; `docker rm -f hop-postgres` to delete the container and its data for a clean slate.

### Fresh Setup

Run these commands on the macOS host, not from the agent container:

```bash
npm install
DATABASE_URL="postgres://hop:hop@localhost:5432/hop" npm run db:setup
DATABASE_URL="postgres://hop:hop@localhost:5432/hop" npm run test:db:smoke
```

The database scripts also load `.env` automatically, so this is equivalent if
`.env` contains `DATABASE_URL="postgres://hop:hop@localhost:5432/hop"`:

```bash
npm run db:setup
npm run test:db:smoke
```

The role and database named in `DATABASE_URL` must already exist. For
`postgres://hop:hop@localhost:5432/hop`, either start the Docker database above
or create the role and database once:

```bash
psql postgres -c "create role hop login password 'hop';"
psql postgres -c "create database hop owner hop;"
```

If your local Postgres already uses your macOS username, set `DATABASE_URL` to
that existing role/database instead.

`npm install` needs no flags: a checked-in `.npmrc` sets `legacy-peer-deps=true`
to absorb a spurious peer conflict (`better-auth`'s optional `@sveltejs/kit`
peer transitively wants `vite@8`, while the Nuxt 4 stack pins `vite@7`; hop
uses better-auth's Drizzle adapter, not the Svelte one). If an earlier install
attempt left `node_modules` partly populated, reset once before installing:

```bash
rm -rf node_modules package-lock.json
npm install
```

`db:setup` is the repeatable setup path:

1. `auth generate --config ./server/auth/config.ts --output ./server/db/schema/better-auth.generated.ts --yes`
   regenerates Better Auth's Drizzle schema from the Better Auth config.
2. `drizzle-kit generate` folds both `server/db/schema/hop.ts` and the generated Better Auth schema into the Drizzle migration history.
3. `drizzle-kit migrate` applies only unapplied migrations, so rerunning against the same database is safe.

Do not edit `server/db/schema/better-auth.generated.ts` by hand. If Better Auth config or plugins change, rerun `npm run db:generate` and commit the resulting schema and migration files together.

### Smoke Test

`npm run test:db:smoke` expects `DATABASE_URL` to point at a database that has already been migrated. It asserts that a hop table (`links`) and a Better Auth table (`user`) both exist, proving the combined migration path populated one database.

Without `DATABASE_URL`, the smoke test is skipped so the unit-test harness remains runnable in local TypeScript-only contexts.
