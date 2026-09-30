import { forwardRef } from 'react'
import { Button, type ButtonProps } from './button'
import { Tooltip } from './tooltip'

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  /** Accessible name, also shown as a tooltip. */
  label: string
  icon: React.ReactNode
  size?: 'icon' | 'icon-sm' | 'icon-xs'
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, icon, variant = 'ghost', size = 'icon-sm', tooltipSide, ...props },
    ref,
  ) {
    return (
      <Tooltip content={label} side={tooltipSide}>
        <Button
          ref={ref}
          variant={variant}
          size={size}
          aria-label={label}
          {...props}
        >
          {icon}
        </Button>
      </Tooltip>
    )
  },
)
