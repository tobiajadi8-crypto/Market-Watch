import { formatPercent, formatPrice, trendClass } from '../lib/format'
import { FORECAST_DAYS } from '../types'
import type { Analysis, AnalysisRange, ForecastDays } from '../types'
import { RANGE_LABEL } from '../lib/ranges'

interface Props {
  analysis: Analysis | null
  loading: boolean
  error: string | null
  currency: string
  range: AnalysisRange
  days: ForecastDays
  onDaysChange: (days: ForecastDays) => void
}

function formatDay(time: number): string {
  return new Date(time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function AnalysisCard({ analysis, loading, error, currency, range, days, onDaysChange }: Props) {
  const a = analysis
  const c = currency
  const fromMa50 = a?.ma50 ? ((a.latestPrice - a.ma50) / a.ma50) * 100 : null
  const fromMa20 = a?.ma20 ? ((a.latestPrice - a.ma20) / a.ma20) * 100 : null

  return (
    <section className="card analysis">
      <div className="chart-toolbar">
        <div>
          <h2>Analysis</h2>
          <span className="muted small">Based on {RANGE_LABEL[range]} of daily closes</span>
        </div>
        <div className="range-tabs" role="tablist" aria-label="Forecast length">
          {FORECAST_DAYS.map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={d === days}
              className={d === days ? 'active' : ''}
              onClick={() => onDaysChange(d)}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {error && <p className="muted small">Couldn't run the analysis: {error}</p>}
      {!a && !error && loading && <p className="muted small">Crunching the numbers…</p>}

      {a && (
        <>
          {a.trend && (
            <div className={`signal ${a.trend === 'above' ? 'up' : 'down'}`}>
              <span className="signal-icon" aria-hidden="true">
                {a.trend === 'above' ? '▲' : '▼'}
              </span>
              <span>
                Price is <strong>{a.trend}</strong> its 50-day average
                {fromMa50 != null && <span className="muted"> ({formatPercent(fromMa50)})</span>}
              </span>
            </div>
          )}

          <div className="analysis-grid">
            <dl className="stats-grid one-col">
              <div className="stat">
                <dt>Latest price</dt>
                <dd>{formatPrice(a.latestPrice, c)}</dd>
              </div>
              <div className="stat">
                <dt>Daily return</dt>
                <dd className={trendClass(a.dailyReturn)}>
                  {formatPercent(a.dailyReturn != null ? a.dailyReturn * 100 : null)}
                </dd>
              </div>
              <div className="stat">
                <dt>
                  <span className="swatch swatch-ma20" aria-hidden="true" /> 20-day MA
                </dt>
                <dd>
                  {formatPrice(a.ma20, c)}
                  {fromMa20 != null && <span className="muted small"> {formatPercent(fromMa20)}</span>}
                </dd>
              </div>
              <div className="stat">
                <dt>
                  <span className="swatch swatch-ma50" aria-hidden="true" /> 50-day MA
                </dt>
                <dd>
                  {formatPrice(a.ma50, c)}
                  {fromMa50 != null && <span className="muted small"> {formatPercent(fromMa50)}</span>}
                </dd>
              </div>
              <div className="stat">
                <dt>Trend line</dt>
                <dd className={a.forecast.slope >= 0 ? 'up' : 'down'}>
                  {a.forecast.direction}, {a.forecast.slope >= 0 ? '+' : '-'}
                  {formatPrice(Math.abs(a.forecast.slope), c)}/day
                </dd>
              </div>
              <div className="stat" title="R² of the regression: how closely prices followed a straight line (0 to 1)">
                <dt>Trend fit (R²)</dt>
                <dd>{a.forecast.r2.toFixed(2)}</dd>
              </div>
            </dl>

            <div>
              <h3 className="subhead">
                <span className="swatch swatch-forecast" aria-hidden="true" /> Next {a.forecast.days} trading days
              </h3>
              <table className="forecast-table">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Projected</th>
                    <th scope="col">vs. today</th>
                  </tr>
                </thead>
                <tbody>
                  {a.forecast.points.map((p) => {
                    const pct = (p.close / a.latestPrice - 1) * 100
                    return (
                      <tr key={p.time}>
                        <td>{formatDay(p.time)}</td>
                        <td>{formatPrice(p.close, c)}</td>
                        <td className={trendClass(pct)}>{formatPercent(pct)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="muted small disclaimer">
            The forecast is a straight linear regression on closing prices over the selected range. Projected values
            sit on that fitted trend line, so they can start above or below today's price. It captures trend
            direction, not seasonality or volatility, so treat it as a rough signal rather than a prediction. Not
            financial advice.
          </p>
        </>
      )}
    </section>
  )
}
