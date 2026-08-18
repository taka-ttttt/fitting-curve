import Papa from "papaparse";

import type { CsvTable } from "../types/curve-fitting";

function normalizeHeader(value: string, index: number): string {
  const normalized = value.replace(/^\uFEFF/, "").trim();
  return normalized || `column_${index + 1}`;
}

/** Parses a CSV string while preserving values as strings for explicit mapping. */
export function parseCsvText(text: string): CsvTable {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
  });
  const warnings = result.errors.map(
    (error) => `CSV ${error.row !== undefined ? `${error.row + 1}行目: ` : ""}${error.message}`,
  );
  const [rawHeader = [], ...body] = result.data;
  const columns = rawHeader.map(normalizeHeader);
  const duplicateHeaders = columns.filter(
    (column, index) => columns.indexOf(column) !== index,
  );
  if (duplicateHeaders.length > 0) {
    warnings.push(`重複した列名があります: ${[...new Set(duplicateHeaders)].join(", ")}`);
  }
  const rows = body.map((values) =>
    Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""])),
  );
  return { columns, rows, warnings };
}

/** Parses a File in Papa Parse's browser worker to keep large uploads responsive. */
export function parseCsvFile(file: File): Promise<CsvTable> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      worker: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        const serialized = Papa.unparse(result.data);
        const table = parseCsvText(serialized);
        table.warnings.unshift(
          ...result.errors.map(
            (error) => `CSV ${error.row !== undefined ? `${error.row + 1}行目: ` : ""}${error.message}`,
          ),
        );
        resolve(table);
      },
      error: (error) => reject(error),
    });
  });
}
