/**
 * Omar Tariq's WhatsApp Translator - Dialect & Slang Classifier
 * 
 * Analyzes incoming and outgoing messages to intelligently detect:
 * 1. Arabic Colloquial Dialects (العامية: Egyptian, Levantine, Gulf, Maghrebi)
 * 2. Arabizi / Franco-Arab (Latin chat with numbers: 3, 7, 5, 2)
 * 3. Turkish Street Slang & Casual Discourse Markers
 * 4. General Internet Acronyms, Sarcasm & Chat Slang
 * 
 * NOTE: Uses Unicode boundary markers (?<![\p{L}\p{N}]) and (?![\p{L}\p{N}])
 * instead of ASCII \b so Arabic and non-Latin words match accurately.
 */

(() => {
  'use strict';

  function buildPattern(term) {
    // Escapes special characters and wraps in Unicode word boundaries
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u');
  }

  // 1. ARABIC DIALECT TOKENS (العامية)
  const EGYPTIAN_TERMS = [
    'يا اسطى',
    'فكك',
    'حوار',
    'معلش',
    'عامل ايه',
    'ازاي',
    'ازيك',
    'عاوز',
    'عايز',
    'علشان',
    'عشان',
    'اوي',
    'طحن',
    'جدع',
    'كبر مخك',
    'سكة',
    'دوشة',
    'روش',
    'خلاص بقى',
    'يا عم',
    'يا راجل',
    'ايه ده',
    'بتاع',
    'كده',
    'ده',
    'دي',
    'دول',
    'برضو',
    'برضه',
    'ينفع',
    'مش',
    'شويه',
    'شوية',
    'اصبر عليا',
    'اصبر',
    'حته',
    'حتة',
    'حاجة',
    'حاجه',
    'ليه',
    'امتى',
    'فين',
    'مين',
    'ايه',
    'إيه',
    'فهمت ايه',
    'هيفهمها',
    'بالعاميه',
    'بالعامية',
    'كدا',
    'بتاعت',
    'بتوع',
    'بتانا',
    'بقى',
    'بقا',
    'دلوقتي',
    'دلوقت',
    'قوي',
    'كويس',
    'اصل',
    'اصلا',
    'ماشي',
    'يلا',
    'يلّا',
    'مترين',
    'هيعرب',
    'جاي',
    'رايح',
    'نازل',
    'طالع',
    'تنزل',
    'تطلع',
    'انزل',
    'اطلع',
    'السكن',
    'سكن',
    'الستادي',
    'هرن',
    'رن',
    'هرنلك',
    'توهت',
    'توهت للدرجادي',
    'للدرجادي',
    'للدرجة دي',
    'فينك',
    'فينك كده',
    'هطلت',
    'هطلع',
    'اتوضى',
    'اصلس',
    'اصلي',
    'موجود هناك',
    'كمان'
  ];

  const LEVANTINE_TERMS = [
    'شو في ما في',
    'شو',
    'بدك',
    'بدي',
    'بدو',
    'بدنا',
    'هلق',
    'هسا',
    'زلمة',
    'كتير',
    'منيح',
    'شباك',
    'شوفي',
    'ولو',
    'يخرب بيتك',
    'هيك',
    'هاد',
    'هدول',
    'ولا يهمك',
    'يسلمو',
    'تقبرني',
    'حبيب قلبي'
  ];

  const GULF_TERMS = [
    'وش ذا',
    'وش سالفتك',
    'وش',
    'كفو',
    'يا ريال',
    'ابشر',
    'تبشر',
    'تكفى',
    'ما قصرت',
    'شخبارك',
    'شلونك',
    'اشلونك',
    'عساك',
    'طال عمرك',
    'وايد',
    'حيل',
    'فديتك',
    'ياخي',
    'زين',
    'ما يمدي',
    'ارحب'
  ];

  const EGYPTIAN_PATTERNS = EGYPTIAN_TERMS.map(buildPattern);
  const LEVANTINE_PATTERNS = [
    ...LEVANTINE_TERMS.map(buildPattern),
    /(?<![\p{L}\p{N}])عم\s+[\u0600-\u06FF]+/u // Progressive 'عم' prefix
  ];
  const GULF_PATTERNS = GULF_TERMS.map(buildPattern);

  // 2. ARABIZI / FRANCO-ARAB (Numbers in Latin words representing Arabic letters: 3=ع, 7=ح, 5=خ, 2=ء)
  const ARABIZI_PATTERN = /\b[a-zA-Z]*[2357][a-zA-Z0-9]*\b/i;

  // 3. TURKISH STREET SLANG & DISCOURSE MARKERS
  const TURKISH_SLANG_PATTERNS = [
    /\b(kanka|kanki|knk)\b/i,
    /\bboş\s*yapma\b/i,
    /\baynen(\s*öyle)?\b/i,
    /\b(ulan|lan)\b/i,
    /\bvalla(hi)?\b/i,
    /\bhelal\s*olsun\b/i,
    /\bkafayı\s*yersin\b/i,
    /\bhadi\s*ordan\b/i,
    /\beyvallah\b/i,
    /\b(naber|naapıyon|napıyon|noldu)\b/i,
    /\bsıkıntı\s*yok\b/i,
    /\btakma\s*kafana\b/i,
    /\bhayırdır\b/i,
    /\bmoruk\b/i,
    /\babi\s*ya\b/i,
    /\bharbiden\b/i,
    /\bçakmak\b/i,
    /\bçaktırma\b/i,
    /\boyle\s*mi\b/i,
    /\bkafana\s*göre\b/i,
    /\b(bişi|bisi)\b/i,
    /\byapacak\s+(bişi|bisi|bir\s+şey)\s+yok\b/i,
    /\b(gidecen|yapacan|edicen|gelicen|gidiyon|geliyon|bakıyon|yapıyon)\b/i,
    /\b(boşver|baksana|nolsun|hadi\s+gidelim)\b/i
  ];

  // 4. COMMON CHAT ACRONYMS & INFORMAL EXPRESSIONS
  const CHAT_SLANG_PATTERNS = [
    /\b(idk|tbh|lmao|lmfao|wtf|brb|omfg|ngl|smh|rofl|stfu|afaik|fyi|btw|imho|ikr|g2g|ttyl)\b/i,
    /\b(bruh|dude|homie|fr\s*fr|no\s*cap|cringe|based|slay|rizz)\b/i
  ];

  /**
   * Classify whether a message contains slang, colloquial dialect, or informal chat idioms
   * @param {string} text 
   * @returns {{ isDialectOrSlang: boolean, reason: string | null, detectedCategory: string | null }}
   */
  function classifyMessage(text) {
    if (!text || typeof text !== 'string') {
      return { isDialectOrSlang: false, reason: null, detectedCategory: null };
    }

    const clean = text.replace(/⟦\d+⟧/g, '').trim();
    if (!clean) {
      return { isDialectOrSlang: false, reason: null, detectedCategory: null };
    }

    // 1. Check Multilingual Code-Switching (Universal: across all scripts, Turkish-English, etc.)
    const hasNonLatinScript = /[\u0600-\u06FF\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u0900-\u097F\u0E00-\u0E7F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/u.test(clean);
    const hasLatinWords = /[a-zA-Z]{2,}/.test(clean);
    if (hasNonLatinScript && hasLatinWords) {
      return { isDialectOrSlang: true, reason: 'Multi-script code-switching detected', detectedCategory: 'code_switching' };
    }

    const enMarkers = /\b(?:bro|the|and|is|it|you|understand|know|what|why|how|with|this|that|yeah|yes|no|can|will|good|bad|okay|sure|please|sorry|thank|thanks|lol|wtf|omg|idk|btw|tbh)\b/iu;
    const trMarkers = /\b(?:evet|hayır|tamam|ama|fakat|veya|çünkü|bence|güzel|nasılsın|sen|ben|biz|siz|var|yok|için|şey|bunu|şunu|yapacak|yap|gel|git|bak|olur|olmaz|anladım|anladın|görüşürüz|hayırlı|merhaba|selam|sağol|teşekkür|günaydın|iyi|kötü|bişi|nolsun|hallederiz|gidecen)\b/iu;
    const hasTurkishChar = /[çğıöşüÇĞİÖŞÜ]/i.test(clean);

    if ((trMarkers.test(clean) || hasTurkishChar) && enMarkers.test(clean)) {
      return { isDialectOrSlang: true, reason: 'Turkish-English code-switching detected', detectedCategory: 'code_switching' };
    }

    // 2. Check Egyptian
    for (const pat of EGYPTIAN_PATTERNS) {
      if (pat.test(clean)) {
        return { isDialectOrSlang: true, reason: `Matched Egyptian dialect token: ${pat}`, detectedCategory: 'ar_egyptian' };
      }
    }

    // 3. Check Levantine
    for (const pat of LEVANTINE_PATTERNS) {
      if (pat.test(clean)) {
        return { isDialectOrSlang: true, reason: `Matched Levantine dialect token: ${pat}`, detectedCategory: 'ar_levantine' };
      }
    }

    // 4. Check Gulf
    for (const pat of GULF_PATTERNS) {
      if (pat.test(clean)) {
        return { isDialectOrSlang: true, reason: `Matched Gulf dialect token: ${pat}`, detectedCategory: 'ar_gulf' };
      }
    }

    // 5. Check Arabizi
    if (ARABIZI_PATTERN.test(clean)) {
      return { isDialectOrSlang: true, reason: 'Matched Arabizi numeric substitution pattern', detectedCategory: 'arabizi' };
    }

    // 6. Check Turkish Slang
    for (const pat of TURKISH_SLANG_PATTERNS) {
      if (pat.test(clean)) {
        return { isDialectOrSlang: true, reason: `Matched Turkish street slang token: ${pat}`, detectedCategory: 'tr_slang' };
      }
    }

    // 7. Check General Chat Acronyms
    for (const pat of CHAT_SLANG_PATTERNS) {
      if (pat.test(clean)) {
        return { isDialectOrSlang: true, reason: `Matched chat slang acronym: ${pat}`, detectedCategory: 'chat_acronym' };
      }
    }

    // Check Heavy Elongation (e.g. sooo, çoooook, ههههه, يااااا)
    if (/([a-zA-Z\u0600-\u06FF])\1{3,}/u.test(clean)) {
      return { isDialectOrSlang: true, reason: 'High-intensity emotional elongation detected', detectedCategory: 'elongation' };
    }

    // Check Text Emoticons & Kaomojis (xD, :3, :), -_-, T_T, ¯\_(ツ)_/¯, :v, ;-;, ;_;)
    const EMOTICON_REGEX = /(?<![\p{L}\p{N}])(?:¯\\_\(ツ\)_\/¯|\(•_•\)|xD|XD|:v|;-;|;_;|:\)|:\(|:-\)|:-\(|;\)|;-\)|:D|:-D|:P|:-P|:p|:-p|:3|:o|:O|:-O|>:\(|:\/|:-\/|:\\|:-\\|:'\(|:'\)|8\)|B\)|-_-|T_T|T-T|T\.T|\._\.|o_o|O_O|O\.o|o\.O|>_<|>\.<|\^_\^|\^\.\^|[Uu][Ww][Uu]|[Oo][Ww][Oo])(?![\p{L}\p{N}])/u;
    if (EMOTICON_REGEX.test(text)) {
      return { isDialectOrSlang: true, reason: 'Informal text emoticon / kaomoji detected', detectedCategory: 'emoticon' };
    }

    // Check Unicode Emojis (😂, 💀, 🔥, etc.) - presence of emoji confirms conversational dialogue
    if (/\p{Extended_Pictographic}/u.test(text)) {
      return { isDialectOrSlang: true, reason: 'Conversational emoji detected', detectedCategory: 'emoji' };
    }

    // Check Repetitive Punctuation Runs (....., !?!?!, ????, !!!!)
    if (/([!?.…！？。؟]{2,})/u.test(text)) {
      return { isDialectOrSlang: true, reason: 'Extended conversational punctuation run detected', detectedCategory: 'punctuation_run' };
    }

    // Check All-Caps Screaming (>= 4 uppercase chars and >= 80% uppercase)
    const lettersOnly = clean.replace(/[^\p{L}]/gu, '');
    if (lettersOnly.length >= 4) {
      let upperCount = 0;
      for (const ch of lettersOnly) if (/\p{Lu}/u.test(ch)) upperCount++;
      if (upperCount / lettersOnly.length >= 0.8) {
        return { isDialectOrSlang: true, reason: 'All-caps screaming emotion detected', detectedCategory: 'all_caps' };
      }
    }

    return { isDialectOrSlang: false, reason: 'Standard/formal syntax detected', detectedCategory: 'standard' };
  }

  const exportObj = {
    classifyMessage,
    isDialectOrSlang: text => classifyMessage(text).isDialectOrSlang
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.DialectClassifier = exportObj;
  }
})();
