"""Prophet forecast of hepatitis cases in South India.

Builds a contiguous WEEKLY time series of hepatitis cases (any type: A/E/B/C/
viral) across the six southern units — Andhra Pradesh, Karnataka, Kerala, Tamil
Nadu, Telangana, Puducherry — using each outbreak's starting date. Weeks with no
reported hepatitis outbreak are real zeros, so the series is resampled to a
regular weekly grid and gap-filled with 0 before modelling.

A Prophet model (yearly seasonality; hepatitis A/E track the monsoon) is fit and
used to forecast HORIZON weeks ahead. The page shows two panels:

  1. Forecast — weekly actuals, the fitted/forecast mean, and the uncertainty
     band, with a marker where history ends and the forecast begins.
  2. Yearly seasonality — the within-year shape Prophet learned (which weeks of
     the year run high/low), which is the epidemiologically interesting part.

Output: reports/hepatitis_south_forecast.html  (self-contained, opens in browser)

Notes: counts are non-negative, so the mean and lower band are clipped at 0 for
display. Additive seasonality (not multiplicative) because the series contains
zeros.
"""
import warnings
import webbrowser
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
from prophet import Prophet

warnings.simplefilter("ignore", FutureWarning)

ROOT = Path(__file__).resolve().parents[1]
CLEAN = ROOT / "data" / "processed" / "idsp_clean.csv"
OUT = ROOT / "reports" / "hepatitis_south_forecast.html"

SOUTH = {"Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Telangana", "Puducherry"}
HORIZON = 52          # weeks to forecast (~1 year)
FREQ = "W-MON"        # weekly buckets anchored on Monday
TEAL, TEAL_FILL = "#0f766e", "rgba(15,118,110,0.15)"
AMBER = "#b45309"     # forecast mean, distinct from the teal history


def weekly_series():
    df = pd.read_csv(CLEAN)
    df["cases"] = pd.to_numeric(df["cases"], errors="coerce")
    is_hep = df["disease_illness_name"].astype(str).str.contains("hepatitis", case=False, na=False)
    hs = df[is_hep & df["state"].isin(SOUTH)].copy()
    hs["ds"] = pd.to_datetime(hs["outbreak_starting_date"], errors="coerce")
    hs = hs.dropna(subset=["ds"])

    # Sum to weekly buckets, then reindex onto a gap-free weekly grid (0-fill).
    wk = hs.set_index("ds")["cases"].resample(FREQ).sum()
    grid = pd.date_range(wk.index.min(), wk.index.max(), freq=FREQ)
    wk = wk.reindex(grid, fill_value=0.0)
    return wk.rename_axis("ds").reset_index(name="y")


def fit_forecast(ts):
    m = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="additive",
        interval_width=0.80,
    )
    m.fit(ts)
    future = m.make_future_dataframe(periods=HORIZON, freq=FREQ)
    fc = m.predict(future)
    for col in ("yhat", "yhat_lower", "yhat_upper"):
        fc[col] = fc[col].clip(lower=0)
    return m, fc


def forecast_panel(ts, fc, split):
    fig = go.Figure()
    # Uncertainty band (upper then lower with fill).
    fig.add_trace(go.Scatter(x=fc["ds"], y=fc["yhat_upper"], mode="lines",
                             line=dict(width=0), hoverinfo="skip", showlegend=False))
    fig.add_trace(go.Scatter(x=fc["ds"], y=fc["yhat_lower"], mode="lines",
                             line=dict(width=0), fill="tonexty", fillcolor=TEAL_FILL,
                             name="80% interval", hoverinfo="skip"))
    # Actuals.
    fig.add_trace(go.Scatter(x=ts["ds"], y=ts["y"], mode="lines", name="Actual",
                             line=dict(color=TEAL, width=1.5),
                             hovertemplate="%{x|%d %b %Y}<br>Actual: %{y:.0f}<extra></extra>"))
    # Forecast mean (dashed over the future span).
    fut = fc[fc["ds"] > split]
    fig.add_trace(go.Scatter(x=fut["ds"], y=fut["yhat"], mode="lines", name="Forecast",
                             line=dict(color=AMBER, width=2, dash="dash"),
                             hovertemplate="%{x|%d %b %Y}<br>Forecast: %{y:.0f}<extra></extra>"))
    fig.add_vline(x=split, line_width=1, line_dash="dot", line_color="#94a3b8")
    fig.add_annotation(x=split, y=1, yref="paper", text="forecast →",
                       showarrow=False, xanchor="left", font=dict(size=11, color="#64748b"))
    fig.update_layout(
        margin=dict(l=8, r=12, t=10, b=8), height=460, plot_bgcolor="white",
        legend=dict(orientation="h", y=1.08, x=0),
        xaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.05)"),
        yaxis=dict(title="Weekly hepatitis cases", showgrid=True,
                   gridcolor="rgba(0,0,0,0.06)", rangemode="tozero"),
    )
    return fig


