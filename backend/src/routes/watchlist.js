import { Router } from "express";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data");
const FILE = path.join(DATA_DIR, "watchlist.json");
const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"];

async function load() {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return [...DEFAULT_WATCHLIST];
  }
}

async function save(list) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(list, null, 2));
}

// GET /api/watchlist
router.get("/", async (_req, res) => {
  res.json(await load());
});

// POST /api/watchlist  { "symbol": "AAPL" }
router.post("/", async (req, res) => {
  const symbol = String(req.body?.symbol ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9.^=\-]{1,15}$/.test(symbol)) {
    return res.status(400).json({ error: "A valid symbol is required" });
  }
  const list = await load();
  if (!list.includes(symbol)) {
    list.push(symbol);
    await save(list);
  }
  res.status(201).json(list);
});

// DELETE /api/watchlist/AAPL
router.delete("/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const list = (await load()).filter((s) => s !== symbol);
  await save(list);
  res.json(list);
});

export default router;
