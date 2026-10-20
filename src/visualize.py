"""District choropleth of IDSP disease burden.

Joins the cleaned IDSP outbreak data (data/processed/idsp_clean.csv) to the
India 2020 district GeoJSON on the LGD district code and renders a single
interactive map: total reported cases per district, log-scaled (counts span
1 -> ~79k, so a linear ramp would collapse everything but a few districts).

Output: reports/idsp_district_map.html  (self-contained, opens in a browser)

Design (per the dataviz method):
  - Form: magnitude over a spatial identity -> choropleth.
  - Color: sequential, ONE hue light->dark (Plotly "Teal"); never a rainbow.
    Case counts are heavily right-skewed, so color maps log10(cases).
  - Hover carries the real numbers (cases, deaths, outbreaks) as text tokens.
"""
import json
import math
import webbrowser
from pathlib import Path

import pandas as pd
import plotly.express as px

ROOT = Path(__file__).resolve().parents[1]
CLEAN = ROOT / "data" / "processed" / "idsp_clean.csv"
GEOJSON = ROOT / "data" / "processed" / "india_districts.geojson"
OUT = ROOT / "reports" / "idsp_district_map.html"

# Coordinate precision for the *map layer only*. 2 dp ~= 1.1 km, invisible at a
# national district scale, and keeps the embedded GeoJSON (and the HTML) light.
MAP_PRECISION = 2


def _round(coords):
    if isinstance(coords[0], (int, float)):
        return [round(c, MAP_PRECISION) for c in coords]
    return [_round(c) for c in coords]


def load_geojson():
    gj = json.load(open(GEOJSON, encoding="utf-8"))
    for feat in gj["features"]:
        geom = feat.get("geometry")
        if geom and geom.get("coordinates"):
            geom["coordinates"] = _round(geom["coordinates"])
    return gj


def aggregate():
    df = pd.read_csv(CLEAN)
    df["cases"] = pd.to_numeric(df["cases"], errors="coerce")
    df["deaths"] = pd.to_numeric(df["deaths"], errors="coerce")
    df = df.dropna(subset=["district_lgd_code"]).copy()
    df["code"] = df["district_lgd_code"].astype(int)

    g = (
        df.groupby("code")
        .agg(
            district=("district", "first"),
            state=("state", "first"),
            cases=("cases", "sum"),
            deaths=("deaths", "sum"),
            outbreaks=("code", "size"),
        )
        .reset_index()
    )
    # log color channel; +1 so a 0/1-case district still lands on the ramp.
    g["log_cases"] = g["cases"].fillna(0).add(1).apply(math.log10)
    return g


def build(g, gj):
    # Tick positions on the log axis mapped back to real case counts.
    hi = int(g["cases"].max())
    ticks = [1, 10, 100, 1000, 10000, hi]
    tickvals = [math.log10(t + 1) for t in ticks]

    fig = px.choropleth(
        g,
        geojson=gj,
        locations="code",
        featureidkey="id",
        color="log_cases",
        color_continuous_scale="Teal",  # single-hue sequential, light -> dark
        custom_data=["district", "state", "cases", "deaths", "outbreaks"],
    )
    fig.update_traces(
        marker_line_width=0.2,
        marker_line_color="white",  # 2px-equivalent surface gap between districts
        hovertemplate=(
            "<b>%{customdata[0]}</b>, %{customdata[1]}<br>"
            "Cases: %{customdata[2]:,.0f}<br>"
            "Deaths: %{customdata[3]:,.0f}<br>"
            "Outbreaks reported: %{customdata[4]:,.0f}<extra></extra>"
        ),
    )
    fig.update_geos(fitbounds="locations", visible=False)
    fig.update_layout(
        title="IDSP reported disease cases by district (all years)",
        margin=dict(l=0, r=0, t=48, b=0),
        coloraxis_colorbar=dict(
            title="Cases",
            tickvals=tickvals,
            ticktext=[f"{t:,}" for t in ticks],
        ),
    )
    return fig


def main():
    gj = load_geojson()
    g = aggregate()
    matched = g["code"].isin({f["id"] for f in gj["features"]}).sum()
    print(f"Districts with data: {len(g)}  |  matched to map: {matched}")

    fig = build(g, gj)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.write_html(str(OUT), include_plotlyjs="cdn")
    size_mb = OUT.stat().st_size / 1e6
    print(f"Wrote {OUT.relative_to(ROOT)} ({size_mb:.1f} MB)")
    try:
        webbrowser.open(OUT.resolve().as_uri())
    except Exception:
        pass


if __name__ == "__main__":
    main()
