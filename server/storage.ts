import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { dataCache, type DataCache, type InsertDataCache } from "@shared/schema";
import { eq } from "drizzle-orm";

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

// Create tables if not exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS data_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  )
`);

export interface IStorage {
  getCache(key: string): DataCache | undefined;
  setCache(key: string, data: string): DataCache;
  getAllCacheKeys(): string[];
}

export class Storage implements IStorage {
  getCache(key: string): DataCache | undefined {
    return db.select().from(dataCache).where(eq(dataCache.cacheKey, key)).get();
  }

  setCache(key: string, data: string): DataCache {
    const now = Date.now();
    // Upsert using parameterized prepared statement to prevent SQL injection
    sqlite.prepare(
      `INSERT INTO data_cache (cache_key, data, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`
    ).run(key, data, now);
    return db.select().from(dataCache).where(eq(dataCache.cacheKey, key)).get()!;
  }

  getAllCacheKeys(): string[] {
    const rows = db.select({ key: dataCache.cacheKey }).from(dataCache).all();
    return rows.map((r) => r.key);
  }
}

export const storage = new Storage();
