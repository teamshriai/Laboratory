export default {
  title: 'सूचनाएँ',
  markAllRead: 'सभी को पढ़ा हुआ चिह्नित करें',
  empty: 'आपने सब कुछ देख लिया है',
  emptyBody: 'प्रयोगशाला के नए अलर्ट यहाँ दिखेंगे।',
  needsAttention: 'ध्यान देना आवश्यक',
  recent: 'हाल की',
  'summary.critical-pending_one':
    '{count} क्रिटिकल परिणाम पावती की प्रतीक्षा में',
  'summary.critical-pending_other':
    '{count} क्रिटिकल परिणाम पावती की प्रतीक्षा में',
  'summary.tat-approaching_one':
    '{count} टेस्ट अपने TAT लक्ष्य के करीब या उससे अधिक',
  'summary.tat-approaching_other':
    '{count} टेस्ट अपने TAT लक्ष्य के करीब या उससे अधिक',
  'summary.lots-expiring_one': '{count} रीएजेंट लॉट 30 दिनों के भीतर एक्सपायर',
  'summary.lots-expiring_other':
    '{count} रीएजेंट लॉट 30 दिनों के भीतर एक्सपायर',
  'summary.recollection-pending_one':
    '{count} अस्वीकृत नमूना पुनः संग्रह की प्रतीक्षा में',
  'summary.recollection-pending_other':
    '{count} अस्वीकृत नमूने पुनः संग्रह की प्रतीक्षा में',
  'critical-detected': '{patient} की क्रिटिकल वैल्यू: {analyte} {value}',
  'critical-escalated':
    '{patient} का क्रिटिकल {analyte} {to} को उच्च स्तर पर भेजा गया',
  'sample-rejected': '{patient} का नमूना {accession} अस्वीकृत किया गया',
  'recollection-requested': '{patient} के लिए पुनः संग्रह का अनुरोध',
  'report-released': '{patient} की रिपोर्ट {report} जारी की गई',
  'report-corrected':
    '{patient} की रिपोर्ट {report} संशोधित की गई (संस्करण {version})',
  'report-withdrawn': '{patient} की रिपोर्ट {report} वापस ली गई',
  'qc-failed': '{equipment} पर QC फ़ेल: {analyte} {level} ({rule})',
  'equipment-down': '{equipment} सेवा से बाहर है',
  'lot-quarantined': 'रीएजेंट लॉट {lot} ({item}) क्वारंटाइन किया गया',
  'result-returned': '{patient} का {test} वापस भेजा गया: {reason}',
} as const
