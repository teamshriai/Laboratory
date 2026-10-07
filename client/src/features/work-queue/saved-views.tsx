import {
  BookmarkIcon,
  BookmarkPlusIcon,
  ChevronDownIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { useT } from '@/i18n/context'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'

interface SavedView {
  id: string
  name: string
  values: Record<string, string>
}

const NO_VIEWS: SavedView[] = []
const MAX_VIEWS = 20

function isViews(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (v: unknown) =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as SavedView).id === 'string' &&
        typeof (v as SavedView).name === 'string' &&
        typeof (v as SavedView).values === 'object' &&
        (v as SavedView).values !== null &&
        Object.values((v as SavedView).values).every(
          (x) => typeof x === 'string',
        ),
    )
  )
}

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/**
 * Named sets of the work queue's URL filters, kept per acting user in this
 * browser. Mount with `key={actorId}` so switching "acting as" loads that
 * person's views.
 */
export function SavedViewsMenu({
  actorId,
  values,
  defaults,
  onApply,
}: {
  actorId: string
  values: Record<string, string>
  defaults: Record<string, string>
  onApply: (values: Record<string, string>) => void
}) {
  const t = useT('workQueue')
  const tc = useT('common')
  const [views, setViews] = usePersistentState<SavedView[]>(
    `work-queue-views:${actorId}`,
    NO_VIEWS,
    isViews,
  )
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const keys = Object.keys(defaults)
  const filled = (view: SavedView) =>
    Object.fromEntries(keys.map((k) => [k, view.values[k] ?? defaults[k]!]))
  const current = views.find((view) => {
    const v = filled(view)
    return keys.every((k) => v[k] === values[k])
  })
  const replacing = views.find((v) => sameName(v.name, name))

  const save = () => {
    const label = name.trim()
    if (!label) return
    const view: SavedView = {
      id: replacing?.id ?? label.toLocaleLowerCase(),
      name: label,
      values: Object.fromEntries(keys.map((k) => [k, values[k] ?? ''])),
    }
    setViews((prev) =>
      [view, ...prev.filter((v) => v.id !== view.id)].slice(0, MAX_VIEWS),
    )
    toast.success(t('viewSaved', { name: label }))
    setSaving(false)
    setName('')
  }

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant="secondary">
            <BookmarkIcon />
            <span className="max-w-40 truncate">
              {current ? current.name : t('savedViews')}
            </span>
            <ChevronDownIcon className="size-3.5 text-fg-subtle" />
          </Button>
        </MenuTrigger>
        <MenuContent align="end">
          {views.length ? (
            <>
              <MenuLabel>{t('savedViews')}</MenuLabel>
              {views.map((view) => (
                <MenuItem
                  key={view.id}
                  icon={<BookmarkIcon />}
                  onSelect={() => onApply(filled(view))}
                >
                  {view.name}
                </MenuItem>
              ))}
              <MenuSeparator />
            </>
          ) : (
            <p className="px-2.5 py-2 text-meta text-fg-muted">
              {t('noSavedViews')}
            </p>
          )}
          <MenuItem
            icon={<BookmarkPlusIcon />}
            onSelect={() => {
              setName(current?.name ?? '')
              setSaving(true)
            }}
          >
            {t('saveView')}
          </MenuItem>
          {views.length ? (
            <>
              <MenuSeparator />
              <MenuLabel>{t('deleteViews')}</MenuLabel>
              {views.map((view) => (
                <MenuItem
                  key={view.id}
                  icon={<Trash2Icon />}
                  danger
                  onSelect={() => {
                    setViews((prev) => prev.filter((v) => v.id !== view.id))
                    toast.success(t('viewDeleted', { name: view.name }))
                  }}
                >
                  {t('deleteView', { name: view.name })}
                </MenuItem>
              ))}
            </>
          ) : null}
        </MenuContent>
      </Menu>
      <Dialog
        open={saving}
        onOpenChange={setSaving}
        size="sm"
        title={t('saveViewTitle')}
        description={t('saveViewDescription')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaving(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="save-view-form"
              disabled={!name.trim()}
            >
              <BookmarkPlusIcon />
              {replacing ? t('replaceView') : t('saveView')}
            </Button>
          </>
        }
      >
        <form
          id="save-view-form"
          onSubmit={(ev) => {
            ev.preventDefault()
            save()
          }}
        >
          <Field
            label={t('viewName')}
            hint={replacing ? t('viewNameTaken') : undefined}
          >
            <Input
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              placeholder={t('viewNamePlaceholder')}
              maxLength={40}
              autoComplete="off"
              autoFocus
            />
          </Field>
        </form>
      </Dialog>
    </>
  )
}
