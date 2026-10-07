export default {
  title: 'அறிவிப்புகள்',
  markAllRead: 'அனைத்தையும் படித்ததாகக் குறி',
  empty: 'புதிதாக எதுவும் இல்லை',
  emptyBody: 'ஆய்வகத்தின் புதிய எச்சரிக்கைகள் இங்கே தோன்றும்.',
  needsAttention: 'கவனம் தேவை',
  recent: 'சமீபத்தியவை',
  'summary.critical-pending_one':
    '{count} அவசர முடிவு ஒப்புதலுக்குக் காத்திருக்கிறது',
  'summary.critical-pending_other':
    '{count} அவசர முடிவுகள் ஒப்புதலுக்குக் காத்திருக்கின்றன',
  'summary.tat-approaching_one':
    '{count} பரிசோதனை TAT இலக்கை நெருங்குகிறது அல்லது தாண்டியது',
  'summary.tat-approaching_other':
    '{count} பரிசோதனைகள் TAT இலக்கை நெருங்குகின்றன அல்லது தாண்டியுள்ளன',
  'summary.lots-expiring_one':
    '{count} ரீஏஜென்ட் லாட் 30 நாட்களுக்குள் காலாவதியாகிறது',
  'summary.lots-expiring_other':
    '{count} ரீஏஜென்ட் லாட்கள் 30 நாட்களுக்குள் காலாவதியாகின்றன',
  'summary.recollection-pending_one':
    'நிராகரிக்கப்பட்ட {count} மாதிரி மறுசேகரிப்புக்குக் காத்திருக்கிறது',
  'summary.recollection-pending_other':
    'நிராகரிக்கப்பட்ட {count} மாதிரிகள் மறுசேகரிப்புக்குக் காத்திருக்கின்றன',
  'critical-detected': '{patient} க்கான அவசர மதிப்பு: {analyte} {value}',
  'critical-escalated':
    '{patient} இன் அவசர {analyte} {to} அவர்களுக்கு மேலனுப்பப்பட்டது',
  'sample-rejected': '{patient} இன் மாதிரி {accession} நிராகரிக்கப்பட்டது',
  'recollection-requested': '{patient} க்கு மறுசேகரிப்பு கோரப்பட்டது',
  'report-released': '{patient} க்கான அறிக்கை {report} வெளியிடப்பட்டது',
  'report-corrected':
    '{patient} க்கான அறிக்கை {report} திருத்தப்பட்டது (பதிப்பு {version})',
  'report-withdrawn': '{patient} க்கான அறிக்கை {report} திரும்பப் பெறப்பட்டது',
  'qc-failed': '{equipment} இல் QC தோல்வி: {analyte} {level} ({rule})',
  'equipment-down': '{equipment} சேவையில் இல்லை',
  'lot-quarantined': 'ரீஏஜென்ட் லாட் {lot} ({item}) தனிமைப்படுத்தப்பட்டது',
  'result-returned': '{patient} இன் {test} திருப்பி அனுப்பப்பட்டது: {reason}',
} as const