def seasonality_panel(m):
    # One synthetic non-leap year sampled weekly -> the learned yearly shape.
    days = pd.date_range("2024-01-01", "2024-12-31", freq="7D")
    df = pd.DataFrame({"ds": days})
    seas = m.predict_seasonal_components(m.setup_dataframe(df.copy()))
    y = seas["yearly"]
    fig = go.Figure(go.Scatter(
        x=days, y=y, mode="lines", line=dict(color=TEAL, width=2),
        fill="tozeroy", fillcolor=TEAL_FILL,
        hovertemplate="%{x|%d %b}<br>Effect: %{y:+.0f}<extra></extra>"))
    fig.add_hline(y=0, line_width=1, line_color="#cbd5e1")
    fig.update_layout(
        margin=dict(l=8, r=12, t=10, b=8), height=300, plot_bgcolor="white",
        xaxis=dict(tickformat="%b", showgrid=True, gridcolor="rgba(0,0,0,0.05)"),
        yaxis=dict(title="Cases vs. yearly mean", zeroline=False,
                   showgrid=True, gridcolor="rgba(0,0,0,0.06)"),
    )
    return fig


def main():
    ts = weekly_series()
    split = ts["ds"].max()
    print(f"Weekly points: {len(ts)}  |  {ts['ds'].min():%Y-%m-%d} -> {split:%Y-%m-%d}  "
          f"|  total cases: {ts['y'].sum():,.0f}")

    m, fc = fit_forecast(ts)
    horizon = fc[fc["ds"] > split]
    print(f"Forecast next {HORIZON}w: mean {horizon['yhat'].mean():.0f}/wk, "
          f"peak {horizon['yhat'].max():.0f} on {horizon.loc[horizon['yhat'].idxmax(),'ds']:%d %b %Y}")

    map_div = forecast_panel(ts, fc, split).to_html(full_html=False, include_plotlyjs="cdn")
    sea_div = seasonality_panel(m).to_html(full_html=False, include_plotlyjs=False)

    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hepatitis forecast — South India</title>
<style>
  body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         margin: 0; padding: 24px 28px; color: #0f172a; background: #f8fafc; }}
  h1 {{ font-size: 20px; margin: 0 0 2px; }}
  p.sub {{ color: #475569; margin: 0 0 18px; font-size: 13px; }}
  .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
          padding: 12px 14px; margin-bottom: 20px; }}
  .card h2 {{ font-size: 14px; margin: 2px 4px 8px; color: #334155; font-weight: 600; }}
</style></head><body>
  <h1>Weekly hepatitis forecast &mdash; South India</h1>
  <p class="sub">Prophet model (yearly seasonality) on IDSP outbreak surveillance ·
     Andhra Pradesh, Karnataka, Kerala, Tamil Nadu, Telangana &amp; Puducherry ·
     any hepatitis type · {HORIZON}-week horizon, 80% interval.</p>
  <div class="card"><h2>Weekly cases: actual, forecast &amp; uncertainty</h2>{map_div}</div>
  <div class="card"><h2>Learned yearly seasonality (weeks above / below the annual mean)</h2>{sea_div}</div>
</body></html>"""

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1e6:.1f} MB)")
    try:
        webbrowser.open(OUT.resolve().as_uri())
    except Exception:
        pass


if __name__ == "__main__":
    main()
