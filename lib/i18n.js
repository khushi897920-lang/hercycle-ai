export const translations = {
  EN: {
    nav: { 
      dashboard: 'Dashboard', track: 'Track', insights: 'Insights', chat: 'Chat',
      navDashboard: 'Dashboard', navTrack: 'Track', navInsights: 'Insights', navChat: 'Chat'
    },
    btn: { 
      logToday: 'Log Today 💕', saveLog: "Save Today's Log", exportDoc: "Export Doctor Report 📑", close: "Close",
      navLogToday: 'Log Today 💕'
    },
    hero: { 
      status: 'Cycle Day 14 · Ovulation Window', title1: 'Know your body,', title2: 'love yourself', subtitle: 'AI-powered period tracking with PCOD risk prediction — in Hindi & English. Your health, beautifully understood.', btn1: 'Start Tracking ✨', btn2: 'Check PCOD Risk',
      heroTitle: 'Know your body, love yourself', heroSubtitle: 'AI-powered period tracking with PCOD risk prediction — in Hindi & English.'
    },
    features: { title: 'Core Features', feat1Title: 'Period Tracking', feat1Desc: 'Log your cycle with symptoms, mood, and flow intensity for accurate predictions.', feat2Title: 'Smart Predictions', feat2Desc: 'AI-powered cycle predictions that adapt to irregular patterns.', feat3Title: 'PCOD Risk Analysis', feat3Desc: 'Machine learning model assesses your risk based on cycle data and symptoms.' },
    headings: { 
      insights: 'Health Insights', log: 'Log Your Day',
      sectionCalendar: 'Your Cycle', sectionLog: 'Log Your Day', sectionChat: 'Health Assistant', sectionPCOD: 'PCOD Risk Assessment', sectionPrediction: 'Smart Prediction'
    },
    cycle: { period: 'Period', predicted: 'Predicted', ovulation: 'Ovulation', cycleLen: 'Cycle Length', nextPeriod: 'Next Period', days: 'days' },
    risk: { title: 'PCOD Risk Assessment', riskSub: 'Based on your cycle history and symptoms', riskLevel: 'Risk Level', riskScore: 'Risk score', factor: 'Contributing factors', low: 'LOW RISK', med: 'MEDIUM RISK', high: 'HIGH RISK', healthy: 'Healthy cycle history helps keep risk low.' },
    log: { title: 'Log Your Day 💕', symptoms: "Today's Symptoms", mood: "Today's Mood", flow: "Flow Intensity" }
  },
  'हि': {
    nav: { 
      dashboard: 'डैशबोर्ड', track: 'ट्रैक करें', insights: 'अंतर्दृष्टि', chat: 'चैट',
      navDashboard: 'डैशबोर्ड', navTrack: 'ट्रैक करें', navInsights: 'अंतर्दृष्टि', navChat: 'चैट'
    },
    btn: { 
      logToday: 'आज का लॉग 💕', saveLog: "आज का लॉग सहेजें", exportDoc: "डॉक्टर रिपोर्ट एक्सपोर्ट करें 📑", close: "बंद करें",
      navLogToday: 'आज का लॉग 💕'
    },
    hero: { 
      status: 'चक्र का 14वां दिन · ओव्यूलेशन विंडो', title1: 'अपने शरीर को जानें,', title2: 'खुद से प्यार करें', subtitle: 'PCOD जोखिम भविष्यवाणी के साथ AI-संचालित अवधि ट्रैकिंग - हिंदी और अंग्रेजी में। आपका स्वास्थ्य, खूबसूरती से समझा गया।', btn1: 'ट्रैकिंग शुरू करें ✨', btn2: 'PCOD जोखिम जांचें',
      heroTitle: 'अपने शरीर को जानें, खुद से प्यार करें', heroSubtitle: 'PCOD जोखिम भविष्यवाणी के साथ AI-संचालित अवधि ट्रैकिंग - हिंदी और अंग्रेजी में।'
    },
    features: { title: 'मुख्य विशेषताएं', feat1Title: 'मासिक धर्म ट्रैकिंग', feat1Desc: 'सटीक भविष्यवाणियों के लिए लक्षण, मूड और प्रवाह तीव्रता के साथ अपना चक्र लॉग करें।', feat2Title: 'स्मार्ट प्रेडिक्शन', feat2Desc: 'AI-संचालित चक्र भविष्यवाणियां जो अनियमित पैटर्न के अनुकूल होती हैं।', feat3Title: 'PCOD जोखिम विश्लेषण', feat3Desc: 'मशीन लर्निंग मॉडल चक्र डेटा और लक्षणों के आधार पर आपके जोखिम का मूल्यांकन करता है।' },
    headings: { 
      insights: 'स्वास्थ्य अंतर्दृष्टि', log: 'अपना दिन लॉग करें',
      sectionCalendar: 'आपका चक्र', sectionLog: 'अपना दिन लॉग करें', sectionChat: 'स्वास्थ्य सहायक', sectionPCOD: 'PCOD जोखिम मूल्यांकन', sectionPrediction: 'स्मार्ट प्रेडिक्शन'
    },
    cycle: { period: 'माहवारी', predicted: 'अनुमानित', ovulation: 'ओव्यूलेशन', cycleLen: 'चक्र अवधि', nextPeriod: 'अगली माहवारी', days: 'दिन' },
    risk: { title: 'PCOD जोखिम मूल्यांकन', riskSub: 'आपके चक्र इतिहास और लक्षणों के आधार पर', riskLevel: 'जोखिम स्तर', riskScore: 'जोखिम स्कोर', factor: 'योगदान देने वाले कारक', low: 'कम जोखिम', med: 'मध्यम जोखिम', high: 'उच्च जोखिम', healthy: 'स्वस्थ चक्र इतिहास जोखिम कम रखता है।' },
    log: { title: 'अपना दिन लॉग करें 💕', symptoms: "आज के लक्षण", mood: "आज का मूड", flow: "रक्तस्राव की तीव्रता" }
  }
}

export function t(lang, section, key) {
  return translations[lang]?.[section]?.[key] || translations['EN']?.[section]?.[key] || key
}
