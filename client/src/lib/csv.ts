export type CsvCell = string | number | null | undefined

/**
 * A cell a spreadsheet would run as a formula (=, +, @, a tab or carriage
 * return, or "-" not followed by a number) is prefixed with an apostrophe,
 * so an exported file cannot execute anything when opened (CSV injection).
 */
function safe(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'number') return String(cell)
  const text =
    /^[=+@\t\r]/.test(cell) || /^-(?![\d.])/.test(cell) ? `'${cell}` : cell
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** RFC 4180 CSV: comma separated, CRLF line ends, quotes doubled. */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(safe).join(',')).join('\r\n')
}

/**
 * Downloads rows as a CSV file. The byte-order mark makes spreadsheet apps
 * read names in Indian scripts correctly.
 */
export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const blob = new Blob(['﻿', toCsv(rows)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
