import { SearchXIcon } from 'lucide-react'
import { useT } from '@/i18n/context'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/states'

/**
 * What a drawer opened from a link (`?event=`, `?doc=` ...) shows when the
 * record is not there: the link still opens something, says so, and closes.
 */
export function NotFoundDrawer({
  title,
  heading,
  body,
  onClose,
}: {
  /** The drawer's title: the kind of record. */
  title: string
  heading: string
  body: string
  onClose: () => void
}) {
  const tc = useT('common')
  return (
    <Drawer open size="md" onOpenChange={(o) => !o && onClose()} title={title}>
      <EmptyState
        compact
        icon={<SearchXIcon />}
        tone="amber"
        title={heading}
        description={body}
        action={
          <Button variant="secondary" onClick={onClose}>
            {tc('close')}
          </Button>
        }
      />
    </Drawer>
  )
}
