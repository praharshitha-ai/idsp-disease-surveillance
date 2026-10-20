"""Hepatitis across South Indian districts.

Filters the cleaned IDSP data to hepatitis (any label containing "hepatitis":
A / E / B / C / viral / unspecified) in the six southern units — Andhra Pradesh,
Karnataka, Kerala, Tamil Nadu, Telangana, Puducherry — joins to the India 2020
district GeoJSON on the LGD code, and renders one page with two panels:

  1. Choropleth  — total hepatitis cases per district, log-scaled (counts span
     0 -> ~5.6k; Kerala dwarfs everything, so a linear ramp would hide the rest).
  2. Top-15 bar  — the same totals on a linear scale, so Kerala's magnitude is
     read directly instead of being compressed by the log map.

Output: reports/hepatitis_south_india.html  (self-contained, opens in a browser)

Design (dataviz method): sequential ONE-hue teal for magnitude on both panels;
districts with zero reported hepatitis sit at the light end; hover/labels carry
the real counts as text tokens; no rainbow, no dual axis.
"""
import json
import math
import webbrowser
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

ROOT = Path(__file__).resolve().parents[1]
CLEAN = ROOT / "data" / "processed" / "idsp_clean.csv"
GEOJSON = ROOT / "data" / "processed" / "india_districts.geojson"
OUT = ROOT / "reports" / "hepatitis_south_india.html"

# South Indian units. Left = idsp_clean state spelling, right = GeoJSON stname.
SOUTH_DATA = {"Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Telangana", "Puducherry"}
SOUTH_GEO = {"ANDHRA PRADESH", "KARNATAKA", "KERALA", "TAMIL NADU", "TELANGANA", "PUDUCHERRY"}

TEAL = "#0f766e"  # single-hue anchor, matches the "Teal" sequential dark end


def south_geojson():
    """Subset the national layer to southern districts (lighter + auto-zooms)."""
    gj = json.load(open(GEOJSON, encoding="utf-8"))
    feats = [f for f in gj["features"] if f["properties"]["stname"] in SOUTH_GEO]
    return {"type": "FeatureCollection", "features": feats}


def hepatitis_by_district():
    df = pd.read_csv(CLEAN)
    df["cases"] = pd.to_numeric(df["cases"], errors="coerce")
    df["deaths"] = pd.to_numeric(df["deaths"], errors="coerce")
    is_hep = df["disease_illness_name"].astype(str).str.contains("hepatitis", case=False, na=False)
    hs = df[is_hep & df["state"].isin(SOUTH_DATA)].dropna(subset=["district_lgd_code"]).copy()
    hs["code"] = hs["district_lgd_code"].astype(int)
    return (
        hs.groupby("code")
        .agg(cases=("cases", "sum"), deaths=("deaths", "sum"), outbreaks=("code", "size"))
        .reset_index()
    )


def build_table(gj, hep):
    """One row per southern district (incl. zero-hepatitis ones), for the map."""
    rows = [
        {"code": f["id"], "district": f["properties"]["dtname"], "state": f["properties"]["stname"].title()}
        for f in gj["features"]
    ]
    base = pd.DataFrame(rows)
    t = base.merge(hep, on="code", how="left")
    for col in ("cases", "deaths", "outbreaks"):
        t[col] = t[col].fillna(0)
    t["log_cases"] = t["cases"].add(1).apply(math.log10)
    return t


def choropleth(t, gj):
    hi = int(t["cases"].max())
    ticks = [0, 10, 100, 1000, hi]
    fig = px.choropleth(
        t, geojson=gj, locations="code", featureidkey="id",
        color="log_cases", color_continuous_scale="Teal",
        custom_data=["district", "state", "cases", "deaths", "outbreaks"],
    )
    fig.update_traces(
        marker_line_width=0.3, marker_line_color="white",
        hovertemplate=(
            "<b>%{customdata[0]}</b>, %{customdata[1]}<br>"
            "Hepatitis cases: %{customdata[2]:,.0f}<br>"
            "Deaths: %{customdata[3]:,.0f}<br>"
            "Outbreaks reported: %{customdata[4]:,.0f}<extra></extra>"
        ),
    )
    fig.update_geos(fitbounds="locations", visible=False)
    fig.update_layout(
        margin=dict(l=0, r=0, t=10, b=0), height=640,
        coloraxis_colorbar=dict(
            title="Cases", tickvals=[math.log10(x + 1) for x in ticks],
            ticktext=[f"{x:,}" for x in ticks],
        ),
    )
    return fig


def top_bar(t, n=15):
    top = t[t["cases"] > 0].sort_values("cases").tail(n)
    labels = top["district"] + ", " + top["state"]
    fig = go.Figure(
        go.Bar(
            x=top["cases"], y=labels, orientation="h",
            marker_color=TEAL, marker_line_width=0,
            text=[f"{c:,.0f}" for c in top["cases"]], textposition="outside",
            hovertemplate="<b>%{y}</b><br>Cases: %{x:,.0f}<extra></extra>",
        )
    )
    fig.update_layout(
        margin=dict(l=8, r=48, t=10, b=8), height=520,
        xaxis_title="Hepatitis cases (all years)", yaxis_title=None,
        xaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.06)", zeroline=False),
        plot_bgcolor="white",
    )
    return fig


def main():
    gj = south_geojson()
    hep = hepatitis_by_district()
    t = build_table(gj, hep)

    matched = int((t["cases"] > 0).sum())
    print(f"South districts on map: {len(t)}  |  with hepatitis: {matched}  "
          f"|  total cases: {int(t['cases'].sum()):,}")

    map_div = choropleth(t, gj).to_html(full_html=False, include_plotlyjs="cdn")
    bar_div = top_bar(t).to_html(full_html=False, include_plotlyjs=False)

    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hepatitis across South Indian districts</title>
<style>
  body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         margin: 0; padding: 24px 28px; color: #0f172a; background: #f8fafc; }}
  h1 {{ font-size: 20px; margin: 0 0 2px; }}
  p.sub {{ color: #475569; margin: 0 0 18px; font-size: 13px; }}
  .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
          padding: 12px 14px; margin-bottom: 20px; }}
  .card h2 {{ font-size: 14px; margin: 2px 4px 8px; color: #334155; font-weight: 600; }}
</style></head><body>
  <h1>Hepatitis across South Indian districts</h1>
  <p class="sub">IDSP outbreak surveillance · all reported years · Andhra Pradesh, Karnataka,
     Kerala, Tamil Nadu, Telangana &amp; Puducherry · any hepatitis type (A/E/B/C/viral).</p>
  <div class="card"><h2>Total hepatitis cases by district (log color scale)</h2>{map_div}</div>
  <div class="card"><h2>Top 15 districts by hepatitis cases</h2>{bar_div}</div>
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
