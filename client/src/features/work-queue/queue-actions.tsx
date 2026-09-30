import {
  ClipboardListIcon,
  EllipsisIcon,
  EyeIcon,
  PencilLineIcon,
  BadgeCheckIcon,
  CircleUserIcon,
  UserMinusIcon,
  UserPlusIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { useT } from '@/i18n/context'
import {
  labApi,
  type WorkQueueList,
  type WorkQueueRow,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useSampleActions } from '@/features/samples/sample-actions'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { Avatar } from '@/components/ui/misc'
import { useOpenSample } from './use-open-sample'

export function QueueActions({ row }: { row: WorkQueueRow }) {
  const t = useT('workQueue')
  const tc = useT('common')
  const navigate = useNavigate()
  const openSample = useOpenSample()
  const { primary, secondary, dialogs } = useSampleActions(row, {
    compact: true,
  })
  const pendingValidation = row.tests.find(
    (x) =>
      x.active &&
      (x.status === 'entered' ||
        x.status === 'held' ||
        x.status === 'reviewed'),
  )
  let lead = primary
  if (row.status === 'processing' && row.enteredCount > 0 && !row.allEntered)
    lead = (
      <IconButton
        label={t('continueResult')}
        icon={<PencilLineIcon />}
        variant="primary"
        onClick={() => void navigate(`/laboratory/results/${row.id}`)}
      />
    )
  if (
    (row.buckets.includes('awaiting-review') ||
      row.buckets.includes('awaiting-authorisation')) &&
    pendingValidation
  )
    lead = (
      <IconButton
        label={t('validate')}
        icon={<BadgeCheckIcon />}
        variant="primary"
        onClick={() =>
          void navigate(
            `/laboratory/validation?stage=${pendingValidation.status === 'reviewed' ? 'authorise' : 'review'}&item=${pendingValidation.itemId}`,
          )
        }
      />
    )
  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(ev) => ev.stopPropagation()}
    >
      {lead}
      <Menu>
        <MenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={tc('moreActions')}>
            <EllipsisIcon strokeWidth={2.5} />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<EyeIcon />} onSelect={() => openSample(row.id)}>
            {t('openSample')}
          </MenuItem>
          {row.status === 'processing' && !row.allEntered ? (
            <MenuItem
              icon={<PencilLineIcon />}
              onSelect={() => void navigate(`/laboratory/results/${row.id}`)}
            >
              {row.enteredCount ? t('continueResult') : t('enterResult')}
            </MenuItem>
          ) : null}
          <MenuItem
            icon={<CircleUserIcon />}
            onSelect={() =>
              void navigate(`/laboratory/patients/${row.patient.id}`)
            }
          >
            {t('viewPatient')}
          </MenuItem>
          <MenuItem
            icon={<ClipboardListIcon />}
            onSelect={() =>
              void navigate(`/laboratory/orders?order=${row.orderId}`)
            }
          >
            {t('viewOrder')}
          </MenuItem>
          {secondary.length ? <MenuSeparator /> : null}
          {secondary.map((a) => (
            <MenuItem
              key={a.key}
              icon={a.icon}
              onSelect={a.onSelect}
              danger={a.danger}
            >
              {a.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {dialogs}
    </div>
  )
}

export function AssignMenu({
  ids,
  current,
  technicians,
  department,
  trigger,
}: {
  ids: string[]
  current?: { id: string; name: string } | undefined
  technicians: WorkQueueList['technicians']
  department?: WorkQueueRow['department']
  trigger?: 'button'
}) {
  const t = useT('workQueue')
  const assign = useLabMutation(
    (v: { staffId: string | null; name: string }) =>
      labApi.samples.assign(ids, v.staffId),
    {
      success: (_, v) =>
        v.staffId ? t('assignedToast', { name: v.name }) : t('unassignedToast'),
    },
  )
  const bench = technicians.filter(
    (s) => !department || s.department === department,
  )
  const others = technicians.filter(
    (s) => department && s.department !== department,
  )
  return (
    <div onClick={(ev) => ev.stopPropagation()}>
      <Menu>
        <MenuTrigger asChild>
          {trigger === 'button' ? (
            <Button size="sm" variant="secondary" loading={assign.isPending}>
              <UserPlusIcon />
              {t('bulkAssign')}
            </Button>
          ) : current ? (
            <button
              type="button"
              className="-mx-1.5 flex max-w-32 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-meta text-fg hover:bg-surface-2 pointer-coarse:min-h-11"
              aria-label={`${t('reassign')}: ${current.name}`}
            >
              <Avatar name={current.name} size="sm" />
              <span className="truncate">{current.name}</span>
            </button>
          ) : (
            <button
              type="button"
              className="-mx-1.5 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-meta font-medium text-fg-subtle hover:bg-surface-2 hover:text-accent-text"
            >
              <UserPlusIcon className="size-4" />
              {t('assign')}
            </button>
          )}
        </MenuTrigger>
        <MenuContent>
          <MenuLabel>{t('assignTo')}</MenuLabel>
          {[...bench, ...others].map((s) => (
            <MenuItem
              key={s.id}
              icon={<Avatar name={s.name} size="sm" />}
              onSelect={() => assign.mutate({ staffId: s.id, name: s.name })}
              disabled={current?.id === s.id}
            >
              {s.name}
            </MenuItem>
          ))}
          {current ? (
            <>
              <MenuSeparator />
              <MenuItem
                icon={<UserMinusIcon />}
                onSelect={() => assign.mutate({ staffId: null, name: '' })}
              >
                {t('clearAssignee')}
              </MenuItem>
            </>
          ) : null}
        </MenuContent>
      </Menu>
    </div>
  )
}
