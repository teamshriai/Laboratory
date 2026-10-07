import { ScanBarcodeIcon } from 'lucide-react'
import { useState } from 'react'
import { useOverlayParam } from '@/hooks/use-search-param'
import { toast } from 'sonner'
import { useT } from '@/i18n/context'
import { labApi } from '@/services/lab-api'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/misc'

const SHORTCUTS = [
  { keys: ['j'], label: 'kbdNext' },
  { keys: ['k'], label: 'kbdPrev' },
  { keys: ['Enter'], label: 'kbdOpen' },
  { keys: ['x'], label: 'kbdSelect' },
  { keys: ['/'], label: 'kbdSearch' },
  { keys: ['?'], label: 'kbdHelp' },
] as const

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT('workQueue')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('shortcutsTitle')}
      description={t('shortcutsDescription')}
    >
      <dl className="grid gap-1">
        {SHORTCUTS.map((s) => (
          <div
            key={s.label}
            className="flex min-h-10 items-center justify-between gap-4 border-b border-line py-1.5 last:border-b-0"
          >
            <dt className="text-sm text-fg">{t(s.label)}</dt>
            <dd className="flex gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}

/**
 * Scan (or type) an accession number to open that specimen over the queue;
 * an order number opens the order.
 */
export function ScanToOpen() {
  const t = useT('workQueue')
  const [, openSample] = useOverlayParam('sample')
  const [, openOrder] = useOverlayParam('order')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const open = (key: 'sample' | 'order', id: string) =>
    key === 'sample' ? openSample(id) : openOrder(id)
  const submit = async () => {
    const ref = value.trim()
    if (!ref || busy) return
    setBusy(true)
    try {
      const sample = await labApi.samples.lookup(ref)
      if (sample) {
        open('sample', sample.id)
        setValue('')
        return
      }
      const exact = await labApi.search.resolve(ref)
      if (exact?.kind === 'specimen' || exact?.kind === 'order') {
        open(exact.kind === 'order' ? 'order' : 'sample', exact.id)
        setValue('')
        return
      }
      toast.error(t('scanNotFound', { ref }))
    } catch {
      toast.error(t('scanNotFound', { ref }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="relative w-full sm:w-60"
      onSubmit={(ev) => {
        ev.preventDefault()
        void submit()
      }}
    >
      <ScanBarcodeIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(ev) => setValue(ev.target.value.toUpperCase())}
        placeholder={t('scanPlaceholder')}
        aria-label={t('scanLabel')}
        aria-busy={busy}
        autoComplete="off"
        enterKeyHint="go"
        className="pl-9 font-mono"
      />
    </form>
  )
}
