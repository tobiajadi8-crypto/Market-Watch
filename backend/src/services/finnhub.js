import { cached } from "../lib/cache.js";

// Optional: fills in fundamentals (P/E, EPS, beta...) when Yahoo's quoteSummary is unavailable.
// Free key at https://finnhub.io/register — set FINNHUB_API_KEY to enable.
const API_KEY = process.env.FINNHUB_API_KEY;
const BASE = "https://finnhub.io/api/v1";

export const finnhubEnabled = Boolean(API_KEY);

async function get(path) {
  const res = await fetch(`${BASE}${path}&token=${API_KEY}`);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

/** Returns fundamentals for a (US-listed) symbol, or null if Finnhub is off or has no data. */
export async function getFundamentals(symbol) {
  if (!API_KEY) return null;

  return cached(`finnhub:${symbol}`, 60 * 60 * 1000, async () => {
    const enc = encodeURIComponent(symbol);
    const [metricRes, profile] = await Promise.all([
      get(`/stock/metric?symbol=${enc}&metric=all`),
      get(`/stock/profile2?symbol=${enc}`),
    ]);
    const m = metricRes?.metric ?? {};
    const millions = (v) => (v != null ? v * 1e6 : null);

    return {
      marketCap: millions(profile?.marketCapitalization ?? m.marketCapitalization),
      peRatio: m.peTTM ?? m.peBasicExclExtraTTM ?? null,
      eps: m.epsTTM ?? m.epsBasicExclExtraItemsTTM ?? null,
      beta: m.beta ?? null,
      // Finnhub reports yield as a percentage (0.44 = 0.44%); we store it as a fraction like Yahoo.
      dividendYield: m.dividendYieldIndicatedAnnual != null ? m.dividendYieldIndicatedAnnual / 100 : null,
      averageVolume: millions(m["3MonthAverageTradingVolume"]),
      industry: profile?.finnhubIndustry ?? null,
      website: profile?.weburl || null,
    };
  });
}
