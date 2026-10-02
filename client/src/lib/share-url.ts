/**
 * The public address of a shared report: the site's base path plus
 * `report/<number>`. Demo: the page reads this browser's data, so the link
 * opens on this device only until the backend serves it.
 */
export function reportShareUrl(reportNo: string) {
  return new URL(
    `${import.meta.env.BASE_URL}report/${encodeURIComponent(reportNo)}`,
    window.location.origin,
  ).toString()
}
