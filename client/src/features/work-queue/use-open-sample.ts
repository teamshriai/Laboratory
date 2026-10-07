import { useOverlayParam } from '@/hooks/use-search-param'

/** Opens the sample drawer over the current page. */
export function useOpenSample() {
  return useOverlayParam('sample')[1]
}
