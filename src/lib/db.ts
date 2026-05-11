// Database connection pool for PostgreSQL
import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === "development") {
    console.log("Executed query", { text: text.slice(0, 80), duration, rows: result.rowCount });
  }
  return result;
}

export async function setAuditUser(userId: string, client: Pool | PoolClient = pool) {
  await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
}

export default pool;
