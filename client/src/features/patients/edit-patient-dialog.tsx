import { useState } from 'react'
import { BLOOD_GROUPS, type BloodGroup } from '@/domain/types'
import { useT } from '@/i18n/context'
import { labApi, type PatientDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { focusFirstInvalid } from '@/lib/focus'

const MOBILE = /^\+?[\d\s-]{10,15}$/

/** Corrects registration details; every change is kept in the audit trail. */
export function EditPatientDialog({
  patient,
  onClose,
}: {
  patient: PatientDetail['patient']
  onClose: () => void
}) {
  const t = useT('patients')
  const tc = useT('common')
  const [name, setName] = useState(patient.name)
  const [mobile, setMobile] = useState(patient.mobile)
  const [email, setEmail] = useState(patient.email ?? '')
  const [blood, setBlood] = useState<BloodGroup | 'unknown'>(
    patient.bloodGroup ?? 'unknown',
  )
  const [allergies, setAllergies] = useState(patient.allergies.join(', '))
  const [city, setCity] = useState(patient.city)
  const [state, setState] = useState(patient.state)
  const [tried, setTried] = useState(false)
  const errors = {
    name: !name.trim() ? 'forms.required' : undefined,
    mobile: !MOBILE.test(mobile.trim()) ? 'forms.invalidMobile' : undefined,
    email:
      email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())
        ? 'forms.invalidEmail'
        : undefined,
  }
  const invalid = Object.values(errors).filter(Boolean).length
  const save = useLabMutation(
    () =>
      labApi.patients.update(patient.id, {
        name: name.trim(),
        mobile: mobile.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(blood !== 'unknown' ? { bloodGroup: blood } : {}),
        allergies: allergies
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        city: city.trim(),
        state: state.trim(),
      }),
    { success: () => t('updatedToast'), onSuccess: onClose },
  )
  const submit = () => {
    setTried(true)
    if (invalid) {
      window.setTimeout(() => focusFirstInvalid(), 0)
      return
    }
    save.mutate()
  }
  const err = (e: string | undefined) => (tried ? e : undefined)
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('editTitle')}
      description={t('editBody', { uhid: patient.uhid })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {tc('save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {tried && invalid ? (
          <div className="sm:col-span-2">
            <FormErrorSummary
              count={invalid}
              onFocusFirst={() => focusFirstInvalid()}
            />
          </div>
        ) : null}
        <Field
          label={t('fieldName')}
          required
          className="sm:col-span-2"
          error={err(errors.name)}
        >
          <Input value={name} onChange={(ev) => setName(ev.target.value)} />
        </Field>
        <Field label={t('fieldMobile')} required error={err(errors.mobile)}>
          <Input
            type="tel"
            inputMode="tel"
            value={mobile}
            onChange={(ev) => setMobile(ev.target.value)}
          />
        </Field>
        <Field
          label={t('fieldEmail')}
          optionalLabel={tc('optional')}
          error={err(errors.email)}
        >
          <Input
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
        </Field>
        <Field label={t('bloodGroup')}>
          <Select
            value={blood}
            onValueChange={setBlood}
            options={[
              { value: 'unknown' as const, label: t('bloodUnknown') },
              ...BLOOD_GROUPS.map((b) => ({ value: b, label: b })),
            ]}
          />
        </Field>
        <Field label={t('allergies')} hint={t('allergiesHint')}>
          <Input
            value={allergies}
            onChange={(ev) => setAllergies(ev.target.value)}
          />
        </Field>
        <Field label={t('fieldCity')}>
          <Input value={city} onChange={(ev) => setCity(ev.target.value)} />
        </Field>
        <Field label={t('fieldState')}>
          <Input value={state} onChange={(ev) => setState(ev.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}
