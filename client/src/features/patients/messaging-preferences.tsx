import {
  BellOffIcon,
  CircleCheckIcon,
  MessageSquareTextIcon,
} from 'lucide-react'
import { MESSAGE_CHANNELS, type MessageChannel } from '@/domain/types'
import { usePermissions } from '@/hooks/use-permission'
import { useEnum, useT } from '@/i18n/context'
import { labApi, type PatientDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { ChannelLabel } from '@/features/messaging/channel'
import { Card, CardHeader } from '@/components/ui/card'
import { Switch } from '@/components/ui/toggles'
import { Tooltip } from '@/components/ui/tooltip'

/**
 * Which channels the patient may be messaged on. Opting out is honoured by
 * every message the lab records; changing it needs 'patient.edit'.
 */
export function MessagingPreferencesCard({
  patient,
  readOnly,
}: {
  patient: PatientDetail['patient']
  readOnly: boolean
}) {
  const t = useT('network')
  const e = useEnum()
  const { can, why } = usePermissions()
  const allowed = can('patient.edit')
  const save = useLabMutation(
    (v: { channel: MessageChannel; optOut: boolean }) =>
      labApi.network.setOptOut(patient.id, v.channel, v.optOut),
    {
      success: (_, v) =>
        t(v.optOut ? 'prefsOptedOutToast' : 'prefsOptedInToast', {
          channel: e('messageChannel', v.channel),
        }),
    },
  )
  const optedOut = (channel: MessageChannel) =>
    save.isPending && save.variables?.channel === channel
      ? save.variables.optOut
      : Boolean(patient.messagingOptOut[channel])
  const reason = allowed ? '' : why('patient.edit')

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<MessageSquareTextIcon />}
        tone="sky"
        title={t('prefsTitle')}
        description={t('prefsHint')}
      />
      <ul className="divide-y divide-line border-t border-line">
        {MESSAGE_CHANNELS.map((channel) => {
          const out = optedOut(channel)
          const destination =
            channel === 'email' ? patient.email : patient.mobile
          const id = `messaging-pref-${channel}`
          const toggle = (
            <Switch
              id={id}
              checked={!out}
              label={t('prefsSwitchLabel', {
                channel: e('messageChannel', channel),
              })}
              disabled={!allowed || readOnly || save.isPending}
              onCheckedChange={(on) => save.mutate({ channel, optOut: !on })}
            />
          )
          return (
            <li
              key={channel}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0">
                <ChannelLabel
                  channel={channel}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-fg"
                />
                <p className="mt-0.5 text-xs break-all text-fg-muted">
                  {destination ||
                    (channel === 'email'
                      ? t('prefsNoEmail')
                      : t('prefsNoMobile'))}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    out
                      ? 'inline-flex items-center gap-1.5 text-meta font-medium text-warning-text'
                      : 'inline-flex items-center gap-1.5 text-meta text-success-text'
                  }
                >
                  {out ? (
                    <BellOffIcon className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
                  )}
                  {out ? t('prefsOptedOut') : t('prefsAllowed')}
                </span>
                {reason && !readOnly ? (
                  <Tooltip content={reason}>
                    <span tabIndex={0} className="focus-ring rounded-full">
                      {toggle}
                    </span>
                  </Tooltip>
                ) : (
                  toggle
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {reason && !readOnly ? (
        <p className="border-t border-line px-4 py-3 text-xs text-fg-muted sm:px-5">
          {reason}
        </p>
      ) : null}
      <p className="border-t border-line bg-surface-2/60 px-4 py-3 text-xs text-fg-subtle sm:px-5">
        {t('prefsNoGateway')}
      </p>
    </Card>
  )
}
