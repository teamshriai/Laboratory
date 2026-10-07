const page = (path: string) =>
  new URL(
    `${import.meta.env.BASE_URL}${path}`,
    window.location.origin,
  ).toString()

/**
 * The public address of a shared report: `r/<token>`, where the token is
 * random and shown only when the link is made (the server keeps a hash).
 */
export const shareUrl = (token: string) =>
  page(`r/${encodeURIComponent(token)}`)

/** The QR code's verification page for one issued report version. */
export const verifyUrl = (token: string) =>
  page(`v/${encodeURIComponent(token)}`)
