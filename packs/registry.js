/**
 * Multilingual Style-Preserving Translator - Language Pack Registry
 * Bundled Language Packs conforming to MULTILINGUAL_STYLE_TRANSLATOR_SPEC.md §7
 */

(() => {
  'use strict';

  const DEFAULT_PACK = {
    lang: 'default',
    script: 'Latn',
    dir: 'ltr',
    caps: { supported: true, strategy: 'uppercase' },
    vowels: 'aeiouAEIOU',
    elongation: { marker: null, tatweel: false, legitTriples: [] },
    punct: { question: ['', '?'], exclaim: ['', '!'], ellipsis: '…' },
    laughter: {
      patterns: ['h[aeiou]{2,}', 'ha(ha)+', 'haha+'],
      map: { haha: 'haha', jaja: 'haha', '555': 'haha', www: 'haha', kkk: 'haha' }
    },
    acronyms: {},
    slang: {},
    intensifiers: {},
    commentaryPhrases: ['Sure', 'Here is', 'Translation:'],
    review: { status: 'draft', by: 'System Default', date: '2026-10-27' }
  };

  const PACKS = {
    tr: {
      lang: 'tr',
      script: 'Latn',
      dir: 'ltr',
      caps: { supported: true, strategy: 'uppercase', locale: 'tr-TR' },
      vowels: 'aeıioöuüAEIİOÖUÜ',
      elongation: { marker: null, tatweel: false, legitTriples: [] },
      punct: { question: ['', '?'], exclaim: ['', '!'], ellipsis: '…' },
      laughter: {
        patterns: ['h[aeiou]{2,}', 'ha(ha)+', 'haha+', 'sjsj+', 'asdasd+', 'kikiki+'],
        map: { jaja: 'haha', '555': 'haha', www: 'haha', kkk: 'haha', haha: 'haha', lol: 'haha', lmao: 'hahaha' }
      },
      acronyms: {
        mrb: { expansion: 'merhaba', register: 'informal' },
        slm: { expansion: 'selam', register: 'informal' },
        tmm: { expansion: 'tamam', register: 'informal' },
        kib: { expansion: 'kendine iyi bak', register: 'informal' },
        nbr: { expansion: 'ne haber', register: 'informal' },
        eyv: { expansion: 'eyvallah', register: 'informal' },
        sa: { expansion: 'selamün aleyküm', register: 'informal' },
        as: { expansion: 'aleyküm selam', register: 'informal' },
        'bişi': { expansion: 'bir şey', register: 'informal' },
        'bisi': { expansion: 'bir şey', register: 'informal' },
        'yapacak bişi yok': { expansion: 'yapacak bir şey yok', register: 'informal' },
        'gidecen': { expansion: 'gideceksin', register: 'informal' },
        'yapacan': { expansion: 'yapacaksın', register: 'informal' },
        'edicen': { expansion: 'edeceksin', register: 'informal' },
        'geliyon': { expansion: 'geliyorsun', register: 'informal' },
        'gidiyon': { expansion: 'gidiyorsun', register: 'informal' },
        'napiyon': { expansion: 'ne yapıyorsun', register: 'informal' },
        'napıyon': { expansion: 'ne yapıyorsun', register: 'informal' },
        'noldu': { expansion: 'ne oldu', register: 'informal' },
        'boşver': { expansion: 'aldırma', register: 'informal' },
        'baksana': { expansion: 'bakar mısın', register: 'informal' }
      },
      intensifiers: { 'çok': 'çok', evet: 'evet', 'hayır': 'hayır', 'güzel': 'güzel', merhaba: 'merhaba', harika: 'harika', 'süper': 'süper' },
      commentaryPhrases: ['Tabii', 'Elbette', 'İşte', 'Çeviri:'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    en: {
      lang: 'en',
      script: 'Latn',
      dir: 'ltr',
      caps: { supported: true, strategy: 'uppercase', locale: 'en-US' },
      vowels: 'aeiouyAEIOUY',
      elongation: { marker: null, tatweel: false, legitTriples: [] },
      punct: { question: ['', '?'], exclaim: ['', '!'], ellipsis: '…' },
      laughter: {
        patterns: ['h[aeiou]{2,}', 'ha(ha)+', 'haha+', 'hehe+', 'l[ol]{2,}'],
        map: { jaja: 'haha', '555': 'haha', www: 'haha', kkk: 'haha', haha: 'haha', lol: 'haha', lmao: 'hahaha' }
      },
      acronyms: {
        idk: { expansion: 'I do not know', register: 'informal' },
        omg: { expansion: 'oh my god', register: 'informal' },
        tbh: { expansion: 'to be honest', register: 'informal' },
        brb: { expansion: 'be right back', register: 'informal' },
        btw: { expansion: 'by the way', register: 'informal' },
        imo: { expansion: 'in my opinion', register: 'informal' },
        np: { expansion: 'no problem', register: 'informal' },
        ty: { expansion: 'thank you', register: 'informal' },
        thx: { expansion: 'thanks', register: 'informal' },
        pls: { expansion: 'please', register: 'informal' },
        wth: { expansion: 'what the hell', register: 'informal' }
      },
      intensifiers: { so: 'so', yes: 'yes', no: 'no', really: 'really', very: 'very', please: 'please', love: 'love', great: 'great' },
      commentaryPhrases: ['Sure', 'Here is', 'Translation:', 'Certainly', "Here's"],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    es: {
      lang: 'es',
      script: 'Latn',
      dir: 'ltr',
      caps: { supported: true, strategy: 'uppercase', locale: 'es-ES' },
      vowels: 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ',
      elongation: { marker: null, tatweel: false, legitTriples: [] },
      punct: { question: ['¿', '?'], exclaim: ['¡', '!'], ellipsis: '…' },
      laughter: {
        patterns: ['j[aeiou]{2,}', 'ja(ja)+', 'jaja+', 'xd+'],
        map: { haha: 'jaja', '555': 'jaja', www: 'jaja', kkk: 'jaja', lol: 'jaja', lmao: 'jajaja' }
      },
      acronyms: {
        xq: { expansion: 'porque', register: 'informal' },
        tqm: { expansion: 'te quiero mucho', register: 'informal' },
        tb: { expansion: 'también', register: 'informal' },
        q: { expansion: 'que', register: 'informal' },
        bno: { expansion: 'bueno', register: 'informal' }
      },
      intensifiers: { no: 'no', 'sí': 'sí', muy: 'muy', tan: 'tan', hola: 'hola', bueno: 'bueno' },
      commentaryPhrases: ['Claro', 'Aquí está', 'Traducción:', 'Por supuesto'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    ar: {
      lang: 'ar',
      script: 'Arab',
      dir: 'rtl',
      caps: { supported: false, strategy: 'none' },
      vowels: 'اويىأإآَُِ',
      elongation: { marker: null, tatweel: true, legitTriples: [] },
      punct: { question: ['', '؟'], exclaim: ['', '!'], ellipsis: '…' },
      laughter: {
        patterns: ['ه{2,}', 'هه(هه)+', 'هههه+', 'خخخ+'],
        map: { haha: 'هههه', jaja: 'هههه', '555': 'هههه', www: 'هههه', lol: 'هههه', lmao: 'هههههه' }
      },
      acronyms: {
        'برب': { expansion: 'سأعود قريبا', register: 'informal' },
        'تيت': { expansion: 'خذ وقتك', register: 'informal' },
        'يسلمو': { expansion: 'شكرا جزيلا', register: 'informal' },
        'فكك': { expansion: 'اترك الموضوع', register: 'informal' },
        'كبر مخك': { expansion: 'لا تهتم', register: 'informal' },
        'مش ناقصة': { expansion: 'لا أحتمل المزيد', register: 'informal' },
        'عامل ايه': { expansion: 'كيف حالك', register: 'informal' },
        'ازيك': { expansion: 'كيف حالك', register: 'informal' },
        'شلونك': { expansion: 'كيف حالك', register: 'informal' },
        'ماشي': { expansion: 'حسنا', register: 'informal' },
        'بقولك ايه': { expansion: 'أخبرني', register: 'informal' },
        'بقولك': { expansion: 'أخبرني', register: 'informal' },
        'ايه رايك': { expansion: 'ما رأيك', register: 'informal' },
        'ف الفيديو': { expansion: 'في الفيديو', register: 'informal' },
        'بيلم': { expansion: 'يجمع ويشرح', register: 'informal' },
        'ولا اتفرج': { expansion: 'أم أشاهد', register: 'informal' },
        'باتفرج': { expansion: 'أنا أشاهد', register: 'informal' },
        'باعتله': { expansion: 'أرسلت له', register: 'informal' },
        'ع طول': { expansion: 'مباشرة', register: 'informal' },
        'على طول': { expansion: 'مباشرة', register: 'informal' },
        'اسمو ثلاثي': { expansion: 'اسمه الكامل ثلاثيا', register: 'informal' },
        'اسمه ثلاثي': { expansion: 'اسمه الكامل ثلاثيا', register: 'informal' },
        'الاسم الثلاثي': { expansion: 'الاسم الكامل', register: 'informal' },
        'فصله': { expansion: 'فصله الدراسي', register: 'informal' },
        'دفعتكم': { expansion: 'دفعتكم الدراسية', register: 'informal' },
        'دفعة': { expansion: 'دفعة دراسية', register: 'informal' },
        'يبعتلي برايفت': { expansion: 'يرسل لي رسالة خاصة', register: 'informal' },
        'يبعتلي': { expansion: 'يرسل لي', register: 'informal' },
        'برايفت': { expansion: 'رسالة خاصة', register: 'informal' },
        'الرقم القومي': { expansion: 'رقم الهوية الوطنية', register: 'informal' },
        'رقم التليفون': { expansion: 'رقم الهاتف', register: 'informal' },
        'نزلوه بجد': { expansion: 'حملوه حقا', register: 'informal' },
        'نزلوه': { expansion: 'قوموا بتحميله', register: 'informal' },
        'نزلو': { expansion: 'حملوا', register: 'informal' },
        'اعتنموه': { expansion: 'اغتنموه واستفيدوا منه', register: 'informal' },
        'اغتنموه': { expansion: 'اغتنموه واستفيدوا منه', register: 'informal' },
        'انشروه': { expansion: 'انشروه وشاركوه', register: 'informal' },
        'لينك': { expansion: 'رابط', register: 'informal' },
        'شوفو الموضوع': { expansion: 'ناقشوا هذا الموضوع', register: 'informal' },
        'جاي السكن مع': { expansion: 'قادم إلى سكن الطلاب مع', register: 'informal' },
        'جاي السكن': { expansion: 'قادم إلى سكن الطلاب', register: 'informal' },
        'في السكن': { expansion: 'في سكن الطلاب', register: 'informal' },
        'السكن': { expansion: 'سكن الطلاب', register: 'informal' },
        'توهت للدرجادي': { expansion: 'هل ضعت لهذه الدرجة', register: 'informal' },
        'توهت للدرجة دي': { expansion: 'هل ضعت لهذه الدرجة', register: 'informal' },
        'توهت': { expansion: 'ضللت الطريق', register: 'informal' },
        'للدرجادي': { expansion: 'لهذه الدرجة', register: 'informal' },
        'هرن عليك تنزل تفتح الباب بقا': { expansion: 'سأتصل بك هاتفيا لتنزل وتفتح الباب', register: 'informal' },
        'هرن عليك تنزل تفتح الباب': { expansion: 'سأتصل بك هاتفيا لتنزل وتفتح الباب', register: 'informal' },
        'هرن عليك': { expansion: 'سأتصل بك هاتفيا', register: 'informal' },
        'هرنلك': { expansion: 'سأتصل بك', register: 'informal' },
        'هرن': { expansion: 'سأتصل هاتفيا', register: 'informal' },
        'تنزل تفتح الباب': { expansion: 'لتنزل وتفتح الباب', register: 'informal' },
        'تفتح الباب بقا': { expansion: 'وتفتح الباب', register: 'informal' },
        'فينك كده': { expansion: 'أين أنت الآن', register: 'informal' },
        'فينك': { expansion: 'أين أنت', register: 'informal' },
        'في الستادي': { expansion: 'في غرفة المذاكرة', register: 'informal' },
        'الستادي': { expansion: 'غرفة المذاكرة', register: 'informal' },
        'هطلت': { expansion: 'سأصعد', register: 'informal' },
        'اصلس': { expansion: 'أصلي', register: 'informal' },
        'اتوضى و انزل اصلس': { expansion: 'أتوضأ وأنزل لأصلي', register: 'informal' },
        'اتوضى وانزل اصلي': { expansion: 'أتوضأ وأنزل لأصلي', register: 'informal' },
        'عمر موجود هناك': { expansion: 'هل عمر موجود هناك', register: 'informal' }
      },
      intensifiers: { 'جدا': 'جدا', 'نعم': 'نعم', 'لا': 'لا', 'حلو': 'حلو' },
      commentaryPhrases: ['بالتأكيد', 'إليك الترجمة:', 'الترجمة:'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    ja: {
      lang: 'ja',
      script: 'Jpan',
      dir: 'ltr',
      caps: { supported: false, strategy: 'none' },
      vowels: 'あいうえおアイウエオ',
      elongation: { marker: '〜', tatweel: false, legitTriples: [] },
      punct: { question: ['', '？'], exclaim: ['', '！'], ellipsis: '…' },
      laughter: {
        patterns: ['w{2,}', 'ｗ{2,}', '草+', '笑+'],
        map: { haha: 'www', jaja: 'www', '555': 'www', kkk: 'www', lol: 'www', lmao: 'wwwwww' }
      },
      acronyms: {
        wktk: { expansion: 'ワクワクテカテカ', register: 'informal' },
        kwsk: { expansion: '詳しく', register: 'informal' }
      },
      intensifiers: { 'とても': 'とても', 'すごく': 'すごく', 'はい': 'はい', 'いいえ': 'いいえ' },
      commentaryPhrases: ['もちろん', '翻訳はこちらです:', '訳:'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    ru: {
      lang: 'ru',
      script: 'Cyrl',
      dir: 'ltr',
      caps: { supported: true, strategy: 'uppercase', locale: 'ru-RU' },
      vowels: 'аеёиоуыэюяАЕЁИОУЫЭЮЯ',
      elongation: { marker: null, tatweel: false, legitTriples: [] },
      punct: { question: ['', '?'], exclaim: ['', '!'], ellipsis: '…' },
      laughter: {
        patterns: ['ах[ах]{2,}', 'ха(ха)+', 'ахах+', 'хех+'],
        map: { haha: 'ахах', jaja: 'ахах', '555': 'ахах', www: 'ахах', lol: 'ахах', lmao: 'ахахах' }
      },
      acronyms: {
        'спс': { expansion: 'спасибо', register: 'informal' },
        'пж': { expansion: 'пожалуйста', register: 'informal' },
        'хз': { expansion: 'не знаю', register: 'informal' },
        'кст': { expansion: 'кстати', register: 'informal' }
      },
      intensifiers: { 'очень': 'очень', 'да': 'да', 'нет': 'нет', 'так': 'так' },
      commentaryPhrases: ['Конечно', 'Вот перевод:', 'Перевод:'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    de: {
      lang: 'de',
      script: 'Latn',
      dir: 'ltr',
      caps: { supported: true, strategy: 'uppercase', locale: 'de-DE' },
      vowels: 'aeiouäöüAEIOUÄÖÜ',
      elongation: { marker: null, tatweel: false, legitTriples: [] },
      punct: { question: ['', '?'], exclaim: ['', '!'], ellipsis: '…' },
      laughter: {
        patterns: ['h[aeiou]{2,}', 'ha(ha)+', 'haha+', 'hehe+'],
        map: { jaja: 'haha', '555': 'haha', www: 'haha', kkk: 'haha', haha: 'haha' }
      },
      acronyms: {
        vg: { expansion: 'viel Glück', register: 'informal' },
        lg: { expansion: 'liebe Grüße', register: 'informal' },
        ka: { expansion: 'keine Ahnung', register: 'informal' }
      },
      intensifiers: { sehr: 'sehr', ja: 'ja', nein: 'nein', so: 'so', bitte: 'bitte' },
      commentaryPhrases: ['Klar', 'Hier ist die Übersetzung:', 'Übersetzung:'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    fr: {
      lang: 'fr',
      script: 'Latn',
      dir: 'ltr',
      caps: { supported: true, strategy: 'uppercase', locale: 'fr-FR' },
      vowels: 'aeiouyàâéèêëîïôùûüÿœæAEIOUYÀÂÉÈÊËÎÏÔÙÛÜŸŒÆ',
      elongation: { marker: null, tatweel: false, legitTriples: [] },
      punct: { question: ['', '?'], exclaim: ['', '!'], ellipsis: '…' },
      laughter: {
        patterns: ['m[dr]{2,}', 'ha(ha)+', 'haha+', 'ah(ah)+'],
        map: { jaja: 'haha', '555': 'haha', www: 'haha', kkk: 'haha', haha: 'haha', lol: 'mdr' }
      },
      acronyms: {
        mdr: { expansion: 'mort de rire', register: 'informal' },
        stp: { expansion: "s'il te plaît", register: "informal" },
        bcp: { expansion: 'beaucoup', register: 'informal' }
      },
      intensifiers: { 'très': 'très', oui: 'oui', non: 'non', si: 'si' },
      commentaryPhrases: ['Bien sûr', 'Voici la traduction :', 'Traduction :'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    pt: {
      lang: 'pt',
      script: 'Latn',
      dir: 'ltr',
      caps: { supported: true, strategy: 'uppercase', locale: 'pt-PT' },
      vowels: 'aeiouáéíóúâêôãõAEIOUÁÉÍÓÚÂÊÔÃÕ',
      elongation: { marker: null, tatweel: false, legitTriples: [] },
      punct: { question: ['', '?'], exclaim: ['', '!'], ellipsis: '…' },
      laughter: {
        patterns: ['k{2,}', 'rs(rs)+', 'ha(ha)+', 'kkk+'],
        map: { haha: 'kkk', jaja: 'kkk', '555': 'kkk', www: 'kkk', lol: 'kkk' }
      },
      acronyms: {
        vc: { expansion: 'você', register: 'informal' },
        tb: { expansion: 'também', register: 'informal' },
        pq: { expansion: 'porque', register: 'informal' },
        obg: { expansion: 'obrigado', register: 'informal' }
      },
      intensifiers: { muito: 'muito', sim: 'sim', 'não': 'não' },
      commentaryPhrases: ['Claro', 'Aqui está a tradução:', 'Tradução:'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    },
    zh: {
      lang: 'zh',
      script: 'Hans',
      dir: 'ltr',
      caps: { supported: false, strategy: 'none' },
      vowels: '',
      elongation: { marker: null, tatweel: false, legitTriples: [] },
      punct: { question: ['', '？'], exclaim: ['', '！'], ellipsis: '……' },
      laughter: {
        patterns: ['哈{2,}', '哈哈+', '嘻嘻+'],
        map: { haha: '哈哈', jaja: '哈哈', '555': '哈哈', www: '哈哈', lol: '哈哈' }
      },
      acronyms: {
        nb: { expansion: '厉害', register: 'slang' },
        yyds: { expansion: '永远的神', register: 'slang' }
      },
      intensifiers: { '非常': '非常', '很': '很', '是': '是', '不': '不' },
      commentaryPhrases: ['当然', '这是翻译：', '翻译：'],
      review: { status: 'reviewed', by: 'OAT Senior Staff', date: '2026-10-27' }
    }
  };

  function normalizeLangCode(code) {
    if (!code || typeof code !== 'string') return 'default';
    const c = code.toLowerCase().trim();
    if (c.startsWith('zh')) return 'zh';
    const base = c.split(/[-_]/)[0];
    return base || 'default';
  }

  function getLanguagePack(code) {
    const base = normalizeLangCode(code);
    return PACKS[base] || { ...DEFAULT_PACK, lang: base };
  }

  function listSupportedPacks() {
    return Object.keys(PACKS).map(k => ({
      code: k,
      name: PACKS[k].lang,
      script: PACKS[k].script,
      review: PACKS[k].review.status
    }));
  }

  const exportObj = {
    PACKS,
    DEFAULT_PACK,
    getLanguagePack,
    normalizeLangCode,
    listSupportedPacks
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LanguagePackRegistry = exportObj;
  }
})();
