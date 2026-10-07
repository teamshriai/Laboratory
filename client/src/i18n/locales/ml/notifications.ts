export default {
  title: 'അറിയിപ്പുകൾ',
  markAllRead: 'എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക',
  empty: 'പുതിയതായി ഒന്നുമില്ല',
  emptyBody: 'ലബോറട്ടറിയിൽ നിന്നുള്ള പുതിയ അലേർട്ടുകൾ ഇവിടെ കാണാം.',
  needsAttention: 'ശ്രദ്ധ ആവശ്യമുള്ളവ',
  recent: 'സമീപകാലം',
  'summary.critical-pending_one':
    '{count} ക്രിട്ടിക്കൽ ഫലം സ്ഥിരീകരണം കാത്തിരിക്കുന്നു',
  'summary.critical-pending_other':
    '{count} ക്രിട്ടിക്കൽ ഫലങ്ങൾ സ്ഥിരീകരണം കാത്തിരിക്കുന്നു',
  'summary.tat-approaching_one':
    '{count} ടെസ്റ്റ് TAT ലക്ഷ്യത്തിനടുത്തോ അതിനപ്പുറമോ',
  'summary.tat-approaching_other':
    '{count} ടെസ്റ്റുകൾ TAT ലക്ഷ്യത്തിനടുത്തോ അതിനപ്പുറമോ',
  'summary.lots-expiring_one':
    '{count} റീഏജന്റ് ലോട്ടിന്റെ കാലാവധി 30 ദിവസത്തിനുള്ളിൽ തീരും',
  'summary.lots-expiring_other':
    '{count} റീഏജന്റ് ലോട്ടുകളുടെ കാലാവധി 30 ദിവസത്തിനുള്ളിൽ തീരും',
  'summary.recollection-pending_one':
    'നിരസിച്ച {count} സാമ്പിൾ പുനഃശേഖരണം കാത്തിരിക്കുന്നു',
  'summary.recollection-pending_other':
    'നിരസിച്ച {count} സാമ്പിളുകൾ പുനഃശേഖരണം കാത്തിരിക്കുന്നു',
  'critical-detected': '{patient}: ക്രിട്ടിക്കൽ മൂല്യം {analyte} {value}',
  'critical-escalated':
    '{patient}: ക്രിട്ടിക്കൽ {analyte} {to} എന്നവരിലേക്ക് കൈമാറി',
  'sample-rejected': '{patient}: സാമ്പിൾ {accession} നിരസിച്ചു',
  'recollection-requested': '{patient}: പുനഃശേഖരണം ആവശ്യപ്പെട്ടു',
  'report-released': '{patient}: റിപ്പോർട്ട് {report} പുറത്തിറക്കി',
  'report-corrected':
    '{patient}: റിപ്പോർട്ട് {report} ഭേദഗതി ചെയ്തു (പതിപ്പ് {version})',
  'report-withdrawn': '{patient}: റിപ്പോർട്ട് {report} പിൻവലിച്ചു',
  'qc-failed': '{equipment} ൽ QC പരാജയപ്പെട്ടു: {analyte} {level} ({rule})',
  'equipment-down': '{equipment} പ്രവർത്തനരഹിതമാണ്',
  'lot-quarantined': 'റീഏജന്റ് ലോട്ട് {lot} ({item}) ക്വാറന്റൈനിലാക്കി',
  'result-returned': '{patient}: {test} തിരിച്ചയച്ചു: {reason}',
} as const
