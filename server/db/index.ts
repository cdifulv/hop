import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as betterAuthSchema from "./schema/better-auth.generated"
import * as hopSchema from "./schema/hop"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

export const queryClient = postgres(databaseUrl, {
  max: 10,
})

export const db = drizzle(queryClient, {
  schema: {
    ...betterAuthSchema,
    ...hopSchema,
  },
})
