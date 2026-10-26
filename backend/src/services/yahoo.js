import YahooFinance from "yahoo-finance2";
import { cached } from "../lib/cache.js";
import { getFundamentals } from "./finnhub.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

// Chart range -> how far back to look and which candle interval to use.
export const RANGES = {
  "1d": { lookback: 1 * DAY, interval: "5m" },
  "5d": { lookback: 5 * DAY, interval: "30m" },
  "1mo": { lookback: 31 * DAY, interval: "1d" },
  "6mo": { lookback: 183 * DAY, interval: "1d" },
  "1y": { lookback: 365 * DAY, interval: "1d" },
  "5y": { lookback: 5 * 365 * DAY, interval: "1wk" },
};

export const INDICES = ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX"];

function toQuote(q) {
  return {
    symbol: q.symbol,
    name: q.longName ?? q.shortName ?? q.symbol,
    price: q.regularMarketPrice ?? null,
    change: q.regularMarketChange ?? null,
    changePercent: q.regularMarketChangePercent ?? null,
    previousClose: q.regularMarketPreviousClose ?? null,
    open: q.regularMarketOpen ?? null,
    dayHigh: q.regularMarketDayHigh ?? null,
    dayLow: q.regularMarketDayLow ?? null,
    volume: q.regularMarketVolume ?? null,
    marketCap: q.marketCap ?? null,
    currency: q.currency ?? "USD",
    exchange: q.fullExchangeName ?? q.exchange ?? null,
    marketState: q.marketState ?? null,
  };
}

// Yahoo's quote/quoteSummary endpoints need a "crumb" token, which Yahoo often refuses to
// cloud servers (HTTP 429). The chart and search endpoints don't need one, so when the crumb
// is blocked we rebuild the data from those instead, and skip crumb calls for a while.
let crumbBlockedUntil = process.env.YAHOO_NO_CRUMB ? Infinity : 0;

async function withCrumbFallback(primary, fallback) {
  if (Date.now() < crumbBlockedUntil) return fallback();
  try {
    return await primary();
  } catch (err) {
    if (!/crumb|429|too many requests|unauthorized/i.test(err.message ?? "")) throw err;
    console.warn(`Yahoo crumb unavailable (${err.message}); using chart-based fallback for 30 min`);
    crumbBlockedUntil = Date.now() + 30 * MINUTE;
    return fallback();
  }
}

function marketStateFrom(meta) {
  const period = meta.currentTradingPeriod;
  if (!period) return null;
  const now = Date.now();
  const inside = (p) => p && now >= new Date(p.start).getTime() && now < new Date(p.end).getTime();
  if (inside(period.regular)) return "REGULAR";
  if (inside(period.pre)) return "PRE";
  if (inside(period.post)) return "POST";
  return "CLOSED";
}

// A quote rebuilt from the last few daily candles plus the chart metadata.
async function quoteFromChart(symbol) {
  const { meta, quotes } = await yf.chart(symbol, { period1: new Date(Date.now() - 10 * DAY), interval: "1d" });
  const bars = quotes.filter((b) => b.close != null);
  const today = bars.at(-1);
  const previousClose = bars.at(-2)?.close ?? meta.chartPreviousClose ?? null;
  const price = meta.regularMarketPrice ?? today?.close ?? null;
  const change = price != null && previousClose != null ? price - previousClose : null;

  return {
    symbol: meta.symbol ?? symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    price,
    change,
    changePercent: change != null && previousClose ? (change / previousClose) * 100 : null,
    previousClose,
    open: today?.open ?? null,
    dayHigh: meta.regularMarketDayHigh ?? today?.high ?? null,
    dayLow: meta.regularMarketDayLow ?? today?.low ?? null,
    volume: meta.regularMarketVolume ?? today?.volume ?? null,
    marketCap: null,
    currency: meta.currency ?? "USD",
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    marketState: marketStateFrom(meta),
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
  };
}

async function quotesFromCharts(symbols) {
  const results = await Promise.allSettled(symbols.map(quoteFromChart));
  const quotes = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!quotes.length && results.length) throw results[0].reason;
  return quotes;
}

export async function getQuotes(symbols) {
  const key = `quotes:${[...symbols].sort().join(",")}`;
  return cached(key, 15 * SECOND, () =>
    withCrumbFallback(
      async () => {
        const results = await yf.quote(symbols);
        const list = Array.isArray(results) ? results : [results];
        return list.filter(Boolean).map(toQuote);
      },
      () => quotesFromCharts(symbols),
    ),
  );
}

export async function getHistory(symbol, range) {
  const { lookback, interval } = RANGES[range];
  // Intraday ranges change quickly; longer ranges can be cached longer.
  const ttl = interval.endsWith("m") ? MINUTE : 15 * MINUTE;

  return cached(`history:${symbol}:${range}`, ttl, async () => {
    // For 1d, look back a few extra days so weekends/holidays still show the last session.
    const period1 = new Date(Date.now() - (range === "1d" ? 4 * DAY : lookback));
    const result = await yf.chart(symbol, { period1, interval });

    let points = result.quotes
      .filter((p) => p.close != null)
      .map((p) => ({
        time: p.date.getTime(),
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
        volume: p.volume ?? 0,
      }));

    if (range === "1d" && points.length) {
      // Keep only the most recent trading session.
      const lastDay = new Date(points.at(-1).time).toDateString();
      points = points.filter((p) => new Date(p.time).toDateString() === lastDay);
    }

    return { symbol, range, interval, points };
  });
}

