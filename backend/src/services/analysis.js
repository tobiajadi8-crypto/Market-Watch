import { analyzeCandles, normalizeComparison } from "../lib/analysis.js";
import { RANGES, getDailyCandles, getHistory, getQuotes } from "./yahoo.js";

const DAY = 24 * 60 * 60 * 1000;

// Analysis runs on daily closes, so it supports the chart ranges that use daily candles.
export const ANALYSIS_RANGES = ["1mo", "6mo", "1y"];
export const FORECAST_DAYS = [5, 10, 20];

// Extra history fetched before the window so the 50-day average exists from the first day shown.
// 50 trading days is about 72 calendar days; the rest covers holidays.
const WARMUP = 100 * DAY;

export async function getAnalysis(symbol, range, days) {
  const lookback = RANGES[range].lookback;
  const candles = await getDailyCandles(symbol, lookback + WARMUP);
  if (candles.length < 2) {
    const err = new Error(`No data found for ${symbol}`);
    err.status = 404;
    throw err;
  }
  const windowStart = Date.now() - lookback;
  return { symbol, range, ...analyzeCandles(candles, windowStart, days) };
}

export async function getComparison(symbols, range) {
  const [histories, quotes] = await Promise.all([
    Promise.allSettled(symbols.map((s) => getHistory(s, range))),
    getQuotes(symbols).catch(() => []),
  ]);

  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const series = [];
  const errors = [];
  histories.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.points.length) series.push(r.value);
    else errors.push({ symbol: symbols[i], error: r.reason?.message ?? "No data for this range" });
  });
  // Nothing loaded at all: surface the error instead of an empty chart.
  if (!series.length) throw histories.find((r) => r.status === "rejected")?.reason ?? new Error("No data found");

  const { stats, points } = normalizeComparison(series, RANGES[range].interval);
  return {
    range,
    interval: RANGES[range].interval,
    series: stats.map((s) => ({
      ...s,
      name: bySymbol.get(s.symbol)?.name ?? s.symbol,
      currency: bySymbol.get(s.symbol)?.currency ?? "USD",
    })),
    points,
    errors,
  };
}
