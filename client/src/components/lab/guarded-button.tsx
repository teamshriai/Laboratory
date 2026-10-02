import { forwardRef } from 'react'
import type { Permission } from '@/domain/permissions'
import { usePermissions } from '@/hooks/use-permission'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

/**
 * A button for an action only some roles may take. For anyone else it is
 * disabled and its tooltip says who can do it, so nobody is surprised by a
 * refusal (the engine still enforces the rule).
 */
export const GuardedButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { permission: Permission }
>(function GuardedButton({ permission, disabled, ...props }, ref) {
  const { can, why } = usePermissions()
  if (can(permission))
    return <Button ref={ref} disabled={disabled} {...props} />
  return (
    <Tooltip content={why(permission)}>
      {/* A disabled button gets no pointer or focus events; the wrapper
          shows the reason on hover and keyboard focus. */}
      <span tabIndex={0} className="focus-ring inline-flex rounded-lg">
        <Button ref={ref} disabled {...props} />
      </span>
    </Tooltip>
  )
})
