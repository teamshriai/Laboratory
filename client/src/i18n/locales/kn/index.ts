import type { LocaleMessages } from '../../core'
import common from './common'
import dashboard from './dashboard'
import enums from './enums'
import header from './header'
import nav from './nav'
import reports from './reports'

// Translated namespaces; anything missing falls back to English key by key.
const messages: LocaleMessages = {
  common,
  dashboard,
  enums,
  header,
  nav,
  reports,
}

export default messages
