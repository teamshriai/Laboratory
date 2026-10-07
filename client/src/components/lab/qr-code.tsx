import { useEffect, useState } from 'react'

type QrFactory = typeof import('qrcode-generator')

/** Modules of white margin around the code (the QR standard asks for 4). */
const QUIET_ZONE = 4

// Kept once loaded, so a later render (a print) draws the code at once.
let factory: QrFactory | null = null
const loadFactory = () =>
  import('qrcode-generator').then((mod) => {
    factory = mod.default
    return mod.default
  })

/** The dark modules as one path: a rectangle per horizontal run. */
function qrPath(make: QrFactory, value: string) {
  try {
    const qr = make(0, 'M')
    qr.addData(value)
    qr.make()
    const count = qr.getModuleCount()
    const parts: string[] = []
    for (let row = 0; row < count; row++) {
      let col = 0
      while (col < count) {
        if (!qr.isDark(row, col)) {
          col++
          continue
        }
        const start = col
        while (col < count && qr.isDark(row, col)) col++
        const run = col - start
        parts.push(
          `M${start + QUIET_ZONE} ${row + QUIET_ZONE}h${run}v1h-${run}z`,
        )
      }
    }
    return { d: parts.join(''), extent: count + QUIET_ZONE * 2 }
  } catch {
    // Too long to encode: show the empty box rather than crash.
    return null
  }
}

/**
 * A QR code drawn as SVG (black on white with its quiet zone, so it stays
 * crisp in print). The encoder loads on first use, like the barcode one.
 */
export function QrCode({
  value,
  size = 96,
  label,
  className,
}: {
  value: string
  /** Rendered width and height in CSS pixels. */
  size?: number
  label: string
  className?: string
}) {
  const [make, setMake] = useState<QrFactory | null>(() => factory)
  useEffect(() => {
    if (make) return
    let cancelled = false
    loadFactory().then(
      // The factory is a function: wrap it so React stores, not calls, it.
      (loaded) => {
        if (!cancelled) setMake(() => loaded)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [make])
  const code = make ? qrPath(make, value) : null

  if (!code)
    return (
      <svg
        role="img"
        aria-label={label}
        aria-busy={make ? undefined : true}
        width={size}
        height={size}
        viewBox="0 0 10 10"
        className={className}
      >
        <rect width="10" height="10" rx="0.4" fill="#eef2f4" />
      </svg>
    )
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${code.extent} ${code.extent}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={code.extent} height={code.extent} fill="#ffffff" />
      <path d={code.d} fill="#000000" />
    </svg>
  )
}