/** Daily candles from `lookbackMs` ago until now, oldest first. Used by the analysis service. */
export async function getDailyCandles(symbol, lookbackMs) {
  const days = Math.round(lookbackMs / DAY);
  return cached(`daily:${symbol}:${days}`, 15 * MINUTE, async () => {
    const result = await yf.chart(symbol, { period1: new Date(Date.now() - lookbackMs), interval: "1d" });
    return result.quotes
      .filter((p) => p.close != null)
      .map((p) => ({ time: p.date.getTime(), close: p.close }));
  });
}

async function summaryFromQuoteSummary(symbol) {
  const s = await yf.quoteSummary(symbol, {
    modules: ["summaryProfile", "summaryDetail", "defaultKeyStatistics", "price"],
  });
  const d = s.summaryDetail ?? {};
  const k = s.defaultKeyStatistics ?? {};
  const p = s.summaryProfile ?? {};

  return {
    symbol,
    name: s.price?.longName ?? s.price?.shortName ?? symbol,
    sector: p.sector ?? null,
    industry: p.industry ?? null,
    website: p.website ?? null,
    employees: p.fullTimeEmployees ?? null,
    description: p.longBusinessSummary ?? null,
    stats: {
      marketCap: d.marketCap ?? null,
      peRatio: d.trailingPE ?? null,
      forwardPE: d.forwardPE ?? null,
      eps: k.trailingEps ?? null,
      beta: d.beta ?? null,
      dividendYield: d.dividendYield ?? null,
      fiftyTwoWeekHigh: d.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: d.fiftyTwoWeekLow ?? null,
      averageVolume: d.averageVolume ?? null,
    },
  };
}

// Crumb-free summary: chart metadata + search (for sector/industry) + Finnhub fundamentals if configured.
async function summaryFromFallbacks(symbol) {
  const [quote, history, searchRes, fundamentals] = await Promise.all([
    quoteFromChart(symbol),
    yf.chart(symbol, { period1: new Date(Date.now() - 91 * DAY), interval: "1d" }).catch(() => null),
    yf.search(symbol, { quotesCount: 5, newsCount: 0 }).catch(() => null),
    getFundamentals(symbol).catch((err) => {
      console.warn(`Finnhub lookup failed for ${symbol}: ${err.message}`);
      return null;
    }),
  ]);
  const match = searchRes?.quotes?.find((q) => q.symbol === symbol);
  const volumes = (history?.quotes ?? []).map((b) => b.volume).filter((v) => v > 0);
  const averageVolume = volumes.length ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;

  return {
    symbol,
    name: quote.name,
    sector: match?.sectorDisp ?? match?.sector ?? null,
    industry: match?.industryDisp ?? match?.industry ?? fundamentals?.industry ?? null,
    website: fundamentals?.website ?? null,
    employees: null,
    description: null,
    stats: {
      marketCap: fundamentals?.marketCap ?? null,
      peRatio: fundamentals?.peRatio ?? null,
      forwardPE: null,
      eps: fundamentals?.eps ?? null,
      beta: fundamentals?.beta ?? null,
      dividendYield: fundamentals?.dividendYield ?? null,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      averageVolume: fundamentals?.averageVolume ?? averageVolume,
    },
  };
}

export async function getSummary(symbol) {
  return cached(`summary:${symbol}`, 10 * MINUTE, () =>
    withCrumbFallback(
      () => summaryFromQuoteSummary(symbol),
      () => summaryFromFallbacks(symbol),
    ),
  );
}

export async function search(query) {
  return cached(`search:${query.toLowerCase()}`, 5 * MINUTE, async () => {
    const res = await yf.search(query, { quotesCount: 8, newsCount: 0 });
    return res.quotes
      .filter((q) => q.isYahooFinance && ["EQUITY", "ETF", "INDEX", "CRYPTOCURRENCY"].includes(q.quoteType))
      .map((q) => ({
        symbol: q.symbol,
        name: q.longname ?? q.shortname ?? q.symbol,
        type: q.typeDisp ?? q.quoteType,
        exchange: q.exchDisp ?? q.exchange,
      }));
  });
}

export async function getNews(symbol) {
  return cached(`news:${symbol}`, 10 * MINUTE, async () => {
    const res = await yf.search(symbol, { quotesCount: 0, newsCount: 10 });
    return (res.news ?? []).map((n) => ({
      id: n.uuid,
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      publishedAt: new Date(n.providerPublishTime).toISOString(),
      thumbnail: n.thumbnail?.resolutions?.at(-1)?.url ?? null,
    }));
  });
}
