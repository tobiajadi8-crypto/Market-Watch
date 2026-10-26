# Market Watch

Stock dashboard. React + TypeScript (Vite) frontend, Node + Express backend, data from Yahoo Finance via `yahoo-finance2`.

Live demo: https://market-watch-vn9w.onrender.com/

## Features

- Live quotes, index strip, search, watchlist, price charts (1D to 5Y), key stats, news
- 20 and 50 day moving averages, daily return, trend signal
- 5, 10 or 20 day forecast from a linear regression on closing prices (rough trend only, not advice)
- Compare up to 6 symbols as % change. Shareable links like `/#compare/AAPL,MSFT,NVDA`

## Run it

```bash
npm run install:all   # first time only
npm run dev           # API on :5000, web app on :5173
```

Tests: `npm test --prefix backend`

## API

| Method | Path |
|---|---|
| GET | `/api/search?q=apple` |
| GET | `/api/quotes?symbols=AAPL,MSFT` |
| GET | `/api/market/indices` |
| GET | `/api/stocks/:symbol/history?range=1mo` |
| GET | `/api/stocks/:symbol/summary` |
| GET | `/api/stocks/:symbol/news` |
| GET | `/api/stocks/:symbol/analysis?range=6mo&days=5` |
| GET | `/api/compare?symbols=AAPL,MSFT&range=6mo` |
| GET/POST/DELETE | `/api/watchlist[/:symbol]` |

## Deploy

Express serves the built frontend in production, so it runs as one service. On Render, use New > Blueprint and pick this repo. Elsewhere: `npm run build:prod` then `npm start`.

## Config

- `PORT` (default `5000`), `CLIENT_ORIGIN` (default `http://localhost:5173`)
- `FINNHUB_API_KEY`: optional. Yahoo blocks some endpoints from cloud servers, and this key fills in P/E, EPS, market cap and beta when that happens.
- `VITE_API_URL`: frontend, if the API is hosted elsewhere
