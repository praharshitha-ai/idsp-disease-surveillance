from pathlib import Path
import pandas as pd

# Find the project data folder automatically
raw_folder = Path(__file__).resolve().parent.parent / "data" / "raw"

# Find Excel files, ignoring metadata.csv
excel_files = list(raw_folder.glob("*.xlsx")) + list(raw_folder.glob("*.xls"))

if not excel_files:
    raise FileNotFoundError(
        f"No Excel file found in this folder: {raw_folder}"
    )

file_path = excel_files[0]

print("Reading file:")
print(file_path)
print()

# Show all sheets in the workbook
workbook = pd.ExcelFile(file_path)
print("Excel sheets:")
print(workbook.sheet_names)
print()

# Read the first sheet
# We will confirm the correct sheet after seeing the output.
df = pd.read_excel(file_path, sheet_name=workbook.sheet_names[0])

print("Rows and columns:")
print(df.shape)
print()

print("Column names:")
for number, column in enumerate(df.columns, start=1):
    print(f"{number}. {column!r}")
print()

print("First five rows:")
print(df.head().to_string())
print()

print("Data types:")
print(df.dtypes.to_string())
print()

print("Missing values by column:")
print(df.isna().sum().sort_values(ascending=False).to_string())
print()

print("Inspection complete.")
