// The data source the app is built with. This file serves the mock (and is
// what TypeScript checks against); `VITE_DATA_SOURCE=http` makes Vite
// resolve '@/services/source' to ./http.ts instead (vite.config.ts), so a
// backend build carries no mock code.
export { demo, labApi } from './mock'
