export default {
  title: 'ಅಧಿಸೂಚನೆಗಳು',
  markAllRead: 'ಎಲ್ಲವನ್ನೂ ಓದಿದ್ದು ಎಂದು ಗುರುತಿಸಿ',
  empty: 'ಹೊಸದೇನೂ ಇಲ್ಲ',
  emptyBody: 'ಪ್ರಯೋಗಾಲಯದ ಹೊಸ ಎಚ್ಚರಿಕೆಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.',
  needsAttention: 'ಗಮನ ಬೇಕಾಗಿದೆ',
  recent: 'ಇತ್ತೀಚಿನವು',
  'summary.critical-pending_one':
    '{count} ಕ್ರಿಟಿಕಲ್ ಫಲಿತಾಂಶ ಅಂಗೀಕಾರಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ',
  'summary.critical-pending_other':
    '{count} ಕ್ರಿಟಿಕಲ್ ಫಲಿತಾಂಶಗಳು ಅಂಗೀಕಾರಕ್ಕಾಗಿ ಕಾಯುತ್ತಿವೆ',
  'summary.tat-approaching_one': '{count} ಪರೀಕ್ಷೆ TAT ಗುರಿಯ ಹತ್ತಿರ ಅಥವಾ ಮೀರಿದೆ',
  'summary.tat-approaching_other':
    '{count} ಪರೀಕ್ಷೆಗಳು TAT ಗುರಿಯ ಹತ್ತಿರ ಅಥವಾ ಮೀರಿವೆ',
  'summary.lots-expiring_one':
    '{count} ರಿಯೇಜೆಂಟ್ ಲಾಟ್ 30 ದಿನಗಳೊಳಗೆ ಅವಧಿ ಮುಗಿಯುತ್ತದೆ',
  'summary.lots-expiring_other':
    '{count} ರಿಯೇಜೆಂಟ್ ಲಾಟ್‌ಗಳು 30 ದಿನಗಳೊಳಗೆ ಅವಧಿ ಮುಗಿಯುತ್ತವೆ',
  'summary.recollection-pending_one':
    '{count} ತಿರಸ್ಕೃತ ಮಾದರಿ ಮರುಸಂಗ್ರಹಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ',
  'summary.recollection-pending_other':
    '{count} ತಿರಸ್ಕೃತ ಮಾದರಿಗಳು ಮರುಸಂಗ್ರಹಕ್ಕಾಗಿ ಕಾಯುತ್ತಿವೆ',
  'critical-detected': '{patient} ಅವರ ಕ್ರಿಟಿಕಲ್ ಮೌಲ್ಯ: {analyte} {value}',
  'critical-escalated':
    '{patient} ಅವರ ಕ್ರಿಟಿಕಲ್ {analyte} ಅನ್ನು {to} ಅವರಿಗೆ ರವಾನಿಸಲಾಗಿದೆ',
  'sample-rejected': '{patient} ಅವರ ಮಾದರಿ {accession} ತಿರಸ್ಕರಿಸಲಾಗಿದೆ',
  'recollection-requested': '{patient} ಅವರಿಗೆ ಮರುಸಂಗ್ರಹ ವಿನಂತಿಸಲಾಗಿದೆ',
  'report-released': '{patient} ಅವರ ವರದಿ {report} ಬಿಡುಗಡೆಯಾಗಿದೆ',
  'report-corrected':
    '{patient} ಅವರ ವರದಿ {report} ತಿದ್ದುಪಡಿ ಮಾಡಲಾಗಿದೆ (ಆವೃತ್ತಿ {version})',
  'report-withdrawn': '{patient} ಅವರ ವರದಿ {report} ಹಿಂಪಡೆಯಲಾಗಿದೆ',
  'qc-failed': '{equipment} ನಲ್ಲಿ QC ವಿಫಲ: {analyte} {level} ({rule})',
  'equipment-down': '{equipment} ಸೇವೆಯಲ್ಲಿಲ್ಲ',
  'lot-quarantined': 'ರಿಯೇಜೆಂಟ್ ಲಾಟ್ {lot} ({item}) ಕ್ವಾರಂಟೈನ್ ಮಾಡಲಾಗಿದೆ',
  'result-returned': '{patient} ಅವರ {test} ಹಿಂದಿರುಗಿಸಲಾಗಿದೆ: {reason}',
} as const
