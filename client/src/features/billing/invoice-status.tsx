import {
  BanIcon,
  BuildingIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  Undo2Icon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { InvoiceStatus } from '@/domain/types'
import { useEnum } from '@/i18n/context'
import { Badge, type BadgeTone } from '@/components/ui/badge'

const SPEC: Record<InvoiceStatus, { tone: BadgeTone; icon: ReactNode }> = {
  unpaid: { tone: 'warning', icon: <CircleDashedIcon /> },
  'partially-paid': { tone: 'info', icon: <CircleDotIcon /> },
  paid: { tone: 'success', icon: <CircleCheckIcon /> },
  'on-account': { tone: 'accent', icon: <BuildingIcon /> },
  refunded: { tone: 'neutral', icon: <Undo2Icon /> },
  cancelled: { tone: 'outline', icon: <BanIcon /> },
}

/** An invoice's status, always with an icon and its name. */
export function InvoiceStatusBadge({
  status,
  size,
}: {
  status: InvoiceStatus
  size?: 'sm' | 'md'
}) {
  const e = useEnum()
  const spec = SPEC[status]
  return (
    <Badge tone={spec.tone} size={size}>
      {spec.icon}
      {e('invoiceStatus', status)}
    </Badge>
  )
}
