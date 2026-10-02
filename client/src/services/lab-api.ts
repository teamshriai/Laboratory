// Single seam between the screens and the data source. Today it re-exports the
// in-browser mock. When the Node backend exists, replace this file with an
// object of the same shape whose methods call the server (fetch against
// `env.apiBaseUrl`, see README "Backend seam"); screens do not change.
export * from '@/mock/api'
