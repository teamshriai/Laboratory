import { forwardRef, useId } from 'react'
import type { Permission } from '@/domain/permissions'
import { usePermissions } from '@/hooks/use-permission'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

/**
 * A button for an action only some roles may take. For anyone else it is
 * disabled and says who can do it, so nobody is surprised by a refusal (the
 * engine still enforces the rule): in a tooltip with a mouse or keyboard,
 * and in a small popover on a tap (touch screens have no hover).
 */
export const GuardedButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { permission: Permission }
>(function GuardedButton({ permission, disabled, ...props }, ref) {
  const { can, why } = usePermissions()
  const touch = useMediaQuery('(pointer: coarse)')
  const reasonId = useId()
  if (can(permission))
    return <Button ref={ref} disabled={disabled} {...props} />
  const reason = why(permission)
  // A disabled button gets no pointer or focus events; the wrapper carries
  // the reason on hover, keyboard focus and tap.
  if (touch) {
    // Not `disabled` (that swallows the tap): marked unavailable, and the
    // tap opens the reason instead of running the action.
    // `type="button"` so a submit button never submits its form.
    const {
      onClick: _onClick,
      className,
      type: _type,
      form: _form,
      ...rest
    } = props
    void _onClick
    void _type
    void _form
    return (
      <>
        <span id={reasonId} hidden>
          {reason}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              {...rest}
              type="button"
              aria-disabled="true"
              aria-describedby={reasonId}
              className={cn('opacity-50 active:scale-100', className)}
            />
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className="max-w-72 px-3 py-2 text-meta text-fg"
          >
            {reason}
          </PopoverContent>
        </Popover>
      </>
    )
  }
  return (
    <Tooltip content={reason}>
      <span tabIndex={0} className="focus-ring inline-flex rounded-lg">
        <Button ref={ref} disabled {...props} />
      </span>
    </Tooltip>
  )
})
