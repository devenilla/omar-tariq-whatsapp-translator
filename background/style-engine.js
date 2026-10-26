/**
 * Multilingual Style-Preserving Hybrid Translator - Core Style Engine
 * Conforms strictly to MULTILINGUAL_STYLE_TRANSLATOR_SPEC.md §1.2 & §6
 */

(() => {
  'use strict';

  // Ensure registry is loaded
  const Registry = (typeof globalThis !== 'undefined' && globalThis.LanguagePackRegistry) ||
    (typeof require !== 'undefined' ? require('../packs/registry.js') : null);

  const getPack = Registry ? Registry.getLanguagePack : () => ({
    lang: 'default',
    script: 'Latn',
    caps: { supported: true, strategy: 'uppercase' },
    vowels: 'aeiouAEIOU',
    elongation: { marker: null, tatweel: false },
    punct: { question: ['', '?'], exclaim: ['', '!'], ellipsis: '…' },
    laughter: { patterns: ['ha(ha)+'], map: { haha: 'haha' } },
    acronyms: {},
    intensifiers: {},
    commentaryPhrases: ['Sure', 'Here is', 'Translation:']
  });

  // ── [0] SHARED PATTERNS ───────────────────────────────────────────────────
  const EMOTICON_REGEX = /(?<![\p{L}\p{N}])(?:¯\\_\(ツ\)_\/¯|\(•_•\)|xD|XD|:v|;-;|;_;|:\)|:\(|:-\)|:-\(|;\)|;-\)|:D|:-D|:P|:-P|:p|:-p|:3|:o|:O|:-O|>:\(|:\/|:-\/|:\\|:-\\|:'\(|:'\)|8\)|B\)|-_-|T_T|T-T|T\.T|\._\.|o_o|O_O|O\.o|o\.O|>_<|>\.<|\^_\^|\^\.\^|[Uu][Ww][Uu]|[Oo][Ww][Oo])(?![\p{L}\p{N}])/gu;
  const UNICODE_EMOJI_REGEX = /\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic})*/gu;

  // ── [0] EXTRACT & PROTECT SPANS ───────────────────────────────────────────
  // URLs, @mentions, WhatsApp markdown (*bold*, _italic_, ~strike~, `code`), numbers
  function protectSpans(text) {
    if (!text || typeof text !== 'string') return { protectedText: '', spans: [] };

    const spans = [];
    let counter = 0;

    function saveSpan(match) {
      const token = `⟦${counter++}⟧`;
      spans.push({ token, original: match });
      return token;
    }

    let result = text;

    // 1. URLs (preserve query params, full http(s) URLs and naked domains like chess.com, google.com)
    result = result.replace(/(?:https?:\/\/[^\s<>"'{}|\\^`]+(?<![.,;:!?]))|(?:(?<=^|[\s\n\r(\[])(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(?:com|org|net|edu|gov|io|me|ai|co|app|dev|xyz|info|tv|site|online|tech|link|cc|to|us|uk|de|tr|eg|fr|ru|nl|br|in|ly|be|live|store|club|space)(?:\/[^\s<>"'{}|\\^`]*[^\s<>"'{}|\\^`.,;:!?])?)/gi, saveSpan);

    // 2. Mentions (@~Honda, @~Yahia Mostafa, @Yazin Hisham (STEM S29), @Danial Kamal Khairy, @User)
    const MENTION_PROTECT_REGEX = /(?:^|(?<=[\s\n\r]))@(?:~[^\r\n,;!?:]+(?:\s*\([^)\r\n]+\))?|\+?\d[\d\s\-]{6,}\d|[a-zA-Z0-9_\u00C0-\u024F]+(?:\s+[a-zA-Z0-9_\u00C0-\u024F]+){0,3}(?:\s*\([^)\r\n]+\))?|[\u0600-\u06FF\u0750-\u077F]+(?:\s+[\u0600-\u06FF\u0750-\u077F]+){0,3}(?:\s*\([^)\r\n]+\))?)(?=$|[\s\n\r,;:!?])/gu;
    result = result.replace(MENTION_PROTECT_REGEX, saveSpan);

    // 3. Phone numbers (+20 100 123 4567, etc.)
    const PHONE_PROTECT_REGEX = /(?:^|(?<=[\s\n\r]))\+?\d[\d\s\-()]{6,}\d(?=[\s\r\n,;!?]|$)/g;
    result = result.replace(PHONE_PROTECT_REGEX, saveSpan);

    // 3. Text Emojis / Emoticons & Kaomoji (preserve xD, :3, :), -_-, T_T, ¯\_(ツ)_/¯, :v, ;-;, ;_;)
    result = result.replace(EMOTICON_REGEX, saveSpan);

    // 4. Unicode Emojis & Sequences (preserve 😂, 💀, 🔥, ❤️, etc. across all MT and AI providers)
    result = result.replace(UNICODE_EMOJI_REGEX, saveSpan);

    // 5. WhatsApp formatting markers (code blocks, inline code, bold, italic, strike)
    result = result.replace(/```[\s\S]*?```/g, saveSpan);
    result = result.replace(/`[^`\n]+`/g, saveSpan);
    result = result.replace(/(?<=^|[\s\p{P}])\*[^\s*][^*]*[^\s*]\*(?=[\s\p{P}]|$)/gu, saveSpan);
    result = result.replace(/(?<=^|[\s\p{P}])_[^\s_][^_]*[^\s_]_(?=[\s\p{P}]|$)/gu, saveSpan);
    result = result.replace(/(?<=^|[\s\p{P}])~[^\s~][^~]*[^\s~]~(?=[\s\p{P}]|$)/gu, saveSpan);

    // 6. Numbers with separators (SPEC §6.1) - never match digits inside tokens ⟦0⟧
    result = result.replace(/(?<!⟦)\b\d+(?:[.,]\d+)*\b(?!⟧)/gu, saveSpan);

    return { protectedText: result, spans };
  }

  // ── [9] RESTORE PROTECTED SPANS ───────────────────────────────────────────
  function restoreSpans(text, spans) {
    if (!text || !Array.isArray(spans)) return text || '';
    let result = text;
    for (const span of spans) {
      result = result.replaceAll(span.token, span.original);
    }
    return result;
  }

  // ── [1] DETECT SOURCE LANGUAGE ────────────────────────────────────────────
  // Script heuristics + Unicode block ratios per SPEC §6.2
  function detectSourceLanguageHeuristic(text) {
    if (!text) return 'auto';

    // Strip protected tokens before analyzing
    const clean = text.replace(/⟦\d+⟧/g, '').trim();
    if (!clean) return 'auto';

    // Script ranges
    const arabic = /[\u0600-\u06FF\u0750-\u077F]/g;
    const cyrillic = /[\u0400-\u04FF]/g;
    const hiraganaKatakana = /[\u3040-\u309F\u30A0-\u30FF]/g;
    const hangul = /[\uAC00-\uD7AF\u1100-\u11FF]/g;
    const cjkHan = /[\u4E00-\u9FFF]/g;
    const greek = /[\u0370-\u03FF]/g;
    const hebrew = /[\u0590-\u05FF]/g;
    const thai = /[\u0E00-\u0E7F]/g;
    const devanagari = /[\u0900-\u097F]/g;
    const turkishSpecial = /[çğıöşüÇĞİÖŞÜ]/g;

    const len = clean.length;
    if ((clean.match(arabic) || []).length / len > 0.25) return 'ar';
    if ((clean.match(cyrillic) || []).length / len > 0.25) return 'ru';
    if ((clean.match(hiraganaKatakana) || []).length > 0) return 'ja';
    if ((clean.match(hangul) || []).length / len > 0.25) return 'ko';
    if ((clean.match(cjkHan) || []).length / len > 0.3) return 'zh';
    if ((clean.match(thai) || []).length / len > 0.25) return 'th';
    if ((clean.match(devanagari) || []).length / len > 0.25) return 'hi';
    if ((clean.match(hebrew) || []).length / len > 0.25) return 'he';
    if ((clean.match(greek) || []).length / len > 0.25) return 'el';
    if ((clean.match(turkishSpecial) || []).length >= 2) return 'tr';

    return 'auto';
  }

  // ── [3] EXTRACT STYLE PROFILE ─────────────────────────────────────────────
  // Unicode-aware caps, elongation runs, laughter tokens, trailing punctuation, emoji
  function extractStyleProfile(text, srcPack) {
    const profile = {
      allCaps: false,
      isAllLower: false,
      capsWords: [],
      elongations: [],
      tatweel: false,
      trailingPunct: '',
      noTrailingPunct: false,
      extendedPunct: '',
      runsInside: [],
      emoji: [],
      emoticons: [],
      laughter: []
    };

    if (!text) return profile;

    // 1. Emoji extraction
    const emojiMatch = text.match(UNICODE_EMOJI_REGEX);
    if (emojiMatch) {
      profile.emoji = Array.from(emojiMatch);
    }

    // 1b. Text Emoticons / Kaomoji extraction (xD, :3, ;-;, ;_;, etc.)
    const emoticonMatch = text.match(EMOTICON_REGEX);
    if (emoticonMatch) {
      profile.emoticons = Array.from(emoticonMatch);
    }

    // Strip emojis, emoticons & protected tokens for text pattern extraction
    const cleanText = text
      .replace(/⟦\d+⟧/g, '')
      .replace(UNICODE_EMOJI_REGEX, '')
      .replace(EMOTICON_REGEX, '')
      .trim();

    // 2. All-caps and All-lowercase detection
    const textWithoutAcronyms = cleanText
      .replace(/\b(?:OK|LOL|OMG|IDK|TBH|BRB|BTW|IMO|NP|TY|THX|PLS)\b/gi, '')
      .trim();
    let upperCount = 0;
    let lowerCount = 0;
    for (const ch of textWithoutAcronyms) {
      if (/\p{Lu}/u.test(ch)) upperCount++;
      else if (/\p{Ll}/u.test(ch)) lowerCount++;
    }
    const casedCount = upperCount + lowerCount;
    if (casedCount >= 4 && (upperCount / casedCount) >= 0.8) {
      profile.allCaps = true;
    } else if (upperCount === 0 && lowerCount >= 2) {
      profile.isAllLower = true;
    }

    // 3. Elongation detection (SPEC §6.3: letter repeated >= 3 times)
    const elongRegex = /(\p{L})\1{2,}/gu;
    let m;
    while ((m = elongRegex.exec(cleanText)) !== null) {
      profile.elongations.push({
        text: m[0],
        char: m[1],
        run: m[0].length
      });
    }

    // 4. Tatweel elongation (Arabic)
    if (/\u0640{2,}/u.test(cleanText)) {
      profile.tatweel = true;
    }

    // 5. Laughter detection
    if (srcPack?.laughter?.patterns) {
      for (const pat of srcPack.laughter.patterns) {
        try {
          const rx = new RegExp(pat, 'gi');
          const laughs = cleanText.match(rx);
          if (laughs) {
            for (const l of laughs) {
              profile.laughter.push({ text: l, run: l.length });
            }
          }
        } catch (e) {}
      }
    }

    // 6. Trailing punctuation & Zero punctuation detection
    const trailMatch = text.match(/[!?.…！？。؟]+\s*$/u);
    if (trailMatch) {
      profile.trailingPunct = trailMatch[0].trim();
    } else {
      profile.noTrailingPunct = true;
    }

    // 7. Repetitive / Extended punctuation runs (e.g. ....., ????, !!!!, !?!?)
    const extendedMatch = text.match(/([!?.…！？。؟]{2,})\s*$/u);
    if (extendedMatch) {
      profile.extendedPunct = extendedMatch[1].trim();
    }

    return profile;
  }

  // ── [4] EXPAND SLANG & ACRONYMS ───────────────────────────────────────────
  function expandSlang(text, srcPack) {
    if (!text || !srcPack?.acronyms) return text;
    let out = text;
    // Dynamic colloquial duration patterns for Arabic (e.g. "كمان 7 د" -> "خلال 7 دقائق")
    if (srcPack?.lang === 'ar') {
      out = out.replace(/(?<![\p{L}\p{N}])كمان\s+(\d+)\s*د(?![\\p{L}\\p{N}])/giu, 'خلال $1 دقائق');
      out = out.replace(/(?<![\p{L}\p{N}])كمان\s*د(?![\\p{L}\\p{N}])/giu, 'خلال دقيقة');
    }

    // Sort entries by descending key length so longer compound phrases match before single-word substrings
    const sortedEntries = Object.entries(srcPack.acronyms).sort((a, b) => b[0].length - a[0].length);
    for (const [abbr, entry] of sortedEntries) {
      if (!entry?.expansion || entry.ambiguous) continue;
      // Unicode boundary replacement with Arabic proclitic (و / ف) prefix support
      if (srcPack?.lang === 'ar') {
        const arRx = new RegExp(`(?<![\\p{L}\\p{N}])([وف]?)${abbr}(?![\\p{L}\\p{N}])`, 'giu');
        out = out.replace(arRx, (match, prefix) => (prefix || '') + entry.expansion);
      } else {
        const rx = new RegExp(`(?<![\\p{L}\\p{N}])${abbr}(?![\\p{L}\\p{N}])`, 'giu');
        out = out.replace(rx, entry.expansion);
      }
    }
    return out;
  }

  // ── [6] STYLE RESTORATION (RULES ENGINE) ──────────────────────────────────
  function stretchWord(word, run, targetPack) {
    const n = Math.min(Math.max(run || 3, 3), 6);
    if (targetPack.script === 'Arab') {
      return word.replace(/(\p{L})(?=\p{L})/u, m => m + '\u0640'.repeat(n - 1));
    }
    if (targetPack.elongation?.marker) {
      return word + targetPack.elongation.marker.repeat(Math.min(n, 3));
    }
    if (targetPack.vowels) {
      const re = new RegExp(`([${targetPack.vowels}])(?!.*[${targetPack.vowels}])`, 'iu');
      if (re.test(word)) {
        return word.replace(re, v => v.repeat(n));
      }
    }
    return word;
  }

  const ENGLISH_CONVERSATIONAL_CONTRACTIONS = [
    // Archaic vocative fix (e.g. "Oh Omar," or "O Omar," -> "Omar," or "Hey Omar,")
    [/\b(?:O|Oh)\s+([A-Z][a-z]+)\b/g, "$1"],
    // Discourse marker fix from literal MT (e.g. "what should I say to you?" -> "tell me,")
    [/\bwhat should I say to you\??\s*/gi, "tell me, "],
    // Catastrophic MT false friends (Arabic بعت -> abuse)
    [/\b(?:you )?used to abuse\b/gi, "sent it to"],
    [/\bto abuse\b/gi, "to send"],
    // Catastrophic MT idiom (ع طول -> all the time when taking/doing)
    [/\bto take it from him all the time\b/gi, "to take it from him directly"],
    [/\bfrom him all the time\b/gi, "from him directly"],
    // Standard contractions
    [/\bIt will\b/g, "It'll"],
    [/\bit will\b/g, "it'll"],
    [/\bI will\b/g, "I'll"],
    [/\bi will\b/g, "i'll"],
    [/\bYou will\b/g, "You'll"],
    [/\byou will\b/g, "you'll"],
    [/\bThey will\b/g, "They'll"],
    [/\bthey will\b/g, "they'll"],
    [/\bWe will\b/g, "We'll"],
    [/\bwe will\b/g, "we'll"],
    [/\bHe will\b/g, "He'll"],
    [/\bhe will\b/g, "he'll"],
    [/\bShe will\b/g, "She'll"],
    [/\bshe will\b/g, "she'll"],
    [/\bthere is nothing we can do about it\b/gi, "nothing we can do about it"],
    [/\bthere is nothing\b/gi, "there's nothing"],
    [/\bthere is\b/gi, "there's"],
    [/\bThere is\b/gi, "There's"],
    [/\bthat is\b/gi, "that's"],
    [/\bThat is\b/gi, "That's"],
    [/\bwhat is\b/gi, "what's"],
    [/\bWhat is\b/gi, "What's"],
    [/\bdo not\b/gi, "don't"],
    [/\bDo not\b/gi, "Don't"],
    [/\bcannot\b/gi, "can't"],
    [/\bCannot\b/gi, "Can't"],
    [/\bcan not\b/gi, "can't"],
    [/\bCan not\b/gi, "Can't"],
    [/\bare not\b/gi, "aren't"],
    [/\bAre not\b/gi, "Aren't"],
    [/\bis not\b/gi, "isn't"],
    [/\bIs not\b/gi, "Isn't"],
    [/\bdid not\b/gi, "didn't"],
    [/\bDid not\b/gi, "Didn't"],
    [/\bdoes not\b/gi, "doesn't"],
    [/\bDoes not\b/gi, "Doesn't"],
    [/\bwould not\b/gi, "wouldn't"],
    [/\bWould not\b/gi, "Wouldn't"],
    [/\bcould not\b/gi, "couldn't"],
    [/\bCould not\b/gi, "Couldn't"],
    [/\bshould not\b/gi, "shouldn't"],
    [/\bShould not\b/gi, "Shouldn't"],
    [/\bhave not\b/gi, "haven't"],
    [/\bHave not\b/gi, "Haven't"],
    [/\bhas not\b/gi, "hasn't"],
    [/\bHas not\b/gi, "Hasn't"]
  ];

  function smoothEnglishContractions(text) {
    if (!text) return '';
    let out = text;
    for (const [rx, rep] of ENGLISH_CONVERSATIONAL_CONTRACTIONS) {
      out = out.replace(rx, rep);
    }
    return out;
  }

  function synchronizeAIStyle(aiRaw, profile = {}, targetPack = {}, targetLang = '') {
    if (!aiRaw) return '';
    let result = aiRaw.trim();

    // 0. Conversational Contraction Smoothing (if target is English)
    if (targetLang === 'en' || targetPack?.lang === 'en') {
      result = smoothEnglishContractions(result);
    }

    // 1. All-Caps or All-Lowercase
    if (profile?.allCaps) {
      result = result.toUpperCase();
    } else if (profile?.isAllLower) {
      result = result.toLowerCase();
    }

    // 2. Trailing punctuation synchronization
    if (profile?.noTrailingPunct) {
      // Strip any trailing period added by the AI
      result = result.replace(/[.]+\s*$/, '').trim();
    } else if (profile?.extendedPunct) {
      // Match exact repeated punctuation run (e.g. ......, ????, !!!!, !?!?!)
      result = result.replace(/[!?.…！？。؟]+\s*$/u, '').trim();
      let punctRun = profile.extendedPunct;
      if (targetPack?.lang === 'ar') punctRun = punctRun.replace(/\?/g, '؟');
      else if (targetPack?.lang === 'ja' || targetPack?.lang === 'zh') punctRun = punctRun.replace(/\?/g, '？').replace(/!/g, '！');
      result += punctRun;
    }

    // 3. Ensure source emojis were not dropped by the AI (multiset preservation)
    if (profile?.emoji && profile.emoji.length > 0) {
      const currentEmojis = result.match(UNICODE_EMOJI_REGEX) || [];
      const currentMultiset = new Map();
      for (const e of currentEmojis) {
        currentMultiset.set(e, (currentMultiset.get(e) || 0) + 1);
      }
      const missingEmojis = [];
      for (const e of profile.emoji) {
        const count = currentMultiset.get(e) || 0;
        if (count > 0) {
          currentMultiset.set(e, count - 1);
        } else {
          missingEmojis.push(e);
        }
      }
      if (missingEmojis.length > 0) {
        result = result.trimEnd() + ' ' + missingEmojis.join(' ');
      }
    }

    // 4. Ensure source text emoticons (xD, :3, ;-;, ;_;, etc.) were not dropped by the AI
    if (profile?.emoticons && profile.emoticons.length > 0) {
      const missingEmoticons = [];
      for (const emo of profile.emoticons) {
        if (!result.includes(emo)) {
          missingEmoticons.push(emo);
        }
      }
      if (missingEmoticons.length > 0) {
        result = result.trimEnd() + ' ' + missingEmoticons.join(' ');
      }
    }

    return result.trim();
  }

  function restoreStyleRules(baseTranslation, profile = {}, targetPack = {}, srcPack = {}, targetLang = '', spans = []) {
    if (!baseTranslation) return baseTranslation;
    let styled = baseTranslation;

    // 0. Conversational Contraction Smoothing (for English translations from MT)
    if (targetLang === 'en' || targetPack?.lang === 'en') {
      styled = smoothEnglishContractions(styled);
    }

    // 1. All-Caps or All-Lowercase Restoration (SPEC §6.6 Rule 1)
    if (profile?.allCaps && targetPack?.caps?.supported) {
      const locale = targetPack.caps.locale || targetLang;
      try {
        styled = styled.toLocaleUpperCase(locale);
      } catch (e) {
        styled = styled.toUpperCase();
      }
    } else if (profile?.isAllLower) {
      const locale = targetPack?.caps?.locale || targetPack?.lang || 'en';
      try {
        styled = styled.toLocaleLowerCase(locale);
      } catch (e) {
        styled = styled.toLowerCase();
      }
    }

    // 2. Cultural Laughter Translation (SPEC §6.6 Rule 3)
    if (profile?.laughter?.length > 0 && targetPack?.laughter?.map) {
      const defaultLaughter = targetPack.laughter.map['haha'] || 'haha';
      for (const l of profile.laughter) {
        const intensity = Math.min(Math.max(Math.floor(l.run / 2), 2), 6);
        let replacement = '';
        if (targetPack.lang === 'ja') {
          replacement = 'w'.repeat(intensity);
        } else if (targetPack.lang === 'es') {
          replacement = 'ja'.repeat(intensity);
        } else if (targetPack.lang === 'ar') {
          replacement = 'ه'.repeat(intensity * 2);
        } else if (targetPack.lang === 'pt') {
          replacement = 'k'.repeat(intensity * 2);
        } else if (targetPack.lang === 'zh') {
          replacement = '哈'.repeat(intensity);
        } else {
          replacement = 'ha'.repeat(intensity);
        }
        // If the base translation doesn't have natural laughter yet, ensure laughter is present
        if (!styled.toLowerCase().includes(replacement.slice(0, 3))) {
          // If translation has plain "haha", replace it; otherwise append if lost
          if (/\b(?:haha|jaja|www|555|kkk)\b/i.test(styled)) {
            styled = styled.replace(/\b(?:haha|jaja|www|555|kkk)\b/gi, replacement);
          }
        }
      }
    }

    // 3. Elongation Restoration (SPEC §6.6 Rule 4 & §6.7)
    if (profile?.elongations?.length > 0 && targetPack?.intensifiers) {
      for (const el of profile.elongations) {
        const words = styled.split(/(\s+)/);
        for (let i = 0; i < words.length; i++) {
          const cleanWord = words[i].replace(/[.,!?;:()]/g, '').toLowerCase();
          if (targetPack.intensifiers[cleanWord]) {
            words[i] = stretchWord(words[i], el.run, targetPack);
            break;
          }
        }
        styled = words.join('');
      }
    }

    // 4. Trailing Punctuation Convention Adaptation (SPEC §6.6 Rule 5)
    if (profile?.noTrailingPunct) {
      // Strip any unwanted trailing period added by MT
      styled = styled.replace(/[.]+\s*$/, '').trim();
    } else if (profile?.extendedPunct) {
      // User had repetitive punctuation (e.g. ....., ????, !!!!, !?!?)
      styled = styled.replace(/[!?.…！？。؟]+\s*$/u, '').trim();
      let punctRun = profile.extendedPunct;
      if (targetPack?.lang === 'ar') punctRun = punctRun.replace(/\?/g, '؟');
      else if (targetPack?.lang === 'ja' || targetPack?.lang === 'zh') punctRun = punctRun.replace(/\?/g, '？').replace(/!/g, '！');
      styled += punctRun;
    } else if (profile?.trailingPunct) {
      // Remove whatever trailing punctuation the MT produced
      styled = styled.replace(/[!?.…！？。؟]+\s*$/u, '').trim();

      if (targetPack?.lang === 'es') {
        // Spanish inverted punctuation
        if (profile.trailingPunct.includes('?')) {
          if (!styled.startsWith('¿')) styled = '¿' + styled;
          styled += '?';
        } else if (profile.trailingPunct.includes('!')) {
          if (!styled.startsWith('¡')) styled = '¡' + styled;
          styled += profile.trailingPunct;
        } else {
          styled += profile.trailingPunct;
        }
      } else if (targetPack?.lang === 'ar') {
        // Arabic inverted question mark
        styled += profile.trailingPunct.replace(/\?/g, '؟');
      } else if (targetPack?.lang === 'ja' || targetPack?.lang === 'zh') {
        // CJK full-width punctuation
        styled += profile.trailingPunct.replace(/\?/g, '？').replace(/!/g, '！');
      } else {
        styled += profile.trailingPunct;
      }
    }

    // 5. Emoji Preservation (SPEC §6.6 Rule 7)
    if (profile?.emoji?.length > 0) {
      const currentEmojis = styled.match(/\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic})*/gu) || [];
      const missingEmojis = [];
      const currentMultiset = new Map();
      for (const e of currentEmojis) {
        currentMultiset.set(e, (currentMultiset.get(e) || 0) + 1);
      }
      for (const e of profile.emoji) {
        // If this emoji is already represented as a protected token in styled, it is not missing!
        if (Array.isArray(spans) && spans.some(s => s.original === e && styled.includes(s.token))) {
          continue;
        }
        const count = currentMultiset.get(e) || 0;
        if (count > 0) {
          currentMultiset.set(e, count - 1);
        } else {
          missingEmojis.push(e);
        }
      }
      // Reinsert any missing emojis cleanly at the end
      if (missingEmojis.length > 0) {
        styled = styled.trim() + ' ' + missingEmojis.join(' ');
      }
    }

    return styled;
  }

  // ── [8] SAFETY CHECKS ─────────────────────────────────────────────────────
  // SPEC §6.9: Reject candidate and fall back to base MT if any safety check fails
  function passesSafetyChecks(candidate, baseTranslation, profile, targetPack, sourceText) {
    if (!candidate || !candidate.trim()) return false;

    // 1. Length ratio check (0.4 to 2.5)
    const baseLen = (baseTranslation || '').length;
    const candLen = candidate.length;
    if (baseLen > 10) {
      const ratio = candLen / baseLen;
      const minRatio = (targetPack?.lang === 'zh' || targetPack?.lang === 'ja') ? 0.25 : 0.4;
      const maxRatio = (targetPack?.lang === 'zh' || targetPack?.lang === 'ja') ? 3.0 : 2.5;
      if (ratio < minRatio || ratio > maxRatio) {
        console.warn(`[OAT StyleEngine] Rejected: Length ratio (${ratio.toFixed(2)}) out of safe bounds.`);
        return false;
      }
    }

    // 2. Protected spans survival check
    const expectedTokens = (baseTranslation.match(/⟦\d+⟧/g) || []);
    for (const tok of expectedTokens) {
      if (!candidate.includes(tok)) {
        console.warn(`[OAT StyleEngine] Rejected: Protected span token ${tok} was lost.`);
        return false;
      }
    }

    // 3. Preamble / AI commentary refusal phrases check
    if (targetPack?.commentaryPhrases) {
      for (const phrase of targetPack.commentaryPhrases) {
        if (candidate.toLowerCase().startsWith(phrase.toLowerCase())) {
          console.warn(`[OAT StyleEngine] Rejected: Contains commentary preamble "${phrase}".`);
          return false;
        }
      }
    }

    // 4. Source text identity check (translation must not return raw source if languages differ)
    if (sourceText && candidate.trim() === sourceText.trim() && targetPack?.lang !== 'default') {
      const stripPunct = s => (s || '').replace(/[\p{P}\p{S}\s]+/gu, '').toLowerCase();
      if (stripPunct(candidate) === stripPunct(sourceText) && stripPunct(sourceText).length > 6) {
        return false;
      }
    }

    return true;
  }

  // ── MAIN PIPELINE ORCHESTRATION ───────────────────────────────────────────
  async function executeStylePipeline(text, targetLang, sourceLangHint, mtTranslateFn, options = {}) {
    if (!text || typeof text !== 'string') {
      return { success: false, error: 'Empty text' };
    }

    const stages = [];

    // [0] Extract and protect spans
    const { protectedText, spans } = protectSpans(text);
    stages.push({ stage: 'protectSpans', spansCount: spans.length });

    // [1] Detect source language
    const detectedSource = (sourceLangHint && sourceLangHint !== 'auto')
      ? sourceLangHint
      : detectSourceLanguageHeuristic(protectedText);
    stages.push({ stage: 'detectSourceLanguage', detectedSource });

    // [2] Load language packs
    const srcPack = getPack(detectedSource);
    const targetPack = getPack(targetLang);
    stages.push({ stage: 'loadLanguagePacks', src: srcPack.lang, tgt: targetPack.lang });

    // [3] Extract style profile
    const profile = extractStyleProfile(text, srcPack);
    stages.push({ stage: 'extractStyleProfile', profile });

    // [4] Expand source slang / acronyms
    let textToTranslate = protectedText;
    if (options.expandSlang !== false) {
      textToTranslate = expandSlang(protectedText, srcPack);
      stages.push({ stage: 'expandSlang' });
    }

    // [5] Machine Translation (Cloud MT / Google GTX)
    let baseTranslation = '';
    let mtDetected = detectedSource;
    try {
      const mtResult = await mtTranslateFn(textToTranslate, targetLang, detectedSource);
      if (!mtResult || !mtResult.translation) {
        return { success: false, error: mtResult?.error || 'MT failed' };
      }
      baseTranslation = mtResult.translation;
      if (mtResult.detectedSource) mtDetected = mtResult.detectedSource;
      stages.push({ stage: 'meaningTranslation', baseLength: baseTranslation.length });
    } catch (err) {
      return { success: false, error: err.message };
    }

    // [6] Language-Aware Style Restoration Rules
    let styledTranslation = baseTranslation;
    if (options.preserveStyle !== false) {
      styledTranslation = restoreStyleRules(baseTranslation, profile, targetPack, srcPack, targetLang, spans);
      stages.push({ stage: 'restoreStyleRules' });
    }

    // [8] Safety Verification Checks
    let finalCandidate = styledTranslation;
    let fellBack = false;
    if (!passesSafetyChecks(styledTranslation, baseTranslation, profile, targetPack, text)) {
      finalCandidate = baseTranslation; // Guaranteed safe fallback per SPEC §0.1 C4
      fellBack = true;
      stages.push({ stage: 'safetyCheckFallback', reason: 'Safety gate rejected styled candidate' });
    } else {
      stages.push({ stage: 'safetyCheckPassed' });
    }

    // [9] Restore Protected Spans
    const finalTranslation = restoreSpans(finalCandidate, spans);
    stages.push({ stage: 'restoreSpans' });

    return {
      success: true,
      translation: finalTranslation,
      detectedSource: mtDetected,
      fellBack,
      stages,
      styleProfile: profile
    };
  }

  const exportObj = {
    protectSpans,
    restoreSpans,
    detectSourceLanguageHeuristic,
    extractStyleProfile,
    expandSlang,
    stretchWord,
    smoothEnglishContractions,
    synchronizeAIStyle,
    restoreStyleRules,
    passesSafetyChecks,
    executeStylePipeline
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.StyleEngine = exportObj;
  }
})();
