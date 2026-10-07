export default {
  'order-created': '{patient}: {tests} பரிசோதனை(கள்) கொண்ட ஆர்டர் {orderNo}',
  'order-cancelled': '{patient}: ஆர்டர் {orderNo} ரத்துசெய்யப்பட்டது',
  'priority-changed': 'ஆர்டர் {orderNo} {priority} எனக் குறிக்கப்பட்டது',
  'sample-collected': '{patient}: மாதிரி {accession} சேகரிக்கப்பட்டது',
  'sample-received': '{patient}: மாதிரி {accession} பெறப்பட்டது',
  'sample-rejected': '{patient}: மாதிரி {accession} நிராகரிக்கப்பட்டது',
  'sample-rejected-recollect':
    '{patient}: மாதிரி {accession} நிராகரிக்கப்பட்டது, மறுசேகரிப்பு கோரப்பட்டது',
  'results-entered': '{patient}: {accession} க்கான முடிவுகள் பதிவுசெய்யப்பட்டன',
  'results-reviewed':
    '{count} பரிசோதனை(கள்) தொழில்நுட்ப ரீதியாகச் சரிபார்க்கப்பட்டன',
  'results-validated': '{count} பரிசோதனை(கள்) அங்கீகரிக்கப்பட்டன',
  'critical-escalated':
    'அவசர மதிப்பு மேலதிகாரிக்கு அனுப்பப்பட்டது: {patient}, {analyte}, {to} அவர்களுக்கு',
  'critical-detected': 'அவசர மதிப்பு: {patient}, {analyte} {value}',
  'critical-notified': 'அவசர மதிப்பு தெரிவிக்கப்பட்டது: {patient}, {analyte}',
  'critical-acknowledged':
    'அவசர மதிப்பு ஒப்புக்கொள்ளப்பட்டது: {patient}, {analyte}',
  'report-released': '{patient}: அறிக்கை {report} வெளியிடப்பட்டது',
  'report-corrected': '{patient}: அறிக்கை {report} திருத்தப்பட்டது',
  'report-correction-requested':
    'அறிக்கை {report} க்குத் திருத்தம் கோரப்பட்டது (பதிப்பு {version})',
  'report-shared': 'அறிக்கை {report} பகிரப்பட்டது',
  'patient-registered': 'புதிய நோயாளி {patient} ({uhid})',
  'stock-received': 'இருப்பு பெறப்பட்டது: {item} ({quantity})',
  'equipment-logged': '{equipment}: பதிவு புதுப்பிக்கப்பட்டது',
  'qc-recorded': '{equipment} இல் QC பதிவுசெய்யப்பட்டது: {analyte}',
  'test-created': 'பட்டியலில் பரிசோதனை சேர்க்கப்பட்டது: {test}',
  'test-updated': 'பரிசோதனை புதுப்பிக்கப்பட்டது: {test}',
  'test-activated': 'பரிசோதனை செயல்படுத்தப்பட்டது: {test}',
  'test-deactivated': 'பரிசோதனை செயலிழக்கப்பட்டது: {test}',
  'ranges-updated': 'குறிப்பு இடைவெளிகள் புதுப்பிக்கப்பட்டன: {analyte}',
} as const
