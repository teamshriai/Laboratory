export default {
  title: 'Settings',
  sectionAppearance: 'Appearance',
  sectionLanguage: 'Language',
  sectionLaboratory: 'Laboratory',
  sectionNotifications: 'Notifications',
  sectionDisplay: 'Display',
  sectionData: 'Data',
  sectionAbout: 'About',
  // Appearance
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  themeLightHint: 'Bright surfaces for well-lit labs',
  themeDarkHint: 'Low glare for night shifts',
  themeSystemHint: 'Follows this device ({mode} now)',
  modeLight: 'light',
  modeDark: 'dark',
  // Language
  languageHint:
    'Interface language for this browser. Reports can be printed in any of these languages from the report page.',
  translationNote: 'Screens not yet translated appear in English.',
  // Laboratory
  labName: 'Laboratory name',
  reportHeader: 'Report header',
  reportHeaderHint:
    'An extra line under the laboratory name, such as opening hours. The address and accreditation have their own fields.',
  reportFooter: 'Report footer',
  tatWarn: 'Approaching TAT at',
  tatWarnHint:
    'Percent of the target at which a sample is flagged as approaching.',
  tatCritical: 'Critical delay at',
  tatCriticalHint: 'Percent of the target at which a delay is critical.',
  samplePrefix: 'Sample ID prefix',
  samplePrefixHint: 'Next sample: {example}',
  defaultDepartment: 'Default working department',
  allDepartments: 'All departments',
  defaultLanguage: 'Default report language',
  saveLab: 'Save laboratory settings',
  labSaved: 'Laboratory settings saved',
  preview: 'Report preview',
  // Notifications
  notificationsHint:
    'Choose which alerts appear in the notification panel on this browser.',
  'alert.critical': 'Critical value alerts',
  'alert.critical.hint':
    'New critical results and values still to be communicated',
  'alert.tat': 'TAT alerts',
  'alert.tat.hint': 'Samples approaching or past their TAT target',
  'alert.rejection': 'Sample rejection alerts',
  'alert.rejection.hint': 'Rejected samples and recollections',
  'alert.inventory': 'Inventory alerts',
  'alert.inventory.hint': 'Quarantined and expiring reagent lots',
  'alert.qc': 'QC alerts',
  'alert.qc.hint': 'Failed QC runs',
  'alert.equipment': 'Equipment alerts',
  'alert.equipment.hint': 'Analyzer breakdowns',
  'alert.reports': 'Report alerts',
  'alert.reports.hint': 'Released, corrected and returned reports',
  // Display
  sidebarCollapsed: 'Collapse the sidebar',
  sidebarCollapsedHint: 'Shows icons only, leaving more room for tables.',
  actingAs: 'Acting as',
  actingAsHint:
    'Staff member recorded on actions. There is no login in this prototype.',
  demoLatency: 'Simulate network delay',
  demoLatencyHint:
    'Adds a short delay to every request so loading states are visible.',
  demoFailures: 'Simulate request failures',
  demoFailuresHint: 'One in four requests fails, to test error handling.',
  // Data
  storageUsed: 'Stored in this browser',
  seededOn: 'Demo data generated {time}',
  modified: 'Changed since generated',
  unmodified: 'Not changed yet',
  resetTitle: 'Reset demo data',
  resetBody:
    'Deletes every order, sample, result, report, stock movement and setting change made in this browser, and generates a fresh laboratory day.',
  resetConfirmHint: 'Type RESET to confirm.',
  resetButton: 'Reset demo data',
  resetDone: 'Demo data reset',
  // About
  version: 'Version',
  build: 'Build',
  mode: 'Mode',
  modeValue: 'Frontend prototype, data stored in this browser',
  aboutBody:
    'SHRI HEALTH laboratory information system for order-to-report workflows, quality control, inventory and equipment management.',
  sectionAccessibility: 'Accessibility',
  density: 'Row density',
  densityHint:
    'Compact fits more rows on screen. Buttons and inputs keep their size.',
  densityCompact: 'Compact',
  densityComfortable: 'Comfortable',
  reduceMotion: 'Reduce motion',
  reduceMotionHint:
    'Turns off transitions, in addition to your device setting.',
  highContrast: 'Higher contrast',
  highContrastHint: 'Darker text and borders for bright rooms or low vision.',
  labAddress: 'Address on reports',
  labRegistration: 'Registration number',
  labAccreditation: 'Accreditation',
  workflowGroup: 'Workflow',
  independentReview: 'Independent technical review',
  independentReviewHint:
    'The analyst cannot review their own results. A pathologist may still review and authorise together.',
  criticalNotify: 'Critical value notification limit',
  criticalNotifyHint:
    'Alerts not communicated within this time show as overdue.',
  minutesValue: '{value} minutes',
} as const
