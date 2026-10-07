export default {
  'order-created': '{patient}: ऑर्डर {orderNo}, {tests} टेस्ट',
  'order-cancelled': '{patient}: ऑर्डर {orderNo} रद्द किया गया',
  'priority-changed': 'ऑर्डर {orderNo} को {priority} चिह्नित किया गया',
  'sample-collected': '{patient}: नमूना {accession} संग्रहित',
  'sample-received': '{patient}: नमूना {accession} प्राप्त',
  'sample-rejected': '{patient}: नमूना {accession} अस्वीकृत',
  'sample-rejected-recollect':
    '{patient}: नमूना {accession} अस्वीकृत, पुनः संग्रह का अनुरोध किया गया',
  'results-entered': '{patient}: {accession} के परिणाम दर्ज किए गए',
  'results-reviewed': '{count} टेस्ट का तकनीकी सत्यापन हुआ',
  'results-validated': '{count} टेस्ट अधिकृत',
  'critical-escalated':
    'क्रिटिकल वैल्यू उच्च स्तर पर भेजी गई: {patient}, {analyte}, {to} को',
  'critical-detected': 'क्रिटिकल वैल्यू: {patient}, {analyte} {value}',
  'critical-notified': 'क्रिटिकल वैल्यू सूचित की गई: {patient}, {analyte}',
  'critical-acknowledged':
    'क्रिटिकल वैल्यू की पावती मिली: {patient}, {analyte}',
  'report-released': '{patient}: रिपोर्ट {report} जारी की गई',
  'report-corrected': '{patient}: रिपोर्ट {report} संशोधित की गई',
  'report-correction-requested':
    'रिपोर्ट {report} (संस्करण {version}) के संशोधन का अनुरोध किया गया',
  'report-shared': 'रिपोर्ट {report} भेजी गई',
  'patient-registered': 'नया मरीज़ {patient} ({uhid})',
  'stock-received': 'स्टॉक प्राप्त: {item} ({quantity})',
  'equipment-logged': '{equipment}: लॉग अपडेट किया गया',
  'qc-recorded': '{equipment} पर QC दर्ज: {analyte}',
  'test-created': 'टेस्ट सूची में टेस्ट जोड़ा गया: {test}',
  'test-updated': 'टेस्ट अपडेट किया गया: {test}',
  'test-activated': 'टेस्ट सक्रिय किया गया: {test}',
  'test-deactivated': 'टेस्ट निष्क्रिय किया गया: {test}',
  'ranges-updated': 'संदर्भ अंतराल अपडेट किए गए: {analyte}',
} as const
