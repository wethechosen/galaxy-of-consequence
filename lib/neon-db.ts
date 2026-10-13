import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";

let pool: Pool | undefined;

export function neonConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function hostedRuntimeRequired() {
  return Boolean(process.env.VERCEL || process.env.GOC_ALLOW_HOSTED_WEB === "1");
}

function databasePool() {
  if (!neonConfigured()) throw Object.assign(new Error("Neon campaign persistence is not configured."), { status: 503 });
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
      query_timeout: 30_000,
      statement_timeout: 30_000,
    });
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}

export async function neonQuery<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
  const result = await databasePool().query(sql, [...params]);
  return result.rows as T[];
}

export async function withNeonTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await databasePool().connect();
  let begun = false;
  try {
    await client.query("BEGIN");
    begun = true;
    const result = await work(client);
    await client.query("COMMIT");
    begun = false;
    return result;
  } catch (error) {
    if (begun) {
      try { await client.query("ROLLBACK"); } catch { /* A disconnected transaction will roll back on the server. */ }
    }
    throw error;
  } finally {
    client.release();
  }
}
