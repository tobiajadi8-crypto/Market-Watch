import test from "node:test";
import assert from "node:assert/strict";
import { cached } from "../src/lib/cache.js";

test("cached: second call within the TTL does not refetch", async () => {
  let calls = 0;
  const fetcher = async () => ++calls;
  assert.equal(await cached("k1", 1000, fetcher), 1);
  assert.equal(await cached("k1", 1000, fetcher), 1);
  assert.equal(calls, 1);
});

test("cached: refetches after the TTL expires", async () => {
  let calls = 0;
  const fetcher = async () => ++calls;
  await cached("k2", 5, fetcher);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(await cached("k2", 5, fetcher), 2);
});

test("cached: different keys are independent", async () => {
  assert.equal(await cached("a", 1000, async () => "A"), "A");
  assert.equal(await cached("b", 1000, async () => "B"), "B");
});
