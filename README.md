# Market Watch

A full-stack stock dashboard with built-in technical analysis. The frontend is React + TypeScript (Vite) and the backend is Node + Express.

**Live demo:** https://market-watch-vn9w.onrender.com/ It's on Render's free tier, so the first load can take about 50 seconds while the server wakes up.

**No API keys needed.** Market data comes from Yahoo Finance through the [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2) package.

## Features

**Dashboard**
- Live quotes that auto-refresh, plus a strip showing the major indices (S&P 500, Nasdaq, Dow, Russell 2000, VIX)
- Search with autocomplete for stocks, ETFs, indices, and crypto (arrow keys and Enter work)
- Price chart with 1D / 5D / 1M / 6M / 1Y / 5Y ranges
- Key stats: P/E, EPS, market cap, 52-week range, beta, dividend yield, and more
- Company profile and latest news
- A watchlist saved on the backend (`backend/data/watchlist.json`)

**Analysis** (ported from my Python stock market analysis tool)
- 20-day and 50-day moving averages drawn on the price chart, each toggleable
- Latest price, daily return, and how far the price sits from each moving average
- Trend signal: whether the price is above or below its 50-day average
- A 5, 10, or 20 trading day forecast from a linear regression on closing prices, shown on the chart and in a table, with the slope ($/day) and R² of the fit

**Compare**
- Up to 6 symbols on one chart, normalized to % change since the start of the range
- Any range from 1D to 5Y, with a performance table (start, latest, change, best and worst point)
- Add symbols by search or straight from your watchlist; links like `/#compare/AAPL,MSFT,NVDA` can be shared

Dark and light themes follow your system setting, and the layout works on mobile.

## Run it
```bash
npm run install:all   # first time only
npm run dev           # starts the API on :5000 and the web app on :5173
```
Open http://localhost:5173.

Run the backend tests (analysis math) with `npm test --prefix backend`.

## Project layout
```
backend/                   Express API (port 5000)
  src/server.js            app setup, CORS, error handling
  src/routes/stocks.js     search, quotes, history, summary, news, analysis, compare
  src/routes/watchlist.js
  src/services/yahoo.js    Yahoo Finance calls + response shaping
  src/services/analysis.js analysis and comparison endpoints
  src/lib/analysis.js      moving averages, returns, linear regression (pure functions)
  src/lib/cache.js         in-memory TTL cache
  test/                    node:test suite for the analysis math
frontend/                  React + TS (Vite proxies /api -> :5000)
  src/api.ts               typed API client
  src/components/          UI components
```

## API
| Method | Path | Description |
|---|---|---|
| GET | `/api/search?q=apple` | Symbol search |
| GET | `/api/quotes?symbols=AAPL,MSFT` | Quotes for up to 50 symbols |
| GET | `/api/market/indices` | Major index quotes |
| GET | `/api/stocks/:symbol/history?range=1mo` | Price history (`1d,5d,1mo,6mo,1y,5y`) |
| GET | `/api/stocks/:symbol/summary` | Company profile + key stats |
| GET | `/api/stocks/:symbol/news` | Recent news |
| GET | `/api/stocks/:symbol/analysis?range=6mo&days=5` | Moving averages, daily return, trend, and forecast (`range`: `1mo,6mo,1y`; `days`: `5,10,20`) |
| GET | `/api/compare?symbols=AAPL,MSFT&range=6mo` | Up to 6 symbols as % change since the start of the range |
| GET/POST/DELETE | `/api/watchlist[/:symbol]` | Read, add to, or remove from the watchlist |

## How the analysis works
- Moving averages are simple rolling means of daily closes. The API fetches about 100 extra days of history so the 50-day average is defined from the first day on the chart.
- The forecast fits an ordinary least squares line to the closing prices in the selected range (the same model as scikit-learn's `LinearRegression` on `[0, 1, 2, ...]`) and extends it over the next trading days. Like pandas' `bdate_range`, it skips weekends but not market holidays.
- Projected values sit on the fitted line, so they can start above or below today's price. The forecast shows trend direction, not seasonality or volatility. It's a rough signal, not financial advice.

## Deploy
In production, the Express server also serves the built React app, so the whole project runs as one service.

**Render (free):** In the Render dashboard, choose **New → Blueprint**, then select this repo. `render.yaml` takes care of the rest. (The Render service is still named `stock-dashboard` so the existing deployment and URL keep working.)

**Any other Node host:**
```bash
npm run build:prod   # install deps and build the frontend
npm start            # serves the API and the frontend on $PORT
```

## Config (optional)
- Backend: `PORT` (default `5000`) and `CLIENT_ORIGIN` (default `http://localhost:5173`, used for CORS)
- Backend: `FINNHUB_API_KEY`, a free key from [finnhub.io](https://finnhub.io/register). Yahoo often blocks its quote and fundamentals endpoints from cloud servers. When that happens, the API rebuilds quotes from chart data and pulls P/E, EPS, market cap and beta from Finnhub if this key is set.
- Frontend: `VITE_API_URL`, for when the API is hosted somewhere else in production
