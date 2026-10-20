from pathlib import Path
import pandas as pd

raw_folder = Path(__file__).resolve().parent.parent / "data" / "raw"
out_folder = Path(__file__).resolve().parent.parent / "data" / "processed"
out_folder.mkdir(parents=True, exist_ok=True)

excel_files = list(raw_folder.glob("*.xlsx")) + list(raw_folder.glob("*.xls"))

if not excel_files:
    raise FileNotFoundError(f"No Excel file found in {raw_folder}")

file_path = excel_files[0]
print(f"Reading: {file_path.name}")

df = pd.read_excel(file_path, sheet_name="sheet1")
print(f"Input rows: {len(df)}")

text_columns = [
    "state",
    "district_as_per_source",
    "district_as_per_lgd",
    "disease_illness_name",
    "status",
    "units",
    "notes",
]

for column in text_columns:
    if column in df.columns:
        df[column] = df[column].astype("string").str.strip()

df["district"] = df["district_as_per_lgd"].fillna(df["district_as_per_source"])

for column in ["year", "week", "district_lgd_code", "cases", "deaths"]:
    df[column] = pd.to_numeric(df[column], errors="coerce")

for column in ["outbreak_starting_date", "reporting_date"]:
    df[column] = pd.to_datetime(
        df[column], unit="D", origin="1899-12-30", errors="coerce"
    )

df["quality_issue"] = ""
df.loc[df["state"].isna(), "quality_issue"] += "missing_state;"
df.loc[df["district"].isna(), "quality_issue"] += "missing_district;"
df.loc[df["disease_illness_name"].isna(), "quality_issue"] += "missing_disease;"
df.loc[~df["week"].between(1, 53), "quality_issue"] += "invalid_week;"
df.loc[df["cases"] < 0, "quality_issue"] += "negative_cases;"
df.loc[df["deaths"] < 0, "quality_issue"] += "negative_deaths;"
df.loc[df["cases"].isna(), "quality_issue"] += "missing_cases;"
df.loc[df["deaths"].isna(), "quality_issue"] += "missing_deaths;"

key = ["year", "week", "state", "district", "disease_illness_name"]
duplicate_count = int(df.duplicated(key, keep=False).sum())

output_file = out_folder / "idsp_clean.csv"
quality_file = out_folder / "idsp_quality_summary.txt"

df.to_csv(output_file, index=False)

with open(quality_file, "w", encoding="utf-8") as report:
    report.write(f"Input rows: {len(df)}\n")
    report.write(f"Duplicate analytical rows: {duplicate_count}\n")
    report.write(f"Rows with quality issues: {(df['quality_issue'] != '').sum()}\n\n")
    report.write("Missing values by column:\n")
    report.write(df.isna().sum().sort_values(ascending=False).to_string())
    report.write("\n\nQuality issue values:\n")
    report.write(df["quality_issue"].value_counts(dropna=False).to_string())

print(f"Duplicate analytical rows: {duplicate_count}")
print(f"Rows with quality issues: {(df['quality_issue'] != '').sum()}")
print(f"Saved cleaned data: {output_file}")
print(f"Saved quality report: {quality_file}")
