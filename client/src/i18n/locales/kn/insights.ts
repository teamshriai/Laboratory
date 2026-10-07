// Rule-based suggestions (the insight card) and the auto-verification marks
// in the verification queue. Never a diagnosis: a person decides.
export default {
  title: 'ಸಲಹೆಗಳು',
  subtitle:
    'ಈ ಪ್ರಯೋಗಾಲಯದ ಸ್ವಂತ ದತ್ತಾಂಶದ ನಿಯಮ ಆಧಾರಿತ ತಪಾಸಣೆಗಳು. ನಿರ್ಧಾರ ವ್ಯಕ್ತಿಯದು.',
  label: 'ಸ್ವಯಂಚಾಲಿತ ಸಲಹೆ: ಕ್ರಮ ಕೈಗೊಳ್ಳುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ',
  loadError: 'ಸಲಹೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.',
  emptyTitle: 'ಈಗ ಯಾವುದೇ ಸಲಹೆಗಳಿಲ್ಲ',
  emptyBody: 'ಇತ್ತೀಚಿನ ದತ್ತಾಂಶದಲ್ಲಿ ನಿಯಮಗಳಿಗೆ ಅಸಾಮಾನ್ಯವಾದದ್ದೇನೂ ಕಂಡುಬಂದಿಲ್ಲ.',
  // Statements
  'statement.rejection-rise':
    'ಕಳೆದ 7 ದಿನಗಳಲ್ಲಿ ಮಾದರಿ ತಿರಸ್ಕಾರ {rate}% ಇದೆ ({count} ತಿರಸ್ಕೃತ), ಇದು {target}% ಗುರಿಗಿಂತ ಹೆಚ್ಚು.',
  'statement.qc-shift-high':
    '{equipment} ನಲ್ಲಿ {analyte} {level}: ಕೊನೆಯ 4 QC ರನ್‌ಗಳೆಲ್ಲವೂ ಸರಾಸರಿಗಿಂತ 1 SD ಗಿಂತ ಹೆಚ್ಚು ಮೇಲಿವೆ.',
  'statement.qc-shift-low':
    '{equipment} ನಲ್ಲಿ {analyte} {level}: ಕೊನೆಯ 4 QC ರನ್‌ಗಳೆಲ್ಲವೂ ಸರಾಸರಿಗಿಂತ 1 SD ಗಿಂತ ಹೆಚ್ಚು ಕೆಳಗಿವೆ.',
  'statement.tat-cluster':
    'ಕೆಲಸದ ಹೊರೆ {from} ರಿಂದ {to} ನಡುವೆ ಗರಿಷ್ಠ (ವಾರದ {share}%), ಹಾಗೆಯೇ {delayed}% ಫಲಿತಾಂಶಗಳು ತಮ್ಮ TAT ಗುರಿಯನ್ನು ಮೀರಿವೆ.',
  'statement.cold-excursion_one':
    '{unit} ಕಳೆದ 7 ದಿನಗಳಲ್ಲಿ {count} ಬಾರಿ ತನ್ನ {min} ರಿಂದ {max} °C ಮಿತಿಯಿಂದ ಹೊರಗೆ ಹೋಗಿದೆ (ಕೊನೆಯದು {value} °C).',
  'statement.cold-excursion_other':
    '{unit} ಕಳೆದ 7 ದಿನಗಳಲ್ಲಿ {count} ಬಾರಿ ತನ್ನ {min} ರಿಂದ {max} °C ಮಿತಿಯಿಂದ ಹೊರಗೆ ಹೋಗಿದೆ (ಕೊನೆಯದು {value} °C).',
  // Evidence
  why: 'ಏಕೆ?',
  'why.rejected-count':
    'ಕಳೆದ 7 ದಿನಗಳಲ್ಲಿ {recent} ಮಾದರಿಗಳು ತಿರಸ್ಕೃತ, ಅದಕ್ಕೂ ಹಿಂದಿನ 7 ದಿನಗಳಲ್ಲಿ {prior}.',
  'why.collected-count_one': 'ಕಳೆದ 7 ದಿನಗಳಲ್ಲಿ {count} ಮಾದರಿ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ.',
  'why.collected-count_other':
    'ಕಳೆದ 7 ದಿನಗಳಲ್ಲಿ {count} ಮಾದರಿಗಳನ್ನು ಸಂಗ್ರಹಿಸಲಾಗಿದೆ.',
  'why.qc-runs':
    'ಈ ಕಂಟ್ರೋಲ್‌ನ ಕೊನೆಯ {count} ರನ್‌ಗಳೆಲ್ಲವೂ ಸರಾಸರಿಯಿಂದ {sd} SD ಗಿಂತ ಹೆಚ್ಚು ದೂರದಲ್ಲಿವೆ, ಒಂದೇ ಬದಿಯಲ್ಲಿ.',
  'why.peak-share':
    'ಕಳೆದ 7 ದಿನಗಳ ಕೆಲಸದ {share}% ಈ ಎರಡು ಗಂಟೆಯ ಅವಧಿಯಲ್ಲಿ ಬರುತ್ತದೆ.',
  'why.delayed-share':
    'ಸರಾಸರಿಯಾಗಿ ದಿನಕ್ಕೆ {pct}% ಫಲಿತಾಂಶಗಳು ತಮ್ಮ TAT ಗುರಿಯನ್ನು ಮೀರಿವೆ.',
  'why.readings_one':
    '{count} ರೀಡಿಂಗ್ ಮಿತಿಯಿಂದ ಹೊರಗೆ; ಕೊನೆಯದು ಸುಮಾರು {at} IST ಕ್ಕೆ.',
  'why.readings_other':
    '{count} ರೀಡಿಂಗ್‌ಗಳು ಮಿತಿಯಿಂದ ಹೊರಗೆ; ಕೊನೆಯದು ಸುಮಾರು {at} IST ಕ್ಕೆ.',
  'why.other': 'ಇತ್ತೀಚಿನ ದತ್ತಾಂಶಕ್ಕೆ ಒಂದು ನಿಯಮ ಹೊಂದಿಕೆಯಾಗಿದೆ.',
  window: '{from} ರಿಂದ {to} ವರೆಗಿನ ದತ್ತಾಂಶ',
  rule: 'ನಿಯಮ: {version}',
  sources: 'ಮೂಲಗಳು',
  'source.reception': 'ಮಾದರಿ ಸ್ವೀಕಾರ',
  'source.quality-control': 'ಗುಣಮಟ್ಟ ನಿಯಂತ್ರಣ',
  'source.tat': 'TAT ಮೇಲ್ವಿಚಾರಣೆ',
  'source.cold-storage': 'ಶೀತ ಸಂಗ್ರಹಣೆ',
  'confidence.low': 'ಕಡಿಮೆ ವಿಶ್ವಾಸ',
  'confidence.medium': 'ಮಧ್ಯಮ ವಿಶ್ವಾಸ',
  'confidence.high': 'ಹೆಚ್ಚಿನ ವಿಶ್ವಾಸ',
  // Feedback
  accept: 'ಸ್ವೀಕರಿಸಿ',
  dismiss: 'ತೆಗೆದುಹಾಕಿ',
  notUseful: 'ಉಪಯುಕ್ತವಲ್ಲ',
  accepted: 'ನೀವು ಸ್ವೀಕರಿಸಿದ್ದೀರಿ',
  acceptedToast: 'ಸಲಹೆಯನ್ನು ಸ್ವೀಕರಿಸಲಾಗಿದೆ',
  dismissedToast: 'ಸಲಹೆಯನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿದೆ',
  notUsefulToast:
    'ಧನ್ಯವಾದಗಳು. ಸಲಹೆಯನ್ನು ಮರೆಮಾಡಲಾಗಿದೆ ಮತ್ತು ನಿಮ್ಮ ಕಾರಣವನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ.',
  notUsefulTitle: 'ಈ ಸಲಹೆ ಏಕೆ ಉಪಯುಕ್ತವಲ್ಲ?',
  notUsefulBody:
    'ನಿಮ್ಮ ಕಾರಣವನ್ನು ಸಲಹೆ ಮತ್ತು ಅದರ ನಿಯಮ ಆವೃತ್ತಿಯೊಂದಿಗೆ ದಾಖಲಿಸಲಾಗುತ್ತದೆ, ಇದರಿಂದ ನಿಯಮಗಳನ್ನು ಸುಧಾರಿಸಬಹುದು.',
  reasonLabel: 'ಕಾರಣ',
  reasonPlaceholder: 'ಉದಾಹರಣೆ: ಈ ಬದಲಾವಣೆಯನ್ನು ಹೊಸ ಲಾಟ್ ಈಗಾಗಲೇ ವಿವರಿಸಿದೆ',
  // Auto-verification marks in the verification queue
  'auto.passed': 'ಸ್ವಯಂ-ಪರಿಶೀಲನೆ ಉತ್ತೀರ್ಣ',
  'auto.held': 'ತಡೆಹಿಡಿಯಲಾಗಿದೆ: {checks}',
  'auto.heldLabel': 'ಸ್ವಯಂ-ಪರಿಶೀಲನೆ ತಡೆಹಿಡಿದಿದೆ: {checks}',
  'auto.rule': 'ಸ್ವಯಂ-ಪರಿಶೀಲನೆ ನಿಯಮ v{version}',
  'auto.check.within-reference': 'ಉಲ್ಲೇಖ ಮಧ್ಯಂತರದಿಂದ ಹೊರಗೆ',
  'auto.check.no-critical': 'ಕ್ರಿಟಿಕಲ್ ಮೌಲ್ಯ',
  'auto.check.no-delta-failure': 'ಡೆಲ್ಟಾ ಚೆಕ್ ವಿಫಲ',
  'auto.check.no-instrument-flag': 'ಉಪಕರಣ ಫ್ಲ್ಯಾಗ್',
  'auto.check.qc-passed': 'QC ಉತ್ತೀರ್ಣವಾಗಿಲ್ಲ',
  'auto.filter': 'ಸ್ವಯಂ-ಪರಿಶೀಲನೆ ಉತ್ತೀರ್ಣ',
  'auto.filterEmpty':
    'ಈ ಪಟ್ಟಿಯಲ್ಲಿ ಯಾವುದೇ ಫಲಿತಾಂಶ ಸ್ವಯಂ-ಪರಿಶೀಲನೆಯಲ್ಲಿ ಉತ್ತೀರ್ಣವಾಗಿಲ್ಲ.',
  'auto.authoriseAll': 'ಉತ್ತೀರ್ಣವಾದ ಎಲ್ಲವನ್ನೂ ಅಧಿಕೃತಗೊಳಿಸಿ ({count})',
  'auto.confirmTitle_one':
    'ಸ್ವಯಂ-ಪರಿಶೀಲನೆಯಲ್ಲಿ ಉತ್ತೀರ್ಣವಾದ {count} ಫಲಿತಾಂಶವನ್ನು ಅಧಿಕೃತಗೊಳಿಸುವುದೇ?',
  'auto.confirmTitle_other':
    'ಸ್ವಯಂ-ಪರಿಶೀಲನೆಯಲ್ಲಿ ಉತ್ತೀರ್ಣವಾದ {count} ಫಲಿತಾಂಶಗಳನ್ನು ಅಧಿಕೃತಗೊಳಿಸುವುದೇ?',
  'auto.confirmBody':
    'ಪ್ರತಿ ಫಲಿತಾಂಶವೂ ತನ್ನ ಸ್ವಯಂ-ಪರಿಶೀಲನೆ ನಿಯಮದ ಪ್ರತಿಯೊಂದು ತಪಾಸಣೆಯಲ್ಲಿ ಉತ್ತೀರ್ಣವಾಗಿದೆ. ನಿಯಮ ಕೇವಲ ಗುರುತಿಸುತ್ತದೆ: ಅಧಿಕೃತಗೊಳಿಸುವವರು ನೀವು, ನಿಮ್ಮ ಹೆಸರಿನಲ್ಲಿ ಸಹಿ ಆಗುತ್ತದೆ ಮತ್ತು ಆಡಿಟ್ ಟ್ರೇಲ್‌ನಲ್ಲಿ ದಾಖಲಾಗುತ್ತದೆ.',
  'auto.confirmAction': 'ಅಧಿಕೃತಗೊಳಿಸಿ ಮತ್ತು ಸಹಿ ಮಾಡಿ',
  'auto.confirmList': 'ಅಧಿಕೃತಗೊಳಿಸಬೇಕಾದ ಪರೀಕ್ಷೆಗಳು',
} as const
