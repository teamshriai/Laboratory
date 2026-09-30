import {
  CircleCheckIcon,
  InfoIcon,
  CircleAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/app/theme/context'

export function Toaster() {
  const { resolved } = useTheme()
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      offset={{ bottom: 72, right: 20 }}
      gap={10}
      visibleToasts={4}
      icons={{
        success: (
          <CircleCheckIcon strokeWidth={2.2} className="size-5 text-success" />
        ),
        error: (
          <CircleAlertIcon strokeWidth={2.2} className="size-5 text-danger" />
        ),
        warning: (
          <TriangleAlertIcon
            strokeWidth={2.2}
            className="size-5 text-warning"
          />
        ),
        info: <InfoIcon strokeWidth={2.2} className="size-5 text-info" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 font-sans text-fg shadow-card-lg',
          title: 'text-sm font-semibold',
          description: 'mt-0.5 text-meta text-fg-muted',
          actionButton:
            'ml-auto shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent',
          cancelButton:
            'shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-fg-muted',
          icon: 'mt-px',
        },
      }}
    />
  )
}
