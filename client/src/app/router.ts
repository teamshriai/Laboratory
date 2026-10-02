import { createBrowserRouter } from 'react-router'
import { routes } from '@/app/routes'

// The app's URL prefix comes from the build (`base` in vite.config.ts), so
// the router and the asset URLs can never disagree.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export const router = createBrowserRouter(routes, { basename })
