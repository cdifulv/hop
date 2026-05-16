import postgres from "postgres"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const databaseUrl = process.env.DATABASE_URL
const runSmoke = databaseUrl ? describe : describe.skip

let sql: postgres.Sql | undefined

beforeAll(() => {
  if (!databaseUrl) {
    return
  }

  sql = postgres(databaseUrl, { max: 1 })
})

afterAll(async () => {
  await sql?.end()
})

runSmoke("combined migration smoke", () => {
  it("creates hop and Better Auth tables in the same database", async () => {
    if (!sql) {
      throw new Error("DATABASE_URL is required for the migration smoke test")
    }

    const tables = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('links', 'user')
      order by table_name
    `

    expect(tables.map((table) => table.table_name)).toEqual(["links", "user"])
  })
})
