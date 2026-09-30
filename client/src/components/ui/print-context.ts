import { createContext, useContext, useEffect, type ReactNode } from 'react'

export interface Printable {
  node: ReactNode
  /** Called when it is printed from the browser (Ctrl+P, the menu). */
  onPrint?: () => void
}

export const PrintContext = createContext<{
  print: (node: ReactNode) => void
  setPrintable: (printable: Printable | null) => void
}>({ print: () => {}, setPrintable: () => {} })

export const usePrint = () => useContext(PrintContext)

/**
 * Makes `node` what the browser prints while this screen is open, so Ctrl+P
 * prints the document (a report) rather than a blank page.
 */
export function usePrintable(node: ReactNode, onPrint?: () => void) {
  const { setPrintable } = usePrint()
  useEffect(() => {
    setPrintable({ node, ...(onPrint ? { onPrint } : {}) })
    return () => setPrintable(null)
  })
}
