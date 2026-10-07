// Helpers shared by the laboratory settings sections.

import { useCallback } from 'react'
import type { LabSettings } from '@/domain/types'
import { usePermissions } from '@/hooks/use-permission'
import { useLanguage } from '@/i18n/context'
import { translate } from '@/i18n/core'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'

/** Whether the acting user may change laboratory settings. */
export function useCanEditSettings() {
  return usePermissions().can('settings.edit')
}

/**
 * Resolves "settings.x" validation keys to text; "forms.x" and "errors.x"
 * pass through for Field to resolve.
 */
export function useSettingsMessage() {
  const { language } = useLanguage()
  return useCallback(
    (message: string | undefined) =>
      message?.startsWith('settings.')
        ? translate(language, 'settings', message.slice(9))
        : message,
    [language],
  )
}

/** Saves part of the settings; a refusal shows as a toast. */
export function useSaveSettings(
  success: (
    saved: LabSettings,
  ) => string | { title: string; description?: string },
  onSuccess?: () => void,
) {
  return useLabMutation(
    (patch: Partial<LabSettings>) => labApi.system.updateSettings(patch),
    { success, ...(onSuccess ? { onSuccess } : {}) },
  )
}

/** A typed whole number, or NaN while the field is empty or not a number. */
export const wholeNumber = (value: string) =>
  /^\s*\d+\s*$/.test(value) ? Number(value) : Number.NaN

/** A typed number (decimals allowed), or NaN. */
export const decimalNumber = (value: string) =>
  /^\s*\d+(\.\d+)?\s*$/.test(value) ? Number(value) : Number.NaN
