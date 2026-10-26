// Pure analysis helpers, ported from the original Python stock market analysis tool
// (pandas rolling means, pct_change, and scikit-learn's LinearRegression on closing prices).
// No I/O here, so these are easy to unit test.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Simple moving average. Entries before the window fills are null (pandas gives NaN). */
export function movingAverage(values, window) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

/** Percentage change between consecutive values, as fractions (0.012 = +1.2%). First entry is null. */
export function pctChange(values) {
  return values.map((v, i) => (i === 0 || !values[i - 1] ? null : v / values[i - 1] - 1));
}

/**
 * Ordinary least squares fit of y against x = 0, 1, 2, ...
 * Same model as sklearn's LinearRegression().fit(np.arange(n).reshape(-1, 1), y).
 */
export function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };

  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - meanX) * (ys[i] - meanY);
    sxx += (i - meanX) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (ys[i] - (intercept + slope * i)) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * The next `count` weekdays after `fromTime`, keeping the same time of day.
 * Matches pandas' bdate_range: skips weekends, not market holidays.
 */
export function nextBusinessDays(fromTime, count) {
  const out = [];
  let t = fromTime;
  while (out.length < count) {
    t += DAY_MS;
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) out.push(t);
  }
  return out;
}

/**
 * Runs the full analysis on daily candles.
 *
 * @param {{time:number, close:number}[]} candles  daily candles, oldest first. Include enough
 *        history before `windowStart` (about 50 trading days) so the 50-day average is defined.
 * @param {number} windowStart  timestamp where the requested range begins; the regression is
 *        fit on this window only, like the Python tool's start/end dates.
 * @param {number} days  how many trading days to forecast.
 */
export function analyzeCandles(candles, windowStart, days = 5) {
  const closes = candles.map((c) => c.close);
  const ma20 = movingAverage(closes, 20);
  const ma50 = movingAverage(closes, 50);
  const returns = pctChange(closes);

  let startIndex = candles.findIndex((c) => c.time >= windowStart);
  if (startIndex === -1) startIndex = 0;

  const window = candles.slice(startIndex);
  const fit = linearRegression(window.map((c) => c.close));
  const n = window.length;

  const forecastTimes = nextBusinessDays(candles.at(-1).time, days);
  const forecast = forecastTimes.map((time, i) => ({ time, close: fit.intercept + fit.slope * (n + i) }));

  const last = candles.length - 1;
  const latestPrice = closes[last];
  const latestMa50 = ma50[last];
  const finalForecast = forecast.at(-1)?.close ?? latestPrice;

  return {
    latestPrice,
    dailyReturn: returns[last],
    ma20: ma20[last],
    ma50: latestMa50,
    // Python: "above" if latest_price > ma50 else "below"
    trend: latestMa50 == null ? null : latestPrice > latestMa50 ? "above" : "below",
    points: window.map((c, i) => ({
      time: c.time,
      close: c.close,
      ma20: ma20[startIndex + i],
      ma50: ma50[startIndex + i],
    })),
    forecast: {
      days,
      slope: fit.slope,
      r2: fit.r2,
      direction: fit.slope > 0 ? "upward" : "downward",
      changePercent: (finalForecast / latestPrice - 1) * 100,
      points: forecast,
    },
  };
}

/** UTC calendar day key, used to line up daily/weekly bars from different symbols. */
function dayKey(time, interval) {
  const d = new Date(time);
  if (interval === "1wk") {
    // Snap to that week's Monday so weekly bars from different exchanges share a key.
    const offset = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - offset);
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Normalizes each series to % change since its first close and merges them into rows
 * keyed by time, ready for a multi-line chart. Ported from the Python tool's plot_comparison.
 *
 * @param {{symbol:string, points:{time:number, close:number}[]}[]} series
 * @param {string} interval  candle interval ("5m", "30m", "1d", "1wk")
 */
export function normalizeComparison(series, interval) {
  const intraday = interval.endsWith("m");
  const rows = new Map();
  const stats = [];

  for (const { symbol, points } of series) {
    if (!points.length) continue;
    const base = points[0].close;
    let high = -Infinity;
    let low = Infinity;

    for (const p of points) {
      const pct = (p.close / base - 1) * 100;
      high = Math.max(high, pct);
      low = Math.min(low, pct);
      const key = intraday ? p.time : dayKey(p.time, interval);
      const row = rows.get(key) ?? { time: key };
      row[symbol] = pct;
      rows.set(key, row);
    }

    stats.push({
      symbol,
      startPrice: base,
      endPrice: points.at(-1).close,
      changePercent: (points.at(-1).close / base - 1) * 100,
      bestPercent: high,
      worstPercent: low,
    });
  }

  return {
    stats,
    points: [...rows.values()].sort((a, b) => a.time - b.time),
  };
}
