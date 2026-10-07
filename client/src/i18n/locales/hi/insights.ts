// नियम-आधारित सुझाव (सुझाव कार्ड) और सत्यापन कतार में ऑटो-सत्यापन चिह्न।
// यह निदान नहीं है: निर्णय व्यक्ति लेता है।
export default {
  title: 'सुझाव',
  subtitle: 'इस लैब के अपने डेटा की नियम-आधारित जाँच। निर्णय व्यक्ति लेता है।',
  label: 'स्वचालित सुझाव: कार्रवाई से पहले जाँच लें',
  loadError: 'सुझाव लोड नहीं हो सके।',
  emptyTitle: 'अभी कोई सुझाव नहीं',
  emptyBody: 'नियमों को हाल के डेटा में कुछ असामान्य नहीं मिला।',
  // कथन
  'statement.rejection-rise':
    'पिछले 7 दिनों में नमूना अस्वीकृति {rate}% है ({count} अस्वीकृत), जो {target}% लक्ष्य से अधिक है।',
  'statement.qc-shift-high':
    '{equipment} पर {analyte} {level}: पिछले 4 QC रन सभी माध्य से 1 SD से अधिक ऊपर हैं।',
  'statement.qc-shift-low':
    '{equipment} पर {analyte} {level}: पिछले 4 QC रन सभी माध्य से 1 SD से अधिक नीचे हैं।',
  'statement.tat-cluster':
    'काम का सबसे अधिक भार {from} से {to} के बीच है (सप्ताह का {share}%), जबकि {delayed}% परिणाम अपने TAT लक्ष्य से आगे गए।',
  'statement.cold-excursion_one':
    '{unit} पिछले 7 दिनों में {count} बार अपनी {min} से {max} °C सीमा से बाहर गया (अंतिम {value} °C)।',
  'statement.cold-excursion_other':
    '{unit} पिछले 7 दिनों में {count} बार अपनी {min} से {max} °C सीमा से बाहर गया (अंतिम {value} °C)।',
  // प्रमाण
  why: 'क्यों?',
  'why.rejected-count':
    'पिछले 7 दिनों में {recent} नमूने अस्वीकृत हुए, उससे पहले के 7 दिनों में {prior}।',
  'why.collected-count_one': 'पिछले 7 दिनों में {count} नमूना एकत्र हुआ।',
  'why.collected-count_other': 'पिछले 7 दिनों में {count} नमूने एकत्र हुए।',
  'why.qc-runs':
    'इस कंट्रोल के पिछले {count} रन सभी माध्य से {sd} SD से अधिक दूर हैं, एक ही ओर।',
  'why.peak-share':
    'पिछले 7 दिनों के काम का {share}% इसी दो घंटे की अवधि में आता है।',
  'why.delayed-share': 'औसतन प्रतिदिन {pct}% परिणाम अपने TAT लक्ष्य से आगे गए।',
  'why.readings_one': '{count} रीडिंग सीमा से बाहर; अंतिम लगभग {at} IST पर।',
  'why.readings_other': '{count} रीडिंग सीमा से बाहर; अंतिम लगभग {at} IST पर।',
  'why.other': 'हाल के डेटा पर एक नियम लागू हुआ।',
  window: '{from} से {to} तक का डेटा',
  rule: 'नियम: {version}',
  sources: 'स्रोत',
  'source.reception': 'नमूना प्राप्ति',
  'source.quality-control': 'गुणवत्ता नियंत्रण',
  'source.tat': 'TAT निगरानी',
  'source.cold-storage': 'शीत भंडारण',
  'confidence.low': 'कम विश्वास',
  'confidence.medium': 'मध्यम विश्वास',
  'confidence.high': 'उच्च विश्वास',
  // प्रतिक्रिया
  accept: 'स्वीकार करें',
  dismiss: 'हटाएँ',
  notUseful: 'उपयोगी नहीं',
  accepted: 'आपने स्वीकार किया',
  acceptedToast: 'सुझाव स्वीकार किया गया',
  dismissedToast: 'सुझाव हटाया गया',
  notUsefulToast: 'धन्यवाद। सुझाव छिपा दिया गया है और आपका कारण दर्ज है।',
  notUsefulTitle: 'यह सुझाव उपयोगी क्यों नहीं है?',
  notUsefulBody:
    'आपका कारण सुझाव और उसके नियम संस्करण के साथ दर्ज होता है, ताकि नियम बेहतर किए जा सकें।',
  reasonLabel: 'कारण',
  reasonPlaceholder: 'उदाहरण: यह बदलाव नए लॉट के कारण पहले से समझा जा चुका है',
  // सत्यापन कतार में ऑटो-सत्यापन चिह्न
  'auto.passed': 'ऑटो-सत्यापन पास',
  'auto.held': 'रोका गया: {checks}',
  'auto.heldLabel': 'ऑटो-सत्यापन ने रोका: {checks}',
  'auto.rule': 'ऑटो-सत्यापन नियम v{version}',
  'auto.check.within-reference': 'संदर्भ अंतराल से बाहर',
  'auto.check.no-critical': 'क्रिटिकल मान',
  'auto.check.no-delta-failure': 'डेल्टा जाँच विफल',
  'auto.check.no-instrument-flag': 'उपकरण फ़्लैग',
  'auto.check.qc-passed': 'QC पास नहीं',
  'auto.filter': 'ऑटो-सत्यापन पास',
  'auto.filterEmpty': 'इस सूची में कोई परिणाम ऑटो-सत्यापन पास नहीं हुआ।',
  'auto.authoriseAll': 'पास हुए सभी अधिकृत करें ({count})',
  'auto.confirmTitle_one':
    'ऑटो-सत्यापन पास करने वाला {count} परिणाम अधिकृत करें?',
  'auto.confirmTitle_other':
    'ऑटो-सत्यापन पास करने वाले {count} परिणाम अधिकृत करें?',
  'auto.confirmBody':
    'हर परिणाम ने अपने ऑटो-सत्यापन नियम की हर जाँच पास की है। नियम केवल चिह्न लगाता है: इन्हें आप अधिकृत करते हैं, ये आपके नाम से हस्ताक्षरित होते हैं और ऑडिट ट्रेल में दर्ज होते हैं।',
  'auto.confirmAction': 'अधिकृत करें और हस्ताक्षर करें',
  'auto.confirmList': 'अधिकृत किए जाने वाले टेस्ट',
} as const
