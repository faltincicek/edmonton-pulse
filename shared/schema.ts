import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Cache table for aggregated 311 data fetched from Edmonton Open Data
export const dataCache = sqliteTable("data_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheKey: text("cache_key").notNull().unique(),
  data: text("data").notNull(), // JSON string
  fetchedAt: integer("fetched_at").notNull(), // Unix timestamp ms
});

export const insertDataCacheSchema = createInsertSchema(dataCache).omit({ id: true });
export type InsertDataCache = z.infer<typeof insertDataCacheSchema>;
export type DataCache = typeof dataCache.$inferSelect;
