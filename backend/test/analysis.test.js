import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCandles,
  linearRegression,
  movingAverage,
  nextBusinessDays,
  normalizeComparison,
  pctChange,
} from "../src/lib/analysis.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("movingAverage leaves the warm-up period empty, like pandas rolling()", () => {
  assert.deepEqual(movingAverage([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test("pctChange returns fractions with a null first entry", () => {
  const r = pctChange([100, 110, 99]);
  assert.equal(r[0], null);
  near(r[1], 0.1);
  near(r[2], -0.1);
});

test("linearRegression recovers an exact line", () => {
  const fit = linearRegression([3, 5, 7, 9, 11]);
  near(fit.slope, 2);
  near(fit.intercept, 3);
  near(fit.r2, 1);
});

test("nextBusinessDays skips weekends", () => {
  const friday = Date.UTC(2026, 9, 23, 13, 30); // Fri Oct 23 2026
  const days = nextBusinessDays(friday, 3).map((t) => new Date(t).getUTCDate());
  assert.deepEqual(days, [26, 27, 28]);
});

test("analyzeCandles fits only the requested window and forecasts forward", () => {
  const start = Date.UTC(2026, 0, 5, 14, 30); // a Monday
  const candles = [];
  let t = start;
  for (let i = 0; i < 80; i++) {
    candles.push({ time: t, close: 100 + i });
    t = nextBusinessDays(t, 1)[0];
  }
  const windowStart = candles[60].time;
  const a = analyzeCandles(candles, windowStart, 5);

  assert.equal(a.points.length, 20);
  assert.equal(a.latestPrice, 179);
  near(a.ma20, 169.5);
  near(a.ma50, 154.5);
  assert.equal(a.trend, "above");
  assert.equal(a.forecast.direction, "upward");
  near(a.forecast.slope, 1);
  assert.deepEqual(
    a.forecast.points.map((p) => Math.round(p.close)),
    [180, 181, 182, 183, 184],
  );
  assert.ok(a.points[0].ma50 != null, "50-day average is defined from the first visible day");
});

test("normalizeComparison indexes each series to its first close", () => {
  const day = (d) => Date.UTC(2026, 9, d, 13, 30);
  const { stats, points } = normalizeComparison(
    [
      { symbol: "AAA", points: [{ time: day(1), close: 50 }, { time: day(2), close: 55 }] },
      { symbol: "BBB", points: [{ time: day(1), close: 200 }, { time: day(2), close: 180 }] },
    ],
    "1d",
  );
  assert.equal(points.length, 2);
  near(points[1].AAA, 10);
  near(points[1].BBB, -10);
  near(stats[0].changePercent, 10);
  near(stats[1].worstPercent, -10);
});
