/** A SHA-256 digest in groups of eight, so a person can compare it by eye. */
export const groupDigest = (digest: string) =>
  digest.match(/.{1,8}/g)?.join(' ') ?? digest
