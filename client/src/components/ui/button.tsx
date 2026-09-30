import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircleIcon } from 'lucide-react'
import { Slot } from 'radix-ui'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const buttonVariants = cva(
  'focus-ring inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent font-semibold transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-on-accent shadow-primary hover:bg-accent-hover hover:shadow-primary-hover',
        secondary:
          'border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2',
        ghost: 'text-fg-subtle hover:bg-surface-2 hover:text-fg',
        soft: 'border-primary-200 bg-primary-50 text-accent-text hover:border-primary-300 hover:bg-primary-100 dark:border-primary-100',
        danger: 'bg-danger text-on-danger shadow-danger hover:opacity-90',
        'danger-soft':
          'border-danger-text/25 bg-danger-soft text-danger-text hover:border-danger-text/40',
        link: 'min-h-0 border-0 px-0 text-accent-text underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        xs: 'min-h-9 gap-1.5 px-3 text-xs pointer-coarse:min-h-11',
        sm: 'min-h-11 gap-1.5 px-3.5 text-xs',
        md: 'min-h-11 px-4 text-sm',
        lg: 'min-h-12 rounded-xl px-5 text-sm',
        icon: 'size-11',
        'icon-sm': 'tap-reach size-9',
        'icon-xs': 'tap-reach size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      asChild,
      loading,
      disabled,
      children,
      type,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot.Root : 'button'
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <LoaderCircleIcon className="animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
