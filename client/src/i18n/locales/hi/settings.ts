export default {
  title: 'सेटिंग्स',
  sectionAppearance: 'रूप-रंग',
  sectionLanguage: 'भाषा',
  sectionLaboratory: 'प्रयोगशाला',
  sectionNotifications: 'सूचनाएँ',
  sectionDisplay: 'डिस्प्ले',
  sectionData: 'डेटा',
  sectionAbout: 'जानकारी',
  // Appearance
  themeLight: 'लाइट',
  themeDark: 'डार्क',
  themeSystem: 'सिस्टम',
  themeLightHint: 'अच्छी रोशनी वाली लैब के लिए चमकीली सतहें',
  themeDarkHint: 'रात की शिफ्ट के लिए कम चमक',
  themeSystemHint: 'इस डिवाइस के अनुसार (अभी {mode})',
  modeLight: 'लाइट',
  modeDark: 'डार्क',
  // Language
  languageHint:
    'इस ब्राउज़र के लिए इंटरफ़ेस की भाषा। रिपोर्ट पृष्ठ से रिपोर्ट इनमें से किसी भी भाषा में प्रिंट की जा सकती हैं।',
  translationNote:
    'जिन स्क्रीन का अभी अनुवाद नहीं हुआ है वे अंग्रेज़ी में दिखती हैं।',
  // Laboratory
  labName: 'प्रयोगशाला का नाम',
  reportHeader: 'रिपोर्ट हेडर',
  reportHeaderHint:
    'प्रयोगशाला के नाम के नीचे एक अतिरिक्त पंक्ति, जैसे खुलने का समय। पता और मान्यता के अपने फ़ील्ड हैं।',
  reportFooter: 'रिपोर्ट फ़ुटर',
  tatWarn: 'TAT के करीब, इतने पर',
  tatWarnHint:
    'लक्ष्य का वह प्रतिशत जिस पर नमूना "लक्ष्य के करीब" चिह्नित होता है।',
  tatCritical: 'गंभीर देरी, इतने पर',
  tatCriticalHint: 'लक्ष्य का वह प्रतिशत जिस पर देरी गंभीर मानी जाती है।',
  samplePrefix: 'एक्सेशन नं. प्रीफ़िक्स',
  samplePrefixHint: 'अगला नमूना: {example}',
  defaultDepartment: 'डिफ़ॉल्ट कार्य विभाग',
  allDepartments: 'सभी विभाग',
  defaultLanguage: 'डिफ़ॉल्ट रिपोर्ट भाषा',
  saveLab: 'प्रयोगशाला सेटिंग्स सेव करें',
  labSaved: 'प्रयोगशाला सेटिंग्स सेव की गईं',
  preview: 'रिपोर्ट पूर्वावलोकन',
  // Notifications
  notificationsHint:
    'चुनें कि इस ब्राउज़र पर सूचना पैनल में कौन से अलर्ट दिखें।',
  'alert.critical': 'क्रिटिकल वैल्यू अलर्ट',
  'alert.critical.hint':
    'नए क्रिटिकल परिणाम और वे मान जिन्हें अभी सूचित करना है',
  'alert.tat': 'TAT अलर्ट',
  'alert.tat.hint': 'अपने TAT लक्ष्य के करीब या उससे आगे के नमूने',
  'alert.rejection': 'नमूना अस्वीकृति अलर्ट',
  'alert.rejection.hint': 'अस्वीकृत नमूने और पुनः संग्रह',
  'alert.inventory': 'इन्वेंटरी अलर्ट',
  'alert.inventory.hint': 'क्वारंटाइन और एक्सपायर होने वाले रीएजेंट लॉट',
  'alert.qc': 'QC अलर्ट',
  'alert.qc.hint': 'फ़ेल QC रन',
  'alert.equipment': 'उपकरण अलर्ट',
  'alert.equipment.hint': 'एनालाइज़र की खराबी',
  'alert.reports': 'रिपोर्ट अलर्ट',
  'alert.reports.hint': 'जारी, संशोधित और वापस भेजी गई रिपोर्ट',
  // Display
  sidebarCollapsed: 'साइडबार छोटा करें',
  sidebarCollapsedHint:
    'केवल आइकन दिखाता है, जिससे तालिकाओं के लिए अधिक जगह बचती है।',
  actingAs: 'इस रूप में कार्यरत',
  actingAsHint:
    'कार्रवाइयों पर दर्ज होने वाला स्टाफ सदस्य। इस प्रोटोटाइप में लॉगिन नहीं है।',
  demoLatency: 'नेटवर्क देरी का सिमुलेशन',
  demoLatencyHint:
    'हर अनुरोध में थोड़ी देरी जोड़ता है ताकि लोडिंग स्थितियाँ दिखें।',
  demoFailures: 'अनुरोध विफलताओं का सिमुलेशन',
  demoFailuresHint:
    'त्रुटि प्रबंधन जाँचने के लिए चार में से एक अनुरोध विफल होता है।',
  // Data
  storageUsed: 'इस ब्राउज़र में सेव',
  seededOn: 'डेमो डेटा {time} पर बनाया गया',
  modified: 'बनने के बाद बदला गया',
  unmodified: 'अभी तक नहीं बदला',
  resetTitle: 'डेमो डेटा रीसेट करें',
  resetBody:
    'इस ब्राउज़र में किए गए हर ऑर्डर, नमूने, परिणाम, रिपोर्ट, स्टॉक आवाजाही और सेटिंग बदलाव को हटाता है, और प्रयोगशाला का एक नया दिन बनाता है।',
  resetConfirmHint: 'पुष्टि के लिए RESET लिखें।',
  resetButton: 'डेमो डेटा रीसेट करें',
  resetDone: 'डेमो डेटा रीसेट किया गया',
  // About
  version: 'संस्करण',
  build: 'बिल्ड',
  mode: 'मोड',
  modeValue: 'फ़्रंटएंड प्रोटोटाइप, डेटा इस ब्राउज़र में सेव',
  aboutBody:
    'ऑर्डर से रिपोर्ट तक के वर्कफ़्लो, गुणवत्ता नियंत्रण, इन्वेंटरी और उपकरण प्रबंधन के लिए SHRI HEALTH प्रयोगशाला सूचना प्रणाली।',
  sectionAccessibility: 'सुगम्यता',
  density: 'पंक्ति घनत्व',
  densityHint:
    'कॉम्पैक्ट में स्क्रीन पर अधिक पंक्तियाँ आती हैं। बटन और इनपुट का आकार वही रहता है।',
  densityCompact: 'कॉम्पैक्ट',
  densityComfortable: 'आरामदायक',
  reduceMotion: 'एनिमेशन कम करें',
  reduceMotionHint: 'आपकी डिवाइस सेटिंग के अतिरिक्त, ट्रांज़िशन बंद करता है।',
  highContrast: 'अधिक कंट्रास्ट',
  highContrastHint:
    'तेज़ रोशनी वाले कमरों या कम दृष्टि के लिए गहरा टेक्स्ट और बॉर्डर।',
  largeInterface: 'बड़ा इंटरफ़ेस',
  largeInterfaceHint:
    'चौड़ी स्क्रीन पर अधिक सामग्री के लिए इंटरफ़ेस थोड़ा छोटा दिखाया जाता है। पूरे आकार के टेक्स्ट और नियंत्रणों के लिए इसे चालू करें।',
  labAddress: 'रिपोर्ट पर पता',
  labRegistration: 'पंजीकरण नंबर',
  labAccreditation: 'मान्यता',
  workflowGroup: 'वर्कफ़्लो',
  independentReview: 'स्वतंत्र तकनीकी सत्यापन',
  independentReviewHint:
    'विश्लेषक अपने परिणामों का स्वयं सत्यापन नहीं कर सकता। पैथोलॉजिस्ट फिर भी एक साथ सत्यापन और प्राधिकरण कर सकते हैं।',
  criticalNotify: 'क्रिटिकल वैल्यू सूचना की समय सीमा',
  criticalNotifyHint:
    'इस समय के भीतर सूचित न किए गए अलर्ट "समय सीमा पार" दिखते हैं।',
  minutesValue: '{value} मिनट',
  demoLimitsTitle: 'यह डेमो क्या है, और क्या नहीं',
  demoLimitStorage:
    'हर रिकॉर्ड केवल इसी ब्राउज़र में रहता है। अन्य लोगों या डिवाइस के साथ कुछ भी साझा नहीं होता, और ब्राउज़र साफ़ करने पर यह हट जाता है।',
  demoLimitRoles:
    'भूमिकाएँ सिमुलेटेड हैं: "इस रूप में कार्यरत" से आप बदलते हैं कि आप कौन हैं, और ऐप हर भूमिका लागू करता है, लेकिन लॉगिन नहीं है। वास्तविक एक्सेस नियंत्रण के लिए हर उपयोगकर्ता को प्रमाणित करने वाला सर्वर आवश्यक है।',
  demoLimitAudit:
    'ऑडिट लॉग इस ब्राउज़र में हर बदलाव दर्ज करता है। छेड़छाड़-रोधी, साझा ऑडिट ट्रेल के लिए सर्वर आवश्यक है।',
  demoLimitClinical:
    'मरीज़, परिणाम और रिपोर्ट बनाया गया डेमो डेटा हैं। मरीज़ों की देखभाल के लिए इस सिस्टम का उपयोग न करें।',
  holdRelease: 'क्रिटिकल वैल्यू सूचित होने तक रिपोर्ट जारी करना रोकें',
  holdReleaseHint:
    'चालू: बिना सूचित क्रिटिकल वैल्यू वाली रिपोर्ट जारी नहीं की जा सकती। बंद: रिपोर्ट जारी करना और कॉल किसी भी क्रम में हो सकते हैं, और खुली कॉल डैशबोर्ड पर बनी रहती है।',
  transitAlert: 'रास्ते में नमूनों को इतने समय बाद चिह्नित करें',
  transitAlertHint:
    'इस समय के भीतर प्राप्त न हुए संग्रहित नमूने डैशबोर्ड पर विलंबित दिखते हैं।',
  escalationTitle: 'क्रिटिकल वैल्यू एस्केलेशन',
  escalationHint:
    'जो क्रिटिकल वैल्यू अब तक सूचित नहीं हुई, उसे इसी क्रम में आगे बढ़ाया जाता है। मिनट पहचान के समय से गिने जाते हैं।',
  escalationEmpty:
    'कोई एस्केलेशन स्तर नहीं। सूचित न हुई क्रिटिकल वैल्यू ड्यूटी टीम के पास रहती हैं।',
  escalationTier: 'स्तर {n}',
  escalationAfter: 'इतने मिनट बाद',
  escalationTo: 'किसे भेजें',
  escalationRemove: 'स्तर {n} हटाएँ',
  escalationAdd: 'स्तर जोड़ें',
  escalationMinutesRange: '5 से 1440 तक पूरे मिनट दर्ज करें।',
  escalationOrder: 'पिछले स्तर से बाद का होना चाहिए।',
  reportsGroup: 'रिपोर्ट',
  shareLinkDays: 'शेयर लिंक की वैधता (दिन)',
  shareLinkDaysHint: 'नए रिपोर्ट शेयर लिंक की डिफ़ॉल्ट वैधता, 1 से 30 दिन।',
  shareLinkDaysRange: '1 से 30 तक पूरे दिन दर्ज करें।',
  patientSummary: 'मरीज़ के लिए सरल भाषा में सारांश प्रिंट करें',
  patientSummaryHint:
    'संदर्भ अंतराल से बाहर के परिणाम सरल शब्दों में, मरीज़ की भाषा और अंग्रेज़ी में। इसमें लिखा होता है कि यह निदान नहीं है।',
  // Lab profile
  sectionProfile: 'प्रयोगशाला प्रोफ़ाइल',
  sectionSites: 'साइट',
  sectionModules: 'मॉड्यूल',
  sectionAssistant: 'सहायक और ऑटो-सत्यापन',
  readOnly: 'आप ये सेटिंग्स देख सकते हैं, लेकिन बदल नहीं सकते।',
  unsavedChanges: 'बिना सेव किए बदलाव',
  profileSaved: 'प्रयोगशाला प्रोफ़ाइल सेव की गई',
  saveProfile: 'प्रयोगशाला प्रोफ़ाइल सेव करें',
  percentRange: '0 से 100 तक प्रतिशत दर्ज करें।',
  phoneFormat: '7 से 20 अंकों का फ़ोन नंबर दर्ज करें।',
  dataRequestDaysRange: '1 से 90 तक पूरे दिन दर्ज करें।',
  validToOrder: 'मान्य-से तारीख के बाद की होनी चाहिए।',
  'renewal.valid': 'मान्य',
  'renewal.renew-now': 'अभी नवीनीकरण करें',
  'renewal.expired': 'समाप्त',
  'renewal.unknown': 'समाप्ति तिथि नहीं',
  'renewal.valid.body':
    '{date} तक मान्य, अब से {days} दिन। नवीनीकरण समाप्ति से {window} दिन पहले देय है।',
  'renewal.renew-now.body':
    '{date} को समाप्त, {days} दिन में। अभी नवीनीकरण के लिए आवेदन करें: यह समाप्ति से {window} दिन पहले देय है।',
  'renewal.expired.body':
    '{date} को समाप्त, {days} दिन पहले। जल्द से जल्द नवीनीकरण करें; समाप्त पंजीकरण या मान्यता के अंतर्गत रिपोर्ट जारी नहीं की जानी चाहिए।',
  'renewal.unknown.body':
    'नवीनीकरण पर नज़र रखने के लिए मान्य-तक तारीख दर्ज करें।',
  'renewal.registration': 'क्लिनिकल प्रतिष्ठान पंजीकरण',
  'renewal.nabl': 'NABL मान्यता',
  'profile.registration': 'क्लिनिकल प्रतिष्ठान पंजीकरण',
  'profile.registrationNo': 'पंजीकरण नंबर',
  'profile.authority': 'पंजीकरण प्राधिकरण',
  'profile.authorityHint': 'उदाहरण के लिए, ज़िला पंजीकरण प्राधिकरण।',
  'profile.validFrom': 'मान्य से',
  'profile.validTo': 'मान्य तक',
  'profile.validToHint':
    'इस तारीख से {days} दिन पहले, जब नवीनीकरण देय हो, एक अनुस्मारक दिखता है।',
  'profile.nabl': 'NABL मान्यता',
  'profile.nablHint': 'यदि प्रयोगशाला मान्यता प्राप्त नहीं है तो खाली छोड़ें।',
  'profile.nablCertificate': 'प्रमाणपत्र नंबर',
  'profile.nablValidTo': 'मान्य तक',
  'profile.nablScope': 'दायरा',
  'profile.nablScopeHint':
    'शामिल विषय और टेस्ट, जैसा मान्यता के दायरे में लिखा है।',
  'profile.privacy': 'शिकायत अधिकारी और गोपनीयता अनुरोध',
  'profile.privacyHint':
    'मरीज़ अपने व्यक्तिगत डेटा के बारे में इस व्यक्ति को लिखते हैं (DPDP अधिनियम)। रिपोर्ट और गोपनीयता स्क्रीन पर दिखाया जाता है।',
  'profile.officerName': 'शिकायत अधिकारी',
  'profile.officerEmail': 'ईमेल',
  'profile.officerPhone': 'फ़ोन',
  'profile.dataRequestDays': 'गोपनीयता अनुरोधों का उत्तर इतने समय में (दिन)',
  'profile.dataRequestDaysHint':
    'डेटा देखने, सुधारने या मिटाने के अनुरोध प्राप्त होने के इतने दिन बाद देय होते हैं, 1 से 90।',
  'profile.targets': 'गुणवत्ता संकेतक लक्ष्य',
  'profile.targetsHint':
    'प्रतिशत लक्ष्य जिनके आधार पर गुणवत्ता संकेतक मापे जाते हैं।',
  'target.rejectionPct': 'नमूना अस्वीकृति दर',
  'target.rejectionPct.hint': 'अधिकतम इतने प्रतिशत नमूने अस्वीकृत।',
  'target.tatWithinPct': 'TAT के भीतर रिपोर्ट',
  'target.tatWithinPct.hint': 'कम से कम इतने प्रतिशत रिपोर्ट समय पर।',
  'target.criticalOnTimePct': 'समय पर सूचित क्रिटिकल वैल्यू',
  'target.criticalOnTimePct.hint':
    'कम से कम इतने प्रतिशत सूचना की समय सीमा के भीतर सूचित।',
  'target.amendedPct': 'संशोधित रिपोर्ट',
  'target.amendedPct.hint': 'अधिकतम इतने प्रतिशत रिपोर्ट संशोधित।',
  'target.eqaAcceptablePct': 'स्वीकार्य EQA परिणाम',
  'target.eqaAcceptablePct.hint':
    'कम से कम इतने प्रतिशत बाहरी गुणवत्ता मूल्यांकन परिणाम स्वीकार्य।',
  // Modules
  sizeTier: 'प्रयोगशाला का आकार',
  sizeTierHint:
    'आकार चुनने पर वे मॉड्यूल चालू हो जाते हैं जिनकी उस आकार को आमतौर पर ज़रूरत होती है। बाद में आप कोई भी मॉड्यूल बदल सकते हैं।',
  'tier.small': 'छोटी',
  'tier.small.hint': 'फ़्रंट डेस्क वाली एक कमरे की प्रयोगशाला।',
  'tier.medium': 'मध्यम',
  'tier.medium.hint': 'होम कलेक्शन और स्टॉक प्रबंधन वाली प्रयोगशाला।',
  'tier.large': 'बड़ी',
  'tier.large.hint':
    'इमेजिंग और एनालाइज़र इंटरफ़ेस वाली बहु-विभागीय प्रयोगशाला।',
  tierIncludes: 'चालू करता है: {modules}',
  tierCustomised: 'मॉड्यूल इस आकार के डिफ़ॉल्ट से बदले गए हैं।',
  modulesTitle: 'मॉड्यूल',
  'module.billing': 'बिलिंग',
  'module.billing.hint': 'चालान, भुगतान, पैकेज और दैनिक बही।',
  'module.homeCollection': 'होम कलेक्शन',
  'module.homeCollection.hint': 'संग्रह विज़िट की बुकिंग और रूट तय करना।',
  'module.messaging': 'संदेश',
  'module.messaging.hint':
    'मरीज़ों को रिपोर्ट तैयार होने और रिमाइंडर के संदेश।',
  'module.imaging': 'डायग्नोस्टिक इमेजिंग',
  'module.imaging.hint': 'CT, MRI और X-ray स्टडी और उनकी रिपोर्ट।',
  'module.inventory': 'इन्वेंटरी',
  'module.inventory.hint': 'रीएजेंट लॉट, उपभोग्य सामग्री और स्टॉक स्तर।',
  'module.quality': 'गुणवत्ता प्रणाली',
  'module.quality.hint':
    'दस्तावेज़, ऑडिट, EQA, ऑटो-सत्यापन नियम और शीत भंडारण।',
  'module.compliance': 'रजिस्टर और गोपनीयता',
  'module.compliance.hint': 'वैधानिक रजिस्टर और व्यक्तिगत डेटा अनुरोध।',
  'module.interfaces': 'एनालाइज़र इंटरफ़ेस',
  'module.interfaces.hint': 'एनालाइज़र संदेश, कोड मैपिंग और LOINC कोडिंग।',
  'module.doctorPortal': 'डॉक्टर पोर्टल',
  'module.doctorPortal.hint': 'रेफ़र करने वाले डॉक्टर अपने मरीज़ देखते हैं।',
  inNavigation: 'नेविगेशन में: {items}',
  afterSaving: 'सेव करने के बाद',
  navAppear: 'नेविगेशन में दिखेंगे: {items}।',
  navDisappear: 'नेविगेशन से हटेंगे: {items}।',
  moduleDataKept:
    'बंद किए गए मॉड्यूल के रिकॉर्ड सुरक्षित रहते हैं; उसे फिर से चालू करने पर वे दोबारा दिखते हैं।',
  modulesSaved: 'मॉड्यूल सेव किए गए',
  saveModules: 'मॉड्यूल सेव करें',
  // Sites
  sitesHint:
    'मुख्य प्रयोगशाला और उसकी शाखाएँ व संग्रह केंद्र। ऑर्डर में वह साइट दर्ज होती है जिसने उसे पंजीकृत किया।',
  addSite: 'साइट जोड़ें',
  editSite: 'साइट संपादित करें',
  editSiteNamed: '{name} संपादित करें',
  siteDescription:
    'एक शाखा या संग्रह केंद्र जो मरीज़ों को पंजीकृत करता है और नमूने मुख्य प्रयोगशाला को भेजता है।',
  siteCode: 'कोड',
  siteCodeHint: '2 से 10 बड़े अक्षर, अंक या हाइफ़न।',
  siteCodeFormat: '2 से 10 बड़े अक्षर, अंक या हाइफ़न का उपयोग करें।',
  siteCodeTaken: 'यह कोड पहले से किसी दूसरी साइट का है।',
  siteName: 'नाम',
  siteKind: 'प्रकार',
  'siteKind.main': 'मुख्य प्रयोगशाला',
  'siteKind.branch': 'शाखा',
  'siteKind.satellite': 'संग्रह केंद्र',
  siteMainHint: 'हमेशा ठीक एक मुख्य प्रयोगशाला होती है।',
  siteCity: 'शहर',
  siteActive: 'सक्रिय',
  siteActiveHint: 'निष्क्रिय साइट नए ऑर्डर पंजीकृत नहीं कर सकतीं।',
  siteMainActiveHint: 'मुख्य प्रयोगशाला हमेशा सक्रिय रहती है।',
  siteActiveState: 'सक्रिय',
  siteInactiveState: 'निष्क्रिय',
  siteOrders: 'ऑर्डर, पिछले 30 दिन',
  siteSaved: '{name} सेव की गई',
  sitesEmpty: 'अभी तक कोई साइट नहीं',
  sitesEmptyBody: 'मुख्य प्रयोगशाला और उसके संग्रह केंद्र जोड़ें।',
  // Assistant and auto-verification
  assistantEnabled: 'लैब सहायक',
  assistantEnabledHint:
    'सहायक नियम-आधारित है, AI नहीं: यह डैशबोर्ड वाले ही आँकड़ों से उत्तर देता है। हर प्रश्न उसके आशय से ऑडिट होता है, उसके शब्दों से नहीं।',
  autoVerifyEnabled: 'ऑटो-सत्यापन',
  autoVerifyEnabledHint:
    'डिफ़ॉल्ट रूप से बंद। चालू होने पर, अधिकृत नियम वाले टेस्ट के परिणाम दर्ज करते समय जाँचे जाते हैं, और जो हर जाँच में पास होते हैं वे चिह्नित किए जाते हैं। फिर भी हर परिणाम कोई व्यक्ति ही अधिकृत करता है।',
  autoVerifyOn:
    'चालू: अधिकृत नियम वाले टेस्ट के परिणाम दर्ज करते समय जाँचे जाते हैं।',
  autoVerifyOff:
    'बंद: कोई भी परिणाम ऑटो-सत्यापन नियमों के आधार पर नहीं जाँचा जाता।',
  autoVerifyRules: 'ऑटो-सत्यापन नियम',
  assistantSaved: 'सहायक और ऑटो-सत्यापन सेव किए गए',
  saveAssistant: 'सेव करें',
} as const
