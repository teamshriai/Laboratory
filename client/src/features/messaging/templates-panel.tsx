import {
  CircleCheckIcon,
  CircleSlashIcon,
  FileTextIcon,
  MessageSquareDashedIcon,
  PencilIcon,
  PlusIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  MESSAGE_EVENTS,
  type MessageEvent,
  type MessageTemplate,
} from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { LANGUAGE_NAMES } from '@/i18n/core'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { CardSkeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { ChannelLabel } from './channel'
import { TemplateDialog } from './template-dialog'

type Editing =
  | { template: MessageTemplate }
  | { event: MessageEvent }
  | { event?: undefined }

/** Message templates grouped by event, one per channel and language. */
export function TemplatesPanel({
  templates,
  isPending,
  isError,
  onRetry,
}: {
  templates: MessageTemplate[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('network')
  const e = useEnum()
  const [editing, setEditing] = useState<Editing | null>(null)

  let body
  if (isPending)
    body = (
      <div className="grid gap-5">
        {MESSAGE_EVENTS.map((ev) => (
          <CardSkeleton key={ev} lines={3} />
        ))}
      </div>
    )
  else if (isError || !templates)
    body = (
      <Card>
        <ErrorState onRetry={onRetry} />
      </Card>
    )
  else if (templates.length === 0)
    body = (
      <Card>
        <EmptyState
          icon={<MessageSquareDashedIcon />}
          tone="sky"
          title={t('templatesEmptyTitle')}
          description={t('templatesEmptyBody')}
          action={
            <GuardedButton
              permission="messaging.manage"
              variant="primary"
              onClick={() => setEditing({})}
            >
              <PlusIcon strokeWidth={2.5} aria-hidden />
              {t('addTemplate')}
            </GuardedButton>
          }
        />
      </Card>
    )
  else
    body = (
      <div className="grid gap-5">
        {MESSAGE_EVENTS.map((event) => {
          const list = templates.filter((x) => x.event === event)
          const active = list.filter((x) => x.active).length
          return (
            <Card key={event} className="overflow-hidden">
              <CardHeader
                icon={<FileTextIcon />}
                tone="sky"
                title={e('messageEvent', event)}
                description={t('eventTemplateCount', {
                  count: list.length,
                  active,
                })}
                action={
                  <GuardedButton
                    permission="messaging.manage"
                    size="sm"
                    variant="secondary"
                    aria-label={t('addTemplateFor', {
                      event: e('messageEvent', event),
                    })}
                    onClick={() => setEditing({ event })}
                  >
                    <PlusIcon strokeWidth={2.5} aria-hidden />
                    {t('addVariant')}
                  </GuardedButton>
                }
              />
              {list.length === 0 ? (
                <p className="border-t border-line px-4 py-4 text-meta text-fg-muted sm:px-5">
                  {t('eventNoTemplates')}
                </p>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {list.map((tpl) => (
                    <TemplateItem
                      key={tpl.id}
                      template={tpl}
                      onEdit={() => setEditing({ template: tpl })}
                    />
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-meta text-fg-muted">
          {t('templatesIntro')}
        </p>
        <GuardedButton
          permission="messaging.manage"
          variant="primary"
          onClick={() => setEditing({})}
        >
          <PlusIcon strokeWidth={2.5} aria-hidden />
          {t('addTemplate')}
        </GuardedButton>
      </div>
      {body}
      {editing ? (
        <TemplateDialog
          template={'template' in editing ? editing.template : undefined}
          event={'event' in editing ? editing.event : undefined}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

function TemplateItem({
  template: tpl,
  onEdit,
}: {
  template: MessageTemplate
  onEdit: () => void
}) {
  const t = useT('network')
  const tc = useT('common')
  const e = useEnum()
  const label = `${e('messageChannel', tpl.channel)}, ${LANGUAGE_NAMES[tpl.language]}`
  const dltMissing = tpl.channel === 'sms' && !tpl.dltTemplateId
  return (
    <li className="grid gap-2 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <ChannelLabel
            channel={tpl.channel}
            className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-fg"
          />
          <span className="text-meta text-fg-muted">
            {LANGUAGE_NAMES[tpl.language]}
          </span>
          {tpl.active ? (
            <Badge size="sm" tone="success">
              <CircleCheckIcon aria-hidden />
              {t('statusActive')}
            </Badge>
          ) : (
            <Badge size="sm" tone="neutral">
              <CircleSlashIcon aria-hidden />
              {t('statusInactive')}
            </Badge>
          )}
        </div>
        <GuardedButton
          permission="messaging.manage"
          size="xs"
          variant="secondary"
          aria-label={t('editNamed', { name: label })}
          onClick={onEdit}
        >
          <PencilIcon aria-hidden />
          {tc('edit')}
        </GuardedButton>
      </div>
      <p className="line-clamp-3 text-meta break-words whitespace-pre-line text-fg">
        {tpl.body}
      </p>
      {tpl.channel === 'sms' ? (
        dltMissing ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-warning-text">
            <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden />
            {t('dltMissing')}
          </p>
        ) : (
          <p className="text-xs text-fg-muted">
            {t('dltValue')}{' '}
            <span className="font-mono tabular-nums">{tpl.dltTemplateId}</span>
          </p>
        )
      ) : null}
    </li>
  )
}
