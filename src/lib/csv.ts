export type CsvValue = string | number | boolean | null | undefined;

/** Quote every field and neutralize spreadsheet formulas in untrusted text. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const cell = (value: CsvValue) => {
    const raw = String(value ?? "");
    const safe = typeof value === "string" && /^[\s\uFEFF]*[=+@-]/u.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
