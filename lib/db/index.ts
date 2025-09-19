import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Only initialize database connection if DATABASE_URL is available
// This allows builds to succeed without database configuration
let db: ReturnType<typeof drizzle<typeof schema>>

if (process.env.DATABASE_URL) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })

  db = drizzle(pool, { schema })
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('DATABASE_URL not found. Database operations will fail at runtime.')
  // Create a mock db for build-time
  db = {} as ReturnType<typeof drizzle<typeof schema>>
} else {
  throw new Error('DATABASE_URL environment variable is required in production')
}

export { db }
export * from './schema'