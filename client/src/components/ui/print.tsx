import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal, flushSync } from 'react-dom'
import { PrintContext, type Printable } from './print-context'

interface Job {
  node: ReactNode
  /** Opened from the app (a Print button), so the app starts printing. */
  fromApp: boolean
}

/** Renders printable content into #print-root and opens the print dialog. */
export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<Job | null>(null)
  const jobRef = useRef<Job | null>(null)
  const printable = useRef<Printable | null>(null)
  useEffect(() => {
    jobRef.current = job
  }, [job])
  const [target] = useState(() =>
    typeof document === 'undefined'
      ? null
      : document.getElementById('print-root'),
  )

  useEffect(() => {
    if (!job?.fromApp) return
    let cancelled = false
    let frame = 0
    // Let the portal paint, barcodes render (their encoder loads on first
    // use) and images such as the logos decode before printing.
    const images = () =>
      Promise.all(
        [...(target?.querySelectorAll('img') ?? [])].map((img) =>
          img.decode().catch(() => undefined),
        ),
      )
    void Promise.all([import('jsbarcode'), images()]).then(() => {
      if (cancelled) return
      frame = window.requestAnimationFrame(() => {
        window.setTimeout(() => window.print(), 60)
      })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [job, target])

  // Printing from the browser prints the current screen's document, and
  // either way the print root is cleared afterwards.
  useEffect(() => {
    const onBeforePrint = () => {
      const current = printable.current
      // A print started from the app already has its content.
      if (jobRef.current || !current) return
      flushSync(() => setJob({ node: current.node, fromApp: false }))
      current.onPrint?.()
    }
    const onAfterPrint = () => setJob(null)
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [])

  const print = useCallback(
    (node: ReactNode) => setJob({ node, fromApp: true }),
    [],
  )
  const setPrintable = useCallback((next: Printable | null) => {
    printable.current = next
    // Preload the barcode encoder so a browser print can draw it in time.
    if (next) void import('jsbarcode')
  }, [])
  const value = useMemo(() => ({ print, setPrintable }), [print, setPrintable])

  return (
    <PrintContext.Provider value={value}>
      {children}
      {target && job ? createPortal(job.node, target) : null}
    </PrintContext.Provider>
  )
}
