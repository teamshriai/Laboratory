import { useCallback } from 'react'
import { useT } from '@/i18n/context'
import type { TKey } from '@/i18n/core'

const PREFIX = 'network.'

/**
 * Form error text for the network and messaging screens: "network.x" keys
 * come from this namespace; Field itself resolves "forms." and "errors.".
 */
export function useNetworkFormText() {
  const t = useT('network')
  return useCallback(
    (message: string | undefined) =>
      message?.startsWith(PREFIX)
        ? t(message.slice(PREFIX.length) as TKey<'network'>)
        : message,
    [t],
  )
}
