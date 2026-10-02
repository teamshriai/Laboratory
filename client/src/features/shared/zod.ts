import { z } from 'zod'

// Zod normally probes `new Function()` to compile faster validators. The
// site's Content-Security-Policy forbids eval, so turn the probe off rather
// than have every form trigger a CSP violation report. (Kept out of the core
// chunk so the forms library still loads only with the forms.)
z.config({ jitless: true })

export { z }
