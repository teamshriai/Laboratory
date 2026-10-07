// Rule-based suggestions (the insight card) and the auto-verification marks
// in the verification queue. Never a diagnosis: a person decides.
export default {
  title: 'നിർദ്ദേശങ്ങൾ',
  subtitle:
    'ഈ ലാബിന്റെ സ്വന്തം ഡാറ്റയുടെ നിയമാധിഷ്ഠിത പരിശോധനകൾ. തീരുമാനം ഒരു വ്യക്തിയുടേതാണ്.',
  label: 'സ്വയമേവയുള്ള നിർദ്ദേശം: നടപടിക്ക് മുമ്പ് പരിശോധിക്കുക',
  loadError: 'നിർദ്ദേശങ്ങൾ ലോഡ് ചെയ്യാനായില്ല.',
  emptyTitle: 'ഇപ്പോൾ നിർദ്ദേശങ്ങളൊന്നുമില്ല',
  emptyBody: 'സമീപകാല ഡാറ്റയിൽ നിയമങ്ങൾ അസാധാരണമായി ഒന്നും കണ്ടില്ല.',
  // Statements
  'statement.rejection-rise':
    'കഴിഞ്ഞ 7 ദിവസത്തെ സാമ്പിൾ നിരസിക്കൽ {rate}% ആണ് ({count} നിരസിച്ചു), {target}% ലക്ഷ്യത്തിന് മുകളിൽ.',
  'statement.qc-shift-high':
    '{equipment} ൽ {analyte} {level}: അവസാന 4 QC റണ്ണുകളും ശരാശരിയേക്കാൾ 1 SD ൽ കൂടുതൽ മുകളിലാണ്.',
  'statement.qc-shift-low':
    '{equipment} ൽ {analyte} {level}: അവസാന 4 QC റണ്ണുകളും ശരാശരിയേക്കാൾ 1 SD ൽ കൂടുതൽ താഴെയാണ്.',
  'statement.tat-cluster':
    'ജോലിഭാരം {from} മുതൽ {to} വരെ ഏറ്റവും കൂടുതലാണ് (ആഴ്ചയുടെ {share}%), അതേസമയം {delayed}% ഫലങ്ങൾ അവയുടെ TAT ലക്ഷ്യം കടന്നു.',
  'statement.cold-excursion_one':
    'കഴിഞ്ഞ 7 ദിവസത്തിൽ {unit} അതിന്റെ {min} മുതൽ {max} °C പരിധിക്ക് പുറത്ത് {count} തവണ പോയി (അവസാനം {value} °C).',
  'statement.cold-excursion_other':
    'കഴിഞ്ഞ 7 ദിവസത്തിൽ {unit} അതിന്റെ {min} മുതൽ {max} °C പരിധിക്ക് പുറത്ത് {count} തവണ പോയി (അവസാനം {value} °C).',
  // Evidence
  why: 'എന്തുകൊണ്ട്?',
  'why.rejected-count':
    'കഴിഞ്ഞ 7 ദിവസത്തിൽ {recent} സാമ്പിളുകൾ നിരസിച്ചു, അതിനു മുമ്പുള്ള 7 ദിവസത്തിൽ {prior}.',
  'why.collected-count_one': 'കഴിഞ്ഞ 7 ദിവസത്തിൽ {count} സാമ്പിൾ ശേഖരിച്ചു.',
  'why.collected-count_other':
    'കഴിഞ്ഞ 7 ദിവസത്തിൽ {count} സാമ്പിളുകൾ ശേഖരിച്ചു.',
  'why.qc-runs':
    'ഈ കൺട്രോളിന്റെ അവസാന {count} റണ്ണുകളും ശരാശരിയിൽ നിന്ന് {sd} SD ൽ കൂടുതൽ അകലെയാണ്, ഒരേ വശത്ത്.',
  'why.peak-share':
    'കഴിഞ്ഞ 7 ദിവസത്തെ ജോലിയുടെ {share}% ഈ രണ്ട് മണിക്കൂർ സമയത്താണ്.',
  'why.delayed-share':
    'ശരാശരി ഒരു ദിവസം {pct}% ഫലങ്ങൾ അവയുടെ TAT ലക്ഷ്യം കടന്നു.',
  'why.readings_one':
    '{count} റീഡിംഗ് പരിധിക്ക് പുറത്ത്; അവസാനത്തേത് ഏകദേശം {at} IST ന്.',
  'why.readings_other':
    '{count} റീഡിംഗുകൾ പരിധിക്ക് പുറത്ത്; അവസാനത്തേത് ഏകദേശം {at} IST ന്.',
  'why.other': 'സമീപകാല ഡാറ്റയുമായി ഒരു നിയമം പൊരുത്തപ്പെട്ടു.',
  window: '{from} മുതൽ {to} വരെയുള്ള ഡാറ്റ',
  rule: 'നിയമം: {version}',
  sources: 'ഉറവിടങ്ങൾ',
  'source.reception': 'സാമ്പിൾ സ്വീകരണം',
  'source.quality-control': 'ക്വാളിറ്റി കൺട്രോൾ',
  'source.tat': 'TAT നിരീക്ഷണം',
  'source.cold-storage': 'ശീത സംഭരണം',
  'confidence.low': 'കുറഞ്ഞ വിശ്വാസ്യത',
  'confidence.medium': 'ഇടത്തരം വിശ്വാസ്യത',
  'confidence.high': 'ഉയർന്ന വിശ്വാസ്യത',
  // Feedback
  accept: 'സ്വീകരിക്കുക',
  dismiss: 'ഒഴിവാക്കുക',
  notUseful: 'ഉപയോഗപ്രദമല്ല',
  accepted: 'നിങ്ങൾ സ്വീകരിച്ചു',
  acceptedToast: 'നിർദ്ദേശം സ്വീകരിച്ചു',
  dismissedToast: 'നിർദ്ദേശം ഒഴിവാക്കി',
  notUsefulToast: 'നന്ദി. നിർദ്ദേശം മറച്ചു, നിങ്ങളുടെ കാരണം രേഖപ്പെടുത്തി.',
  notUsefulTitle: 'ഈ നിർദ്ദേശം എന്തുകൊണ്ട് ഉപയോഗപ്രദമല്ല?',
  notUsefulBody:
    'നിയമങ്ങൾ മെച്ചപ്പെടുത്താൻ, നിങ്ങളുടെ കാരണം നിർദ്ദേശത്തോടും അതിന്റെ നിയമ പതിപ്പിനോടും ഒപ്പം രേഖപ്പെടുത്തുന്നു.',
  reasonLabel: 'കാരണം',
  reasonPlaceholder:
    'ഉദാഹരണം: ഈ മാറ്റം പുതിയ ലോട്ട് മൂലമാണെന്ന് ഇതിനകം വ്യക്തമാണ്',
  // Auto-verification marks in the verification queue
  'auto.passed': 'ഓട്ടോ-വെരിഫിക്കേഷൻ വിജയിച്ചു',
  'auto.held': 'തടഞ്ഞുവെച്ചു: {checks}',
  'auto.heldLabel': 'ഓട്ടോ-വെരിഫിക്കേഷൻ തടഞ്ഞുവെച്ചു: {checks}',
  'auto.rule': 'ഓട്ടോ-വെരിഫിക്കേഷൻ നിയമം v{version}',
  'auto.check.within-reference': 'റഫറൻസ് ഇടവേളയ്ക്ക് പുറത്ത്',
  'auto.check.no-critical': 'ക്രിട്ടിക്കൽ മൂല്യം',
  'auto.check.no-delta-failure': 'ഡെൽറ്റ പരിശോധന പരാജയപ്പെട്ടു',
  'auto.check.no-instrument-flag': 'ഉപകരണ ഫ്ലാഗ്',
  'auto.check.qc-passed': 'QC വിജയിച്ചില്ല',
  'auto.filter': 'ഓട്ടോ-വെരിഫിക്കേഷൻ വിജയിച്ചവ',
  'auto.filterEmpty': 'ഈ പട്ടികയിലെ ഒരു ഫലവും ഓട്ടോ-വെരിഫിക്കേഷൻ വിജയിച്ചില്ല.',
  'auto.authoriseAll': 'വിജയിച്ചവയെല്ലാം അംഗീകരിക്കുക ({count})',
  'auto.confirmTitle_one':
    'ഓട്ടോ-വെരിഫിക്കേഷൻ വിജയിച്ച {count} ഫലം അംഗീകരിക്കണോ?',
  'auto.confirmTitle_other':
    'ഓട്ടോ-വെരിഫിക്കേഷൻ വിജയിച്ച {count} ഫലങ്ങൾ അംഗീകരിക്കണോ?',
  'auto.confirmBody':
    'ഓരോ ഫലവും അതിന്റെ ഓട്ടോ-വെരിഫിക്കേഷൻ നിയമത്തിലെ എല്ലാ പരിശോധനകളും വിജയിച്ചു. നിയമം അടയാളപ്പെടുത്തുക മാത്രമാണ് ചെയ്യുന്നത്: അംഗീകരിക്കുന്നത് നിങ്ങളാണ്, നിങ്ങളുടെ പേരിൽ ഒപ്പിടുകയും ഓഡിറ്റ് ട്രെയിലിൽ രേഖപ്പെടുത്തുകയും ചെയ്യുന്നു.',
  'auto.confirmAction': 'അംഗീകരിച്ച് ഒപ്പിടുക',
  'auto.confirmList': 'അംഗീകരിക്കേണ്ട ടെസ്റ്റുകൾ',
} as const
