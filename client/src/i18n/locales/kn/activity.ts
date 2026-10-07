export default {
  'order-created': '{patient}: ಆರ್ಡರ್ {orderNo}, {tests} ಪರೀಕ್ಷೆ(ಗಳು)',
  'order-cancelled': '{patient}: ಆರ್ಡರ್ {orderNo} ರದ್ದಾಗಿದೆ',
  'priority-changed': 'ಆರ್ಡರ್ {orderNo} ಅನ್ನು {priority} ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ',
  'sample-collected': '{patient}: ಮಾದರಿ {accession} ಸಂಗ್ರಹಿಸಲಾಗಿದೆ',
  'sample-received': '{patient}: ಮಾದರಿ {accession} ಸ್ವೀಕರಿಸಲಾಗಿದೆ',
  'sample-rejected': '{patient}: ಮಾದರಿ {accession} ತಿರಸ್ಕರಿಸಲಾಗಿದೆ',
  'sample-rejected-recollect':
    '{patient}: ಮಾದರಿ {accession} ತಿರಸ್ಕರಿಸಲಾಗಿದೆ, ಮರುಸಂಗ್ರಹಕ್ಕೆ ವಿನಂತಿಸಲಾಗಿದೆ',
  'results-entered': '{patient}: {accession} ಗೆ ಫಲಿತಾಂಶ ನಮೂದಿಸಲಾಗಿದೆ',
  'results-reviewed': '{count} ಪರೀಕ್ಷೆ(ಗಳ) ತಾಂತ್ರಿಕ ಪರಿಶೀಲನೆ ಮುಗಿದಿದೆ',
  'results-validated': '{count} ಪರೀಕ್ಷೆ(ಗಳು) ಅಧಿಕೃತಗೊಳಿಸಲಾಗಿದೆ',
  'critical-escalated':
    'ಕ್ರಿಟಿಕಲ್ ಮೌಲ್ಯ ಮೇಲಧಿಕಾರಿಗೆ ರವಾನೆ: {patient}, {analyte}, {to} ಅವರಿಗೆ',
  'critical-detected': 'ಕ್ರಿಟಿಕಲ್ ಮೌಲ್ಯ: {patient}, {analyte} {value}',
  'critical-notified': 'ಕ್ರಿಟಿಕಲ್ ಮೌಲ್ಯ ತಿಳಿಸಲಾಗಿದೆ: {patient}, {analyte}',
  'critical-acknowledged':
    'ಕ್ರಿಟಿಕಲ್ ಮೌಲ್ಯ ಅಂಗೀಕರಿಸಲಾಗಿದೆ: {patient}, {analyte}',
  'report-released': '{patient}: ವರದಿ {report} ಬಿಡುಗಡೆಯಾಗಿದೆ',
  'report-corrected': '{patient}: ವರದಿ {report} ತಿದ್ದುಪಡಿ ಮಾಡಲಾಗಿದೆ',
  'report-correction-requested':
    'ವರದಿ {report} (ಆವೃತ್ತಿ {version}) ತಿದ್ದುಪಡಿಗೆ ವಿನಂತಿಸಲಾಗಿದೆ',
  'report-shared': 'ವರದಿ {report} ಹಂಚಿಕೊಳ್ಳಲಾಗಿದೆ',
  'patient-registered': 'ಹೊಸ ರೋಗಿ {patient} ({uhid})',
  'stock-received': 'ಸ್ಟಾಕ್ ಸ್ವೀಕರಿಸಲಾಗಿದೆ: {item} ({quantity})',
  'equipment-logged': '{equipment}: ಲಾಗ್ ನವೀಕರಿಸಲಾಗಿದೆ',
  'qc-recorded': '{equipment} ನಲ್ಲಿ QC ದಾಖಲಿಸಲಾಗಿದೆ: {analyte}',
  'test-created': 'ಪರೀಕ್ಷಾ ಪಟ್ಟಿಗೆ ಪರೀಕ್ಷೆ ಸೇರಿಸಲಾಗಿದೆ: {test}',
  'test-updated': 'ಪರೀಕ್ಷೆ ನವೀಕರಿಸಲಾಗಿದೆ: {test}',
  'test-activated': 'ಪರೀಕ್ಷೆ ಸಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ: {test}',
  'test-deactivated': 'ಪರೀಕ್ಷೆ ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ: {test}',
  'ranges-updated': 'ಉಲ್ಲೇಖ ಮಧ್ಯಂತರಗಳನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ: {analyte}',
} as const
