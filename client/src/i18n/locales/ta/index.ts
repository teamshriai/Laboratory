import type { LocaleMessages } from '../../core'
import assistant from './assistant'
import common from './common'
import dashboard from './dashboard'
import enums from './enums'
import header from './header'
import nav from './nav'
import reports from './reports'
import today from './today'

// Translated namespaces; anything missing falls back to English key by key.
const messages: LocaleMessages = {
  assistant,
  common,
  dashboard,
  enums,
  header,
  nav,
  reports,
  today,
}

export default messages
