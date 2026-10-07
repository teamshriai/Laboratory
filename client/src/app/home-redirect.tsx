import { Navigate } from 'react-router'
import { AppLoading } from '@/app/layout/route-states'
import { useVisibleNav } from '@/app/layout/use-visible-nav'
import { useReference } from '@/services/queries'

/** "/" opens the dashboard, or a referring doctor's own patient list. */
export function HomeRedirect() {
  const { isPending } = useReference()
  const { doctorOnly } = useVisibleNav()
  // Wait for the staff list so a doctor is not sent to the dashboard first.
  if (isPending) return <AppLoading />
  return <Navigate to={doctorOnly ? '/my-patients' : '/dashboard'} replace />
}
