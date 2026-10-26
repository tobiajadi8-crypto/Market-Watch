import express from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import stocksRouter from "./routes/stocks.js";
import watchlistRouter from "./routes/watchlist.js";

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use("/api/watchlist", watchlistRouter);
app.use("/api", stocksRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// In production the backend also serves the built React app (frontend/dist).
const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
}

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Express 5 forwards rejected promises from async handlers here.
app.use((err, _req, res, _next) => {
  // Yahoo throws for unknown tickers; surface that as a 404 instead of a server error.
  const notFound = /no data found|not found|delisted/i.test(err.message ?? "");
  const status = notFound ? 404 : (err.status ?? 502);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message ?? "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
