import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disable SSL for local PostgreSQL service
});
export const db = drizzle(pool, { schema });

// Test database connection on startup
(async () => {
  try {
    console.log("[DATABASE] Testing connection...");
    const result = await pool.query('SELECT 1 as test');
    console.log("[DATABASE] Connection successful:", result.rows[0]);
    
    // Test table access
    console.log("[DATABASE] Testing users table access...");
    const userCount = await db.select().from(schema.users).limit(1);
    console.log("[DATABASE] Users table accessible, sample count:", userCount.length);
  } catch (error) {
    console.error("[DATABASE] Connection or table access failed:", error);
  }
})();
