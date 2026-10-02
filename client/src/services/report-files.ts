// Report files (PDF). Today the browser makes the PDF from the printed
// report ("Save as PDF" in the print dialog). When the backend renders PDFs,
// return its URL here (GET /api/reports/:id/pdf) and the Download buttons
// fetch it instead; no screen changes.

export interface ReportFile {
  url: string
  filename: string
}

/** A server-made PDF for this report, or null to print in the browser. */
export async function reportPdf(_reportNo: string): Promise<ReportFile | null> {
  return Promise.resolve(null)
}
