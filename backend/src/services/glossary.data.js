/**
 * Starter IP / legal glossary (~20 terms), hardcoded as a fallback and seed
 * dataset. English term -> correct term per target language. Used by the
 * refinement service to enforce consistent, legally accurate terminology.
 *
 * Language codes: hi (Hindi), mr (Marathi), bn (Bengali), gu (Gujarati),
 * ta (Tamil), te (Telugu).
 */
const IP_GLOSSARY = [
  {
    englishTerm: 'patent',
    translations: { hi: 'पेटेंट', mr: 'पेटंट', bn: 'পেটেন্ট', gu: 'પેટન્ટ', ta: 'காப்புரிமை', te: 'పేటెంట్' }
  },
  {
    englishTerm: 'trademark',
    translations: { hi: 'ट्रेडमार्क', mr: 'ट्रेडमार्क', bn: 'ট্রেডমার্ক', gu: 'ટ્રેડમાર્ક', ta: 'வர்த்தக முத்திரை', te: 'ట్రేడ్‌మార్క్' }
  },
  {
    englishTerm: 'copyright',
    translations: { hi: 'कॉपीराइट', mr: 'कॉपीराइट', bn: 'কপিরাইট', gu: 'કોપીરાઇટ', ta: 'பதிப்புரிமை', te: 'కాపీరైట్' }
  },
  {
    englishTerm: 'infringement',
    translations: { hi: 'उल्लंघन', mr: 'उल्लंघन', bn: 'লঙ্ঘন', gu: 'ઉલ્લંઘન', ta: 'மீறல்', te: 'ఉల్లంఘన' }
  },
  {
    englishTerm: 'licensing',
    translations: { hi: 'लाइसेंसिंग', mr: 'परवाना देणे', bn: 'লাইসেন্সিং', gu: 'લાઇસન્સિંગ', ta: 'உரிமம் வழங்குதல்', te: 'లైసెన్సింగ్' }
  },
  {
    englishTerm: 'royalty',
    translations: { hi: 'रॉयल्टी', mr: 'रॉयल्टी', bn: 'রয়্যালটি', gu: 'રોયલ્ટી', ta: 'உரிமத் தொகை', te: 'రాయల్టీ' }
  },
  {
    englishTerm: 'intellectual property',
    translations: {
      hi: 'बौद्धिक संपदा',
      mr: 'बौद्धिक संपदा',
      bn: 'বৌদ্ধিক সম্পত্তি',
      gu: 'બૌદ્ધિક સંપત્તિ',
      ta: 'அறிவுசார் சொத்து',
      te: 'మేధో సంపత్తి'
    }
  },
  {
    englishTerm: 'patentee',
    translations: { hi: 'पेटेंटधारी', mr: 'पेटंटधारक', bn: 'পেটেন্টধারী', gu: 'પેટન્ટ ધારક', ta: 'காப்புரிமையாளர்', te: 'పేటెంట్ దారుడు' }
  },
  {
    englishTerm: 'applicant',
    translations: { hi: 'आवेदक', mr: 'अर्जदार', bn: 'আবেদনকারী', gu: 'અરજદાર', ta: 'விண்ணப்பதாரர்', te: 'దరఖాస్తుదారు' }
  },
  {
    englishTerm: 'prior art',
    translations: { hi: 'पूर्व कला', mr: 'पूर्व कला', bn: 'পূর্ব শিল্প', gu: 'પૂર્વ કલા', ta: 'முந்தைய கலை', te: 'పూర్వ కళ' }
  },
  {
    englishTerm: 'claim',
    translations: { hi: 'दावा', mr: 'दावा', bn: 'দাবি', gu: 'દાવો', ta: 'உரிமைகோரல்', te: 'దావా' }
  },
  {
    englishTerm: 'specification',
    translations: { hi: 'विशिष्टि', mr: 'विशिष्टी', bn: 'বিশিষ্টকরণ', gu: 'સ્પષ્ટીકરણ', ta: 'விவரக்குறிப்பு', te: 'విశిష్టీకరణ' }
  },
  {
    englishTerm: 'assignment',
    translations: { hi: 'समनुदेशन', mr: 'नियुक्ती हस्तांतरण', bn: 'নিয়োগ (হস্তান্তর)', gu: 'સોંપણી', ta: 'ஒப்படைப்பு', te: 'బదిలీ (అసైన్‌మెంట్)' }
  },
  {
    englishTerm: 'license',
    translations: { hi: 'लाइसेंस', mr: 'परवाना', bn: 'লাইসেন্স', gu: 'લાઇસન્સ', ta: 'உரிமம்', te: 'లైసెన్స్' }
  },
  {
    englishTerm: 'injunction',
    translations: { hi: 'निषेधाज्ञा', mr: 'मनाई हुकूम', bn: 'নিষেধাজ্ঞা', gu: 'મનાઈ હુકમ', ta: 'தடையாணை', te: 'నిషేధాజ్ఞ' }
  },
  {
    englishTerm: 'damages',
    translations: { hi: 'हर्जाना', mr: 'नुकसानभरपाई', bn: 'ক্ষতিপূরণ', gu: 'નુકસાની', ta: 'இழப்பீடு', te: 'నష్టపరిహారం' }
  },
  {
    englishTerm: 'geographical indication',
    translations: {
      hi: 'भौगोलिक संकेत',
      mr: 'भौगोलिक संकेत',
      bn: 'ভৌগোলিক নির্দেশক',
      gu: 'ભૌગોલિક સંકેત',
      ta: 'புவிசார் குறியீடு',
      te: 'భౌగోళిక సూచిక'
    }
  },
  {
    englishTerm: 'design',
    translations: { hi: 'अभिकल्प (डिज़ाइन)', mr: 'रचना (डिझाइन)', bn: 'নকশা (ডিজাইন)', gu: 'ડિઝાઇન', ta: 'வடிவமைப்பு', te: 'డిజైన్' }
  },
  {
    englishTerm: 'trade secret',
    translations: { hi: 'व्यापार रहस्य', mr: 'व्यापार गुपित', bn: 'বাণিজ্যিক গোপনীয়তা', gu: 'વેપાર રહસ્ય', ta: 'வர்த்தக இரகசியம்', te: 'వాణిజ్య రహస్యం' }
  },
  {
    englishTerm: 'plaintiff',
    translations: { hi: 'वादी', mr: 'फिर्यादी', bn: 'বাদী', gu: 'ફરિયાદી', ta: 'வாதி', te: 'వాది' }
  },
  {
    englishTerm: 'defendant',
    translations: { hi: 'प्रतिवादी', mr: 'प्रतिवादी', bn: 'বিবাদী', gu: 'પ્રતિવાદી', ta: 'பிரதிவாதி', te: 'ప్రతివాది' }
  },
  {
    englishTerm: 'renewal',
    translations: { hi: 'नवीनीकरण', mr: 'नूतनीकरण', bn: 'নবায়ন', gu: 'નવીકરણ', ta: 'புதுப்பித்தல்', te: 'పునరుద్ధరణ' }
  },
  {
    englishTerm: 'opposition',
    translations: { hi: 'विरोध', mr: 'विरोध', bn: 'বিরোধিতা', gu: 'વિરોધ', ta: 'எதிர்ப்பு', te: 'వ్యతిరేకత' }
  }
];

module.exports = { IP_GLOSSARY };
