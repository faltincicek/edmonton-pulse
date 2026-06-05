import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";

const SOCRATA_BASE = "https://data.edmonton.ca/resource/q7ua-agfg.json";
const GEO_BASE = "https://data.edmonton.ca/resource/65fr-66s6.geojson";
// Cache TTL: 6 hours for regular data, 24h for geo
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GEO_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchWithCache(
  key: string,
  url: string,
  ttlMs: number
): Promise<unknown> {
  const cached = storage.getCache(key);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) {
    return JSON.parse(cached.data);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  const data = await res.json();
  storage.setCache(key, JSON.stringify(data));
  return data;
}

export function registerRoutes(httpServer: Server, app: Express) {
  // ── Cache info (last fetch time) ────────────────────────────────────────────
  app.get("/api/cache-info", (_req, res) => {
    try {
      const keys = storage.getAllCacheKeys();
      const fetchTimes = keys
        .map((key) => {
          const cached = storage.getCache(key);
          return cached ? cached.fetchedAt : 0;
        })
        .filter((t) => t > 0);
      const latestFetch = fetchTimes.length > 0 ? Math.max(...fetchTimes) : null;
      const now = new Date();
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthFraction = dayOfMonth / daysInMonth;
      res.json({ latestFetch, dayOfMonth, daysInMonth, monthFraction });
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Service categories ──────────────────────────────────────────────────────
  app.get("/api/categories", async (_req, res) => {
    try {
      const url =
        `${SOCRATA_BASE}?$select=service_category,count(*)%20as%20cnt` +
        `&$group=service_category&$order=cnt%20DESC&$limit=100`;
      const data = await fetchWithCache("categories", url, CACHE_TTL_MS);
      res.json(data);
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Monthly trend for a given category ─────────────────────────────────────
  app.get("/api/trend", async (req, res) => {
    try {
      const category = (req.query.category as string) || "Potholes";
      const encodedCat = encodeURIComponent(category);
      const url =
        `${SOCRATA_BASE}?$select=year,month_number,month,count(*)%20as%20cnt` +
        `&$group=year,month_number,month` +
        `&$where=service_category=%27${encodedCat}%27` +
        `&$order=year%20ASC,month_number%20ASC&$limit=500`;
      const key = `trend_${category}`;
      const data = await fetchWithCache(key, url, CACHE_TTL_MS);
      res.json(data);
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Neighbourhood breakdown for a category (last 3 years) ──────────────────
  app.get("/api/neighbourhood", async (req, res) => {
    try {
      const category = (req.query.category as string) || "Potholes";
      const encodedCat = encodeURIComponent(category);
      const url =
        `${SOCRATA_BASE}?$select=neighbourhood,neighbourhood_id,count(*)%20as%20cnt` +
        `&$group=neighbourhood,neighbourhood_id` +
        `&$where=service_category=%27${encodedCat}%27` +
        `&$order=cnt%20DESC&$limit=500`;
      const key = `nbhd_${category}`;
      const data = await fetchWithCache(key, url, CACHE_TTL_MS);
      res.json(data);
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Neighbourhood monthly trend (for detail panel) ─────────────────────────
  app.get("/api/neighbourhood-trend", async (req, res) => {
    try {
      const category = (req.query.category as string) || "Potholes";
      const neighbourhood = (req.query.neighbourhood as string) || "";
      const encodedCat = encodeURIComponent(category);
      const encodedNbhd = encodeURIComponent(neighbourhood);
      const url =
        `${SOCRATA_BASE}?$select=year,month_number,month,count(*)%20as%20cnt` +
        `&$group=year,month_number,month` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20neighbourhood=%27${encodedNbhd}%27` +
        `&$order=year%20ASC,month_number%20ASC&$limit=200`;
      const key = `nbhd_trend_${category}_${neighbourhood}`;
      const data = await fetchWithCache(key, url, CACHE_TTL_MS);
      res.json(data);
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── City-wide stats summary ─────────────────────────────────────────────────
  app.get("/api/summary", async (req, res) => {
    try {
      const category = (req.query.category as string) || "Potholes";
      const encodedCat = encodeURIComponent(category);
      // This month last year vs this month this year
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const prevYear = currentYear - 1;

      const urlThisMonth =
        `${SOCRATA_BASE}?$select=count(*)%20as%20cnt` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20year=%27${currentYear}%27%20AND%20month_number=%27${currentMonth}%27`;
      const urlLastYearSameMonth =
        `${SOCRATA_BASE}?$select=count(*)%20as%20cnt` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20year=%27${prevYear}%27%20AND%20month_number=%27${currentMonth}%27`;
      const urlYTD =
        `${SOCRATA_BASE}?$select=count(*)%20as%20cnt` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20year=%27${currentYear}%27`;
      const urlYTDPrev =
        `${SOCRATA_BASE}?$select=count(*)%20as%20cnt` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20year=%27${prevYear}%27%20AND%20month_number%3C=%27${currentMonth}%27`;

      const [thisMonth, lastYearSameMonth, ytd, ytdPrev] = await Promise.all([
        fetchWithCache(`summary_thismonth_${category}_${currentYear}_${currentMonth}`, urlThisMonth, CACHE_TTL_MS),
        fetchWithCache(`summary_lasm_${category}_${prevYear}_${currentMonth}`, urlLastYearSameMonth, CACHE_TTL_MS),
        fetchWithCache(`summary_ytd_${category}_${currentYear}`, urlYTD, CACHE_TTL_MS),
        fetchWithCache(`summary_ytdprev_${category}_${prevYear}_${currentMonth}`, urlYTDPrev, CACHE_TTL_MS),
      ]);

      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      res.json({ thisMonth, lastYearSameMonth, ytd, ytdPrev, currentYear, currentMonth, prevYear, dayOfMonth, daysInMonth });
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Seasonal baseline: average by month across all years ───────────────────
  app.get("/api/seasonal", async (req, res) => {
    try {
      const category = (req.query.category as string) || "Potholes";
      const encodedCat = encodeURIComponent(category);
      const url =
        `${SOCRATA_BASE}?$select=month_number,month,avg(count)%20as%20avg_cnt` +
        `&$query=SELECT%20month_number%2Cmonth%2Cavg(cnt)%20as%20avg_cnt%20FROM%20(SELECT%20year%2Cmonth_number%2Cmonth%2Ccount(*)%20as%20cnt%20FROM%20q7ua-agfg%20WHERE%20service_category%3D%27${encodedCat}%27%20GROUP%20BY%20year%2Cmonth_number%2Cmonth)%20GROUP%20BY%20month_number%2Cmonth%20ORDER%20BY%20month_number`;
      const key = `seasonal_${category}`;
      // Try this approach; if fails, compute from trend data
      try {
        const data = await fetchWithCache(key, url, CACHE_TTL_MS);
        res.json(data);
      } catch {
        // Fallback: compute from trend data
        const trendKey = `trend_${category}`;
        const trendUrl =
          `${SOCRATA_BASE}?$select=year,month_number,month,count(*)%20as%20cnt` +
          `&$group=year,month_number,month` +
          `&$where=service_category=%27${encodedCat}%27` +
          `&$order=year%20ASC,month_number%20ASC&$limit=500`;
        const trendData = (await fetchWithCache(trendKey, trendUrl, CACHE_TTL_MS)) as Array<{
          year: string;
          month_number: string;
          month: string;
          cnt: string;
        }>;
        // Group by month
        const byMonth: Record<string, { month: string; total: number; years: number }> = {};
        for (const row of trendData) {
          const mn = row.month_number;
          if (!byMonth[mn]) byMonth[mn] = { month: row.month, total: 0, years: 0 };
          byMonth[mn].total += Number(row.cnt);
          byMonth[mn].years += 1;
        }
        const result = Object.entries(byMonth)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([month_number, v]) => ({
            month_number,
            month: v.month,
            avg_cnt: v.years > 0 ? (v.total / v.years).toFixed(1) : "0",
          }));
        storage.setCache(key, JSON.stringify(result));
        res.json(result);
      }
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Resolution stats ─────────────────────────────────────────────────────────
  // Returns: open count, closed count, avg days to close, status_detail breakdown
  app.get("/api/resolution", async (req, res) => {
    try {
      const category = (req.query.category as string) || "Potholes";
      const encodedCat = encodeURIComponent(category);

      const urlStatus =
        `${SOCRATA_BASE}?$select=request_status,count(*)%20as%20cnt` +
        `&$where=service_category=%27${encodedCat}%27` +
        `&$group=request_status`;

      const urlDetail =
        `${SOCRATA_BASE}?$select=status_detail,count(*)%20as%20cnt` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20request_status=%27Closed%27` +
        `&$group=status_detail&$order=cnt%20DESC&$limit=20`;

      const urlAvgDays =
        `${SOCRATA_BASE}?$select=avg(date_diff_d(date_closed,date_created))%20as%20avg_days` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20request_status=%27Closed%27%20AND%20date_closed%20IS%20NOT%20NULL`;

      const [statusData, detailData, avgDaysData] = await Promise.all([
        fetchWithCache(`resolution_status_${category}`, urlStatus, CACHE_TTL_MS),
        fetchWithCache(`resolution_detail_${category}`, urlDetail, CACHE_TTL_MS),
        fetchWithCache(`resolution_avgdays_${category}`, urlAvgDays, CACHE_TTL_MS),
      ]);

      res.json({ statusData, detailData, avgDaysData });
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Open (unresolved) reports by neighbourhood ──────────────────────────────
  app.get("/api/neighbourhood-open", async (req, res) => {
    try {
      const category = (req.query.category as string) || "Potholes";
      const encodedCat = encodeURIComponent(category);
      const url =
        `${SOCRATA_BASE}?$select=neighbourhood,neighbourhood_id,count(*)%20as%20cnt` +
        `&$group=neighbourhood,neighbourhood_id` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20request_status=%27Open%27` +
        `&$order=cnt%20DESC&$limit=300`;
      const key = `nbhd_open_${category}`;
      const data = await fetchWithCache(key, url, CACHE_TTL_MS);
      res.json(data);
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Neighbourhoods GeoJSON ──────────────────────────────────────────────────
  app.get("/api/geo/neighbourhoods", async (_req, res) => {
    try {
      const url = `${GEO_BASE}?$limit=500`;
      const data = await fetchWithCache("geo_neighbourhoods", url, GEO_TTL_MS);
      res.json(data);
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Top neighbourhoods with YoY comparison ──────────────────────────────────
  app.get("/api/neighbourhood-yoy", async (req, res) => {
    try {
      const category = (req.query.category as string) || "Potholes";
      const encodedCat = encodeURIComponent(category);
      const now = new Date();
      const currentYear = now.getFullYear();
      const prevYear = currentYear - 1;

      const urlCurrent =
        `${SOCRATA_BASE}?$select=neighbourhood,neighbourhood_id,nbhd_latitude,nbhd_longitude,count(*)%20as%20cnt` +
        `&$group=neighbourhood,neighbourhood_id,nbhd_latitude,nbhd_longitude` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20year=%27${currentYear}%27` +
        `&$order=cnt%20DESC&$limit=300`;
      const urlPrev =
        `${SOCRATA_BASE}?$select=neighbourhood,neighbourhood_id,count(*)%20as%20cnt` +
        `&$group=neighbourhood,neighbourhood_id` +
        `&$where=service_category=%27${encodedCat}%27%20AND%20year=%27${prevYear}%27` +
        `&$order=cnt%20DESC&$limit=300`;

      const [current, prev] = await Promise.all([
        fetchWithCache(`nbhd_yoy_current_${category}_${currentYear}`, urlCurrent, CACHE_TTL_MS),
        fetchWithCache(`nbhd_yoy_prev_${category}_${prevYear}`, urlPrev, CACHE_TTL_MS),
      ]);

      res.json({ current, prev, currentYear, prevYear });
    } catch (e: unknown) {
      console.error("[API error]", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

}
