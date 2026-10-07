// Rule-based suggestions (the insight card) and the auto-verification marks
// in the verification queue. Never a diagnosis: a person decides.
export default {
  title: 'பரிந்துரைகள்',
  subtitle:
    'இந்த ஆய்வகத்தின் சொந்தத் தரவின் விதி அடிப்படையிலான சோதனைகள். முடிவு ஒருவர் எடுப்பதே.',
  label: 'தானியங்கு பரிந்துரை: செயல்படும் முன் சரிபார்க்கவும்',
  loadError: 'பரிந்துரைகளை ஏற்ற முடியவில்லை.',
  emptyTitle: 'இப்போது பரிந்துரைகள் இல்லை',
  emptyBody: 'சமீபத்திய தரவில் விதிகள் அசாதாரணமான எதையும் காணவில்லை.',
  // Statements
  'statement.rejection-rise':
    'கடந்த 7 நாட்களில் மாதிரி நிராகரிப்பு {rate}% ({count} நிராகரிக்கப்பட்டன), இது {target}% இலக்கை விட அதிகம்.',
  'statement.qc-shift-high':
    '{equipment} இல் {analyte} {level}: கடைசி 4 QC ஓட்டங்களும் சராசரியை விட 1 SD க்கு மேல் அதிகமாக உள்ளன.',
  'statement.qc-shift-low':
    '{equipment} இல் {analyte} {level}: கடைசி 4 QC ஓட்டங்களும் சராசரியை விட 1 SD க்கு மேல் குறைவாக உள்ளன.',
  'statement.tat-cluster':
    'பணிச்சுமை {from} முதல் {to} வரை உச்சத்தில் உள்ளது (வாரத்தின் {share}%), அதே நேரம் {delayed}% முடிவுகள் தங்கள் TAT இலக்கைத் தாண்டின.',
  'statement.cold-excursion_one':
    'கடந்த 7 நாட்களில் {unit} தன் {min} முதல் {max} °C வரம்பை {count} முறை தாண்டியது (கடைசியாக {value} °C).',
  'statement.cold-excursion_other':
    'கடந்த 7 நாட்களில் {unit} தன் {min} முதல் {max} °C வரம்பை {count} முறை தாண்டியது (கடைசியாக {value} °C).',
  // Evidence
  why: 'ஏன்?',
  'why.rejected-count':
    'கடந்த 7 நாட்களில் {recent} மாதிரிகள் நிராகரிக்கப்பட்டன, அதற்கு முந்தைய 7 நாட்களில் {prior}.',
  'why.collected-count_one':
    'கடந்த 7 நாட்களில் {count} மாதிரி சேகரிக்கப்பட்டது.',
  'why.collected-count_other':
    'கடந்த 7 நாட்களில் {count} மாதிரிகள் சேகரிக்கப்பட்டன.',
  'why.qc-runs':
    'இந்தக் கட்டுப்பாட்டின் கடைசி {count} ஓட்டங்களும் சராசரியிலிருந்து {sd} SD க்கு மேல் விலகியுள்ளன, ஒரே பக்கத்தில்.',
  'why.peak-share':
    'கடந்த 7 நாட்களின் பணியில் {share}% இந்த இரண்டு மணி நேரச் சாளரத்தில் வருகிறது.',
  'why.delayed-share':
    'சராசரியாக ஒரு நாளில் {pct}% முடிவுகள் தங்கள் TAT இலக்கைத் தாண்டின.',
  'why.readings_one':
    '{count} அளவீடு வரம்புக்கு வெளியே; கடைசியாக சுமார் {at} IST மணிக்கு.',
  'why.readings_other':
    '{count} அளவீடுகள் வரம்புக்கு வெளியே; கடைசியாக சுமார் {at} IST மணிக்கு.',
  'why.other': 'சமீபத்திய தரவுடன் ஒரு விதி பொருந்தியது.',
  window: '{from} முதல் {to} வரையிலான தரவு',
  rule: 'விதி: {version}',
  sources: 'மூலங்கள்',
  'source.reception': 'மாதிரி பெறுதல்',
  'source.quality-control': 'தரக் கட்டுப்பாடு',
  'source.tat': 'TAT கண்காணிப்பு',
  'source.cold-storage': 'குளிர் சேமிப்பு',
  'confidence.low': 'குறைந்த நம்பகத்தன்மை',
  'confidence.medium': 'நடுத்தர நம்பகத்தன்மை',
  'confidence.high': 'உயர் நம்பகத்தன்மை',
  // Feedback
  accept: 'ஏற்றுக்கொள்',
  dismiss: 'நீக்கு',
  notUseful: 'பயனில்லை',
  accepted: 'நீங்கள் ஏற்றுக்கொண்டீர்கள்',
  acceptedToast: 'பரிந்துரை ஏற்றுக்கொள்ளப்பட்டது',
  dismissedToast: 'பரிந்துரை நீக்கப்பட்டது',
  notUsefulToast:
    'நன்றி. பரிந்துரை மறைக்கப்பட்டது, உங்கள் காரணம் பதிவு செய்யப்பட்டது.',
  notUsefulTitle: 'இந்தப் பரிந்துரை ஏன் பயனில்லை?',
  notUsefulBody:
    'விதிகளை மேம்படுத்த, உங்கள் காரணம் பரிந்துரையுடனும் அதன் விதிப் பதிப்புடனும் பதிவு செய்யப்படும்.',
  reasonLabel: 'காரணம்',
  reasonPlaceholder:
    'எடுத்துக்காட்டு: இந்த மாற்றம் புதிய லாட்டால் ஏற்கனவே விளக்கப்பட்டது',
  // Auto-verification marks in the verification queue
  'auto.passed': 'தானியங்கு சரிபார்ப்பில் தேர்ச்சி',
  'auto.held': 'நிறுத்தப்பட்டது: {checks}',
  'auto.heldLabel': 'தானியங்கு சரிபார்ப்பு நிறுத்தியது: {checks}',
  'auto.rule': 'தானியங்கு சரிபார்ப்பு விதி v{version}',
  'auto.check.within-reference': 'குறிப்பு இடைவெளிக்கு வெளியே',
  'auto.check.no-critical': 'அவசர மதிப்பு',
  'auto.check.no-delta-failure': 'டெல்டா சோதனை தோல்வி',
  'auto.check.no-instrument-flag': 'கருவிக் கொடி',
  'auto.check.qc-passed': 'QC தேர்ச்சி இல்லை',
  'auto.filter': 'தானியங்கு சரிபார்ப்பில் தேர்ச்சி',
  'auto.filterEmpty':
    'இந்தப் பட்டியலில் எந்த முடிவும் தானியங்கு சரிபார்ப்பில் தேர்ச்சி பெறவில்லை.',
  'auto.authoriseAll': 'தேர்ச்சி பெற்ற அனைத்தையும் அங்கீகரி ({count})',
  'auto.confirmTitle_one':
    'தானியங்கு சரிபார்ப்பில் தேர்ச்சி பெற்ற {count} முடிவை அங்கீகரிக்கவா?',
  'auto.confirmTitle_other':
    'தானியங்கு சரிபார்ப்பில் தேர்ச்சி பெற்ற {count} முடிவுகளை அங்கீகரிக்கவா?',
  'auto.confirmBody':
    'ஒவ்வொரு முடிவும் தன் தானியங்கு சரிபார்ப்பு விதியின் அனைத்துச் சோதனைகளிலும் தேர்ச்சி பெற்றது. விதி குறியிடுகிறது மட்டுமே: அங்கீகரிப்பது நீங்கள், உங்கள் பெயரில் கையொப்பமிடப்பட்டு தணிக்கைப் பதிவில் சேர்க்கப்படும்.',
  'auto.confirmAction': 'அங்கீகரித்துக் கையொப்பமிடு',
  'auto.confirmList': 'அங்கீகரிக்க வேண்டிய சோதனைகள்',
} as const
