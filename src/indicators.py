from pathlib import Path
import pandas as pd

PROJECT = Path(__file__).resolve().parent.parent
INPUT = PROJECT / "data" / "processed" / "idsp_clean.csv"
OUTPUT = PROJECT / "data" / "processed"

if not INPUT.exists():
    raise FileNotFoundError(f"Cleaned file not found: {INPUT}")

df = pd.read_csv(INPUT)
print("Rows loaded:", len(df))

# Use numeric values for calculations. Missing values remain missing.
df["cases"] = pd.to_numeric(df["cases"], errors="coerce")
df["deaths"] = pd.to_numeric(df["deaths"], errors="coerce")
df["year"] = pd.to_numeric(df["year"], errors="coerce")
df["week"] = pd.to_numeric(df["week"], errors="coerce")

# Disease-level summary.
disease_summary = (
    df.groupby("disease_illness_name", dropna=False)
    .agg(
        total_cases=("cases", "sum"),
        total_deaths=("deaths", "sum"),
        affected_districts=("district", "nunique"),
        affected_weeks=("week", "nunique"),
    )
    .reset_index()
    .sort_values("total_cases", ascending=False)
)
disease_summary.to_csv(OUTPUT / "disease_summary.csv", index=False)

# District-level summary.
district_summary = (
    df.groupby(["state", "district"], dropna=False)
    .agg(
        total_cases=("cases", "sum"),
        total_deaths=("deaths", "sum"),
        diseases_reported=("disease_illness_name", "nunique"),
        affected_weeks=("week", "nunique"),
        affected_years=("year", "nunique"),
    )
    .reset_index()
    .sort_values("total_cases", ascending=False)
)
district_summary.to_csv(OUTPUT / "district_summary.csv", index=False)

# Recurrent district-disease combinations.
recurrence = (
    df.groupby(["state", "district", "disease_illness_name"], dropna=False)
    .agg(
        total_cases=("cases", "sum"),
        total_deaths=("deaths", "sum"),
        affected_weeks=("week", "nunique"),
        affected_years=("year", "nunique"),
        largest_weekly_event=("cases", "max"),
    )
    .reset_index()
    .sort_values(["affected_years", "total_cases"], ascending=[False, False])
)
recurrence.to_csv(OUTPUT / "district_disease_recurrence.csv", index=False)

# Weekly and seasonal summary.
seasonality = (
    df.groupby(["disease_illness_name", "week"], dropna=False)
    .agg(
        total_cases=("cases", "sum"),
        total_deaths=("deaths", "sum"),
        reporting_rows=("cases", "size"),
    )
    .reset_index()
    .sort_values("total_cases", ascending=False)
)
seasonality.to_csv(OUTPUT / "disease_week_seasonality.csv", index=False)

# Print the most useful first findings.
print("\nTop diseases by reported cases:")
print(disease_summary.head(15).to_string(index=False))
print("\nTop districts by reported cases:")
print(district_summary.head(15).to_string(index=False))
print("\nMost recurrent district-disease combinations:")
print(recurrence.head(15).to_string(index=False))

print("\nSaved files:")
for path in [
    OUTPUT / "disease_summary.csv",
    OUTPUT / "district_summary.csv",
    OUTPUT / "district_disease_recurrence.csv",
    OUTPUT / "disease_week_seasonality.csv",
]:
    print(path)
