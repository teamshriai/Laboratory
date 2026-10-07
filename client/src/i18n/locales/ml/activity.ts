export default {
  'order-created': '{patient}: {tests} ടെസ്റ്റ്(കൾ) ഉള്ള ഓർഡർ {orderNo}',
  'order-cancelled': '{patient}: ഓർഡർ {orderNo} റദ്ദാക്കി',
  'priority-changed': 'ഓർഡർ {orderNo} {priority} ആയി അടയാളപ്പെടുത്തി',
  'sample-collected': '{patient}: സാമ്പിൾ {accession} ശേഖരിച്ചു',
  'sample-received': '{patient}: സാമ്പിൾ {accession} ലഭിച്ചു',
  'sample-rejected': '{patient}: സാമ്പിൾ {accession} നിരസിച്ചു',
  'sample-rejected-recollect':
    '{patient}: സാമ്പിൾ {accession} നിരസിച്ചു, പുനഃശേഖരണം ആവശ്യപ്പെട്ടു',
  'results-entered': '{patient}: {accession} എന്നതിന്റെ ഫലങ്ങൾ നൽകി',
  'results-reviewed': '{count} ടെസ്റ്റ്(കൾ) സാങ്കേതികമായി പരിശോധിച്ചു',
  'results-validated': '{count} ടെസ്റ്റ്(കൾ) അംഗീകരിച്ചു',
  'critical-escalated':
    'ക്രിട്ടിക്കൽ മൂല്യം ഉയർന്ന തലത്തിലേക്ക് കൈമാറി: {patient}, {analyte}, {to}',
  'critical-detected': 'ക്രിട്ടിക്കൽ മൂല്യം: {patient}, {analyte} {value}',
  'critical-notified': 'ക്രിട്ടിക്കൽ മൂല്യം അറിയിച്ചു: {patient}, {analyte}',
  'critical-acknowledged':
    'ക്രിട്ടിക്കൽ മൂല്യം സ്ഥിരീകരിച്ചു: {patient}, {analyte}',
  'report-released': '{patient}: റിപ്പോർട്ട് {report} പുറത്തിറക്കി',
  'report-corrected': '{patient}: റിപ്പോർട്ട് {report} തിരുത്തി',
  'report-correction-requested':
    'റിപ്പോർട്ട് {report} (പതിപ്പ് {version}) തിരുത്താൻ ആവശ്യപ്പെട്ടു',
  'report-shared': 'റിപ്പോർട്ട് {report} അയച്ചു',
  'patient-registered': 'പുതിയ രോഗി {patient} ({uhid})',
  'stock-received': 'സ്റ്റോക്ക് ലഭിച്ചു: {item} ({quantity})',
  'equipment-logged': '{equipment}: ലോഗ് പുതുക്കി',
  'qc-recorded': '{equipment} ൽ QC രേഖപ്പെടുത്തി: {analyte}',
  'test-created': 'കാറ്റലോഗിൽ ടെസ്റ്റ് ചേർത്തു: {test}',
  'test-updated': 'ടെസ്റ്റ് പുതുക്കി: {test}',
  'test-activated': 'ടെസ്റ്റ് സജീവമാക്കി: {test}',
  'test-deactivated': 'ടെസ്റ്റ് നിർജ്ജീവമാക്കി: {test}',
  'ranges-updated': 'റഫറൻസ് ഇടവേളകൾ പുതുക്കി: {analyte}',
} as const
