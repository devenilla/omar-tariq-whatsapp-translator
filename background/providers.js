/**
 * Omar Tariq's WhatsApp Translator - AI & MT Provider Adapters (v4.8)
 * 
 * Literary & Conversational Dialogue Translation Engine
 * 
 * Supported Providers:
 * 1. Groq LPU (Llama 3.3 70B, Llama 3.1 8B, Qwen 3.8 27B) - 150ms latency, 14.4k req/day free
 * 2. OpenRouter (Free tier models: Llama 3.3 70B Free, Qwen 72B Free, Mistral 24B Free)
 * 3. Google Gemini (gemini-2.5-flash, gemini-2.5-flash-lite, gemini-flash-latest)
 * 4. Chrome Built-in AI (Gemini Nano on-device) - 0-key, local GPU/NPU
 * 5. Google MT (GTX) - Instant zero-config safety fallback
 * 
 * Features:
 * - Literary translation techniques: Dynamic equivalence, comedic voice matching, sarcasm preservation
 * - Strict typographic mimicry: all-caps screaming, aesthetic all-lowercase, repetitive punctuation runs (......, !?!?)
 * - Emoticon & text emoji preservation (xD, :3, :), -_-, T_T, ¯\_(ツ)_/¯)
 * - Conversational context injection (quoted messages & chat flow)
 * - Live dynamic model discovery from Groq, OpenRouter, and Gemini APIs
 */

(() => {
  'use strict';

  const LANGUAGE_NAMES = {
    ar: 'Arabic',
    tr: 'Turkish',
    en: 'English',
    es: 'Spanish',
    de: 'German',
    fr: 'French',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    ja: 'Japanese',
    zh: 'Chinese',
    ko: 'Korean',
    hi: 'Hindi',
    ur: 'Urdu',
    fa: 'Persian',
    nl: 'Dutch',
    pl: 'Polish',
    id: 'Indonesian'
  };

  function getLanguageName(code) {
    return LANGUAGE_NAMES[code?.toLowerCase()] || code || 'English';
  }

  /**
   * Conversational & Literary System Prompt
   * Enforces exact dynamic equivalence: sarcasm, jokes, punctuation runs, lowercase/caps, emojis, and context grounding.
   */
  function buildConversationalPrompt(targetLangCode, context = null, userCorrections = []) {
    const targetName = getLanguageName(targetLangCode);
    let prompt = `You are an elite, highly intelligent dialogue localization and precision translation expert specializing in contemporary WhatsApp chats into natural, fluent native ${targetName}.

Your mission is to understand human chat messages deeply and translate them with absolute semantic fidelity, natural fluency, and zero robotic stiffness.

UNIVERSAL TRANSLATION DIRECTIVES (APPLIES TO ALL LANGUAGES & DIALECTS):

1. STRICT SEMANTIC FIDELITY & DIRECT MEANING (NO REWRITING OR DRIFT):
   - Translate the EXACT same meaning clause-by-clause into natural native ${targetName}.
   - Do NOT replace the message with a completely different sentence that merely has a "similar meaning" or general vibe.
   - Keep the meaning close to the original sentence structure and thought progression word-by-word, while respecting native grammar.
   - Never paraphrase away the speaker's specific words, assertions, or thoughts.

2. CODE-SWITCHING & MIXED-LANGUAGE TRANSLATION (CRITICAL):
   - When the input text contains a mix of multiple languages (e.g. Turkish + English, Arabic + English, Spanish + English):
     You MUST translate ALL foreign/non-target parts completely into ${targetName} so the entire resulting output is 100% in natural, fluent ${targetName}.
     NEVER refuse to translate.
     NEVER leave foreign fragments untranslated just because parts of the message are already in ${targetName}.
     NEVER return the input unchanged if there are foreign words in it.

3. GENDERS & PRONOUNS MUST NEVER BE MISSED OR SWAPPED:
   - PRONOUNS: Every subject and object pronoun (I, you, he, she, it, we, they, me, him, her, us, them, my, your, his, her, their, our) MUST be preserved with 100% precision. Never drop pronouns or turn active personal statements into vague passive thoughts.
   - GENDER: If the source text uses feminine markers, verbs, adjectives, or addresses a female (in Arabic, French, Spanish, Russian, Turkish, etc.), the translation MUST preserve the exact female gender (she/her/feminine agreement). Never collapse or neutralize gender into generic masculine when female is intended.
   - When pro-drop (null-subject) verbs are used, use the surrounding context to determine the exact subject and gender, but never drop or invert them.

4. REPEATED WORDS & EMPHASIS RUNS (NEVER DELETE OR COLLAPSE):
   - If words are repeated for emphasis, emotion, or comedic cadence (e.g. "no no no", "tamam tamam", "really really", "hayır hayır", "çok çok", "لا لا لا", "yok yok", "please please", "wait wait"):
     You MUST keep the exact same repetition count in the translation (e.g. "hayır hayır" -> "no no").
     NEVER collapse repeated words into a single word, and never delete them.

5. LINE BREAKS, PARAGRAPHS & SENTENCE STRUCTURE PRESERVATION:
   - If the source text contains line breaks (\\n), multiple lines, bullet points, or paragraphs:
     You MUST preserve the EXACT same line breaks and paragraph structure in the output.
     NEVER collapse or merge multi-line messages into a single line.
   - Maintain the original sentence structure, clause boundaries, and thought progression.

6. ACCURATE COLLOQUIAL IDIOMS & NATIVE CONTRACTIONS:
   - Translate the true human intent and meaning, not literal word-for-word robot syntax.
   - Use natural native contractions (e.g. in English: "it'll", "don't", "can't", "you'll", "there's", "nothing to be done", "gonna") and everyday texting cadence.
   - Translate colloquial idioms and slang into their precise equivalent native meaning in ${targetName} without missing the true point or inventing unrelated phrases.

7. BREVITY & PROPORTIONALITY (MATCH REAL CHAT LENGTH):
   - Match the exact length, simplicity, and brevity of the original message.
   - If the message is short or simple (e.g. "Iyi O zaman", "tamam", "peki", "nolsun", "عامل ايه", "ماشي", "olur", "yok ya", "ca va", "todo bien"), translate it directly and concisely ("Alright then", "got it", "okay", "not much", "how are you doing", "sure", "nah", "doing good", "all good").
   - NEVER add extra words, unprompted commentary, explanations, parenthetical remarks, or long-winded sentences.
   - A 2-word message MUST translate to a concise 2-3 word native message. Never turn a quick text into a speech.

8. UNIVERSAL VOCATIVES & CASUAL ADDRESS (NEVER ARCHAIC):
   - In all languages and dialects (e.g. Arabic "يا [Name]", Turkish "ya [Name]" / "kanka", Spanish "oye [Name]" / "tío", French "dis [Name]" / "wesh", German "digga", Russian "слушай [Name]"):
   - Translate casually as "Hey [Name]", "[Name], ...", or casual buddy address.
   - NEVER translate informal vocatives as archaic or biblical "O [Name]" or "Oh [Name]". Real human friends in 2026 never say "O Omar".

9. UNIVERSAL DISCOURSE MARKERS & ATTENTION GETTERS:
   - Conversational transition words across all languages:
     - Arabic: "بقولك" / "بقولك ايه" -> "tell me", "listen", "by the way" (NEVER literal "what should I say to you?" or "I tell you").
     - Turkish: "bak şimdi", "ya bir شيء diyeceğim", "sana bir şey sorcam" -> "listen", "tell me", "by the way".
     - Spanish: "dime", "oye", "mira", "te digo" -> "tell me", "listen", "by the way".
     - French: "dis-moi", "tu sais quoi", "écoute" -> "tell me", "you know what", "listen".
     - German: "sag mal", "hör mal", "weißt du was" -> "tell me", "listen", "you know what".
   - Treat them as pragmatic conversational discourse markers, NOT literal questions or declarative commands.

10. UNIVERSAL PRO-DROP TENSE & SUBJECT AGREEMENT:
   - In null-subject / pro-drop languages (Arabic, Turkish, Spanish, Italian, Portuguese, etc.):
     - Verb prefixes/suffixes indicate grammatical person and aspect.
     - Arabic first-person continuous "باتفرج" (b- + atfarag) -> "I'm watching" (NEVER an imperative command like "Watch!").
     - Turkish "izliyorum" -> "I'm watching" (NEVER "watch").
     - Spanish "estoy viendo" / "veo" -> "I'm watching" (NEVER "watch").
     - Never confuse first-person declarations ("I am doing X") with imperative commands ("Do X!").

11. TOPIC CONTINUITY & CONTEXT GROUNDING (UNDERSTAND CONTEXT WITHOUT ECHOING IT):
   - In fast WhatsApp chats, messages are short and depend heavily on surrounding context.
   - Use the "SURROUNDING BACKGROUND CONTEXT" (preceding turns, following turns, chat contact/topic, replied quote):
     a) Maintain topic continuity: e.g. If the chat discusses studying, school, STEM, or exams:
        - "LO" / "lo" means "Learning Objectives" / "Learning Outcomes".
        - "concepts" means conceptual explanations/lectures.
        - "بيلم" means "summarizes / wraps up / covers" the syllabus (NEVER "movie").
        - "كنت باعتله" means "I had sent to him" (root بعت to send, NEVER "abuse").
        - "ع طول" / "على طول" means "directly / straight away" (NEVER "all the time").
        - "دفعة" / "دفعتكم" means "graduating class / student batch / cohort" (NEVER "payment").
        - "فصل" / "فصله" means "his classroom / class section" (NEVER "dismiss him" or "fire him").
        - "اسمو ثلاثي" / "الاسم الثلاثي" means "his full three-part name (first, middle, last)" (NEVER "trio" or "called a trio").
        - "الرقم القومي" means "National ID number".
        - "يبعتلي برايفت" / "برايفت" means "send me a private message / DM me".
        - "نزلوه" / "حملوه" means "Download it! / go download it guys" (imperative plural, NEVER "they downloaded it").
        - "رفع" / "رفعه" means "uploaded / upload it" vs "نزل" / "نزله" means "download / downloaded it".
        - "اعتنموه" (typo of اغتنموه) means "take advantage of it / make the most of it".
        - "انشروه" means "share it / spread it everywhere".
        - "السكن" / "سكن الطلاب" in student, university, or friend chats means "the dorms" / "student housing / dormitory" (e.g. "جاي السكن مع يونس" -> "coming to the dorm with Yunis", NEVER "coming to live with").
        - "الستادي" in student slang means "the study room / study hall" (transliterated from English "Study", NEVER "the stadium").
        - "توهت" / "توهت للدرجادي" means "Did you get lost that bad?" / "Did you get that lost?" / "Did you get lost that hard?" (from root تاه to lose one's way navigating, NEVER "you lost your mind").
        - "هرن عليك" / "هرن" means "I'll call you / I'm going to ring you / buzz you" (from هـ + رن, NEVER "I'm waiting for you").
        - "تنزل تفتح الباب" means "so you come down and open the door" / "come down and open the door".
        - "كمان [X] د" means "in [X] minutes" / "in about [X] mins" (د = دقيقة = min, "كمان" with number/duration = in [duration], NEVER "Also [X] D").
        - "فينك كده" means "Where you at?" / "Where are you?" / "Omar, you there?" (casual check-in, NEVER literal "Where are you like that?").
        - "عمر موجود هناك؟" means "Is Omar there?" / "Omar, you there?".
        - "هطلع اتوضى وانزل اصلي" (and typos like "هطلت", "اصلس") means "I'm going up to do wudu and come down to pray".
     b) Disambiguate pronouns ("it", "he", "she", "they", "that") and null-subject verbs.
     c) Resolve ambiguous short replies based on what the person was replying to.
     d) Understand who is speaking to whom (Me vs Other).
   - NEVER translate, echo, repeat, summarize, or output ANY part of the surrounding background context.

12. EMOTIONAL TEMPERATURE & SARCASM:
   - Sarcasm, teasing, playful banter, and deadpan irony must keep their exact subtle wit.
   - Heart-to-hearts must maintain intimate sincerity; excitement or frustration must carry the exact same intensity.
   - If the message is neutral or straightforward, KEEP IT straightforward. Do NOT inject fake drama or forced comedy.

13. TYPOGRAPHY & PUNCTUATION SYNCHRONIZATION:
   - Extended punctuation runs: If the source has repeated dots or exclamations (e.g. ......, ????, !!!!, !?!?!, ...!?), output the EXACT same run length and characters.
   - Zero punctuation: If the source ends with NO punctuation, DO NOT add a period. Real chatters do not put periods at the end of casual messages.
   - Capitalization: ALL-CAPS SCREAMING remains ALL-CAPS SCREAMING. Aesthetic lowercase remains 100% lowercase with no initial capital letter.

14. EMOJIS & TEXT EMOTICONS (STRICT PRESERVATION):
   - Keep ALL Unicode emojis (😂, 💀, 🔥, 🥰, 🥺, etc.) and text emoticons/kaomoji (xD, :3, :), -_-, T_T, :v, ;-;, ;_;, ¯\\_(ツ)_/¯) in their exact relative positions in the text.
   - CRITICAL: NEVER invent, hallucinate, substitute, or add new emojis that were not in the source text.
   - CRITICAL: NEVER drop, omit, or strip emojis or emoticons from the translation.

15. MENTIONS (@Name, @~Name, @Phone) & PHONE NUMBERS (NEVER TRANSLATE OR DROP):
   - When the message contains user mentions (e.g. @~Honda, @~Yahia Mostafa, @Yazin Hisham (STEM S29), @Omar, @+1234567) or phone numbers:
     You MUST keep them in the EXACT same place in the translated message.
     NEVER translate the names inside mentions (do NOT translate Honda, Yahia, Hisham, etc.).
     NEVER drop, delete, or omit mentions or phone numbers from the message.
     Preserve the exact '@' symbol and name/handle.

16. PRAGMATIC INTENT & ACTION DIRECTIONALITY (CRITICAL):
   - In conversational messaging, always disambiguate whether an action is:
     a) An instruction/command to others: e.g. "نزلوه" / "حملوه" -> "Download it!" or "Go download it guys" (imperative plural, NOT "they downloaded it").
     b) A personal action completed: e.g. "نزلته" -> "I downloaded it" or "I posted it".
     c) Media sharing: "رفعه" / "رفعته" -> "uploaded it / I uploaded it" vs "نزله" / "نزلته" -> "downloaded it / I downloaded it" or "it was released".
     d) An offer or polite request: e.g. "ابعتلي" / "ابعتلك" -> "send me / shall I send you".
   - Never reverse the direction of an action or confuse who did what.

17. FEW-SHOT PRAGMATIC TRANSLATION EXAMPLES (LEARN FROM THESE PAIRS):
   - Example 1 (Dorm navigation):
     Input: "جاي السكن مع يونس"
     Output: "coming to the dorm with Yunis"
   - Example 2 (Getting lost navigation teasing):
     Input: "أنت توهت للدرجادي 😂😂"
     Output: "Did you get lost that hard? 😂😂"
   - Example 3 (Calling phone to open door):
     Input: "هرن عليك تنزل تفتح الباب بقا"
     Output: "I'm going to ring you to come and open the door for me"
   - Example 4 (Time abbreviation):
     Input: "كمان 7 د"
     Output: "in about 7 minutes"
   - Example 5 (Casual check-in):
     Input: "فينك كده"
     Output: "Where you at?"
   - Example 6 (Study room in dorm):
     Input: "في الستادي"
     Output: "In the study room"
   - Example 7 (Checking presence):
     Input: "عمر موجود هناك؟"
     Output: "Omar, you there?"
   - Example 8 (Colloquial download imperative + vocative):
     Input: "نزلوه من اللينك ده يا رجالة"
     Output: "Download it from this link guys"
   - Example 9 (Educational terminology & 3-part name):
     Input: "اسمو ثلاثي وفصله عشان نسجله"
     Output: "His full name and class so we can register him"
   - Example 10 (Cohort & immediate download):
     Input: "دفعتكم نزلوه على طول"
     Output: "Your class downloaded it right away"
   - Example 11 (Code-switching Egyptian + English):
     Input: "بقولك ايه انت خلصت ال assignment وعملتله submit ولا لسه؟"
     Output: "Tell me, did you finish the assignment and submit it or not yet?"
   - Example 12 (Turkish brief acceptance):
     Input: "Iyi O zaman"
     Output: "Alright then"
   - Example 13 (Turkish street slang + exasperation):
     Input: "yok ya valla uğraşamam"
     Output: "nah honestly I can't be bothered"
   - Example 14 (Turkish + English code-switching):
     Input: "Ben de accept ettim ama gelmedi"
     Output: "I also accepted it, but it didn't come through"
   - Example 15 (Spanish casual agreement + exclamation):
     Input: "Dale, nos vemos mañana!!"
     Output: "Alright, see you tomorrow!!"
   - Example 16 (French casual slang):
     Input: "wesh tranquille ou quoi?"
     Output: "hey what's up, all good?"
   - Example 17 (Russian friendly sign-off):
     Input: "Давай, потом спишемся"
     Output: "Take care, we'll text later"

18. OUTPUT INVARIANT:
   - Output ONLY the translated target message. No quotes, no speaker labels ("Me:", "Other:"), no markdown fences, and no conversational filler.`;

    // ── Inject User Preferred Vocabulary & Reported Corrections ────────────
    if (Array.isArray(userCorrections) && userCorrections.length > 0) {
      const relevant = userCorrections.filter(c => {
        if (!c || !c.sourceText || !c.targetText) return false;
        if (c.targetLang && c.targetLang !== targetLangCode && c.targetLang !== 'all') return false;
        return true;
      });
      if (relevant.length > 0) {
        prompt += `\n\nUSER PREFERRED VOCABULARY & REPORTED CORRECTIONS (HIGHEST PRIORITY):\nThe user has explicitly specified and verified the following preferred translations. When translating any message containing these phrases or terms, you MUST adhere to these exact target renderings:\n`;
        for (const c of relevant) {
          const from = c.sourceLang ? `From: ${c.sourceLang}` : 'From: any';
          const to = c.targetLang ? `To: ${c.targetLang}` : `To: ${targetName}`;
          prompt += `- Source: "${c.sourceText.trim()}" => Target Translation: "${c.targetText.trim()}" (${from}, ${to})\n`;
        }
      }
    }

    if (context && typeof context === 'string' && context.trim()) {
      prompt += `\n\nSURROUNDING BACKGROUND CONTEXT (FOR INFERENCE ONLY — DO NOT TRANSLATE, DO NOT INCLUDE IN RESPONSE):\n${context.trim()}`;
    }

    return prompt;
  }

  // ── 1. GROQ PROVIDER ──────────────────────────────────────────────────────
  async function translateWithGroq(text, targetLang, apiKey, model = 'llama-3.3-70b-versatile', context = null, userCorrections = []) {
    if (!apiKey) throw new Error('Missing Groq API Key');
    if (!text || !text.trim()) return '';

    const systemPrompt = buildConversationalPrompt(targetLang, context, userCorrections);
    const targetName = getLanguageName(targetLang);
    const userPrompt = `TARGET MESSAGE TO TRANSLATE (translate ONLY this text below into concise, natural ${targetName}, output nothing else):\n${text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const modelName = (model || 'llama-3.3-70b-versatile').trim();

    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1024
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        let errMsg = `Groq HTTP ${resp.status}`;
        try {
          const errData = await resp.json();
          if (errData?.error?.message) errMsg = errData.error.message;
        } catch (_) {}
        if (resp.status === 429) {
          const err = new Error(`Groq rate limit exceeded: ${errMsg}`);
          err.isRateLimit = true;
          throw err;
        }
        throw new Error(errMsg);
      }

      const data = await resp.json();
      const rawText = data?.choices?.[0]?.message?.content?.trim();
      if (!rawText) throw new Error('Empty response received from Groq');

      return cleanAIResponse(rawText);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // ── 2. OPENROUTER PROVIDER (FREE MODELS WITH HIGH LIMITS) ─────────────────
  async function translateWithOpenRouter(text, targetLang, apiKey, model = 'meta-llama/llama-3.3-70b-instruct:free', context = null, userCorrections = []) {
    if (!apiKey) throw new Error('Missing OpenRouter API Key');
    if (!text || !text.trim()) return '';

    const systemPrompt = buildConversationalPrompt(targetLang, context, userCorrections);
    const targetName = getLanguageName(targetLang);
    const userPrompt = `TARGET MESSAGE TO TRANSLATE (translate ONLY this text below into concise, natural ${targetName}, output nothing else):\n${text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const modelName = (model || 'meta-llama/llama-3.3-70b-instruct:free').trim();

    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://web.whatsapp.com',
          'X-Title': "Omar Tariq's WhatsApp Translator"
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1024
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        let errMsg = `OpenRouter HTTP ${resp.status}`;
        try {
          const errData = await resp.json();
          if (errData?.error?.message) errMsg = errData.error.message;
        } catch (_) {}
        if (resp.status === 429) {
          const err = new Error(`OpenRouter rate limit: ${errMsg}`);
          err.isRateLimit = true;
          throw err;
        }
        throw new Error(errMsg);
      }

      const data = await resp.json();
      const rawText = data?.choices?.[0]?.message?.content?.trim();
      if (!rawText) throw new Error('Empty response received from OpenRouter');

      return cleanAIResponse(rawText);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // ── 2b. OPENAI PROVIDER ───────────────────────────────────────────────────
  async function translateWithOpenAI(text, targetLang, apiKey, model = 'gpt-4o-mini', context = null, userCorrections = []) {
    if (!apiKey) throw new Error('Missing OpenAI API Key');
    if (!text || !text.trim()) return '';

    const systemPrompt = buildConversationalPrompt(targetLang, context, userCorrections);
    const targetName = getLanguageName(targetLang);
    const userPrompt = `TARGET MESSAGE TO TRANSLATE (translate ONLY this text below into concise, natural ${targetName}, output nothing else):\n${text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const modelName = (model || 'gpt-4o-mini').trim();

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1024
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        let errMsg = `OpenAI HTTP ${resp.status}`;
        try {
          const errData = await resp.json();
          if (errData?.error?.message) errMsg = errData.error.message;
        } catch (_) {}
        if (resp.status === 429) {
          const err = new Error(`OpenAI rate limit: ${errMsg}`);
          err.isRateLimit = true;
          throw err;
        }
        throw new Error(errMsg);
      }

      const data = await resp.json();
      const rawText = data?.choices?.[0]?.message?.content?.trim();
      if (!rawText) throw new Error('Empty response received from OpenAI');

      return cleanAIResponse(rawText);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async function testOpenAIConnection(apiKey, model = 'gpt-4o-mini') {
    if (!apiKey || !apiKey.trim()) throw new Error('API key required');
    const start = Date.now();
    const modelName = (model || 'gpt-4o-mini').trim();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'user', content: 'Say OK' }
          ],
          max_tokens: 5,
          temperature: 0.0
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (!resp.ok) {
        let errMsg = `OpenAI HTTP ${resp.status}`;
        try {
          const d = await resp.json();
          if (d?.error?.message) errMsg = d.error.message;
        } catch (_) {}
        return { success: false, error: errMsg, latencyMs };
      }

      return { success: true, latencyMs };
    } catch (err) {
      clearTimeout(timeout);
      return { success: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  // ── 3. GOOGLE GEMINI PROVIDER ─────────────────────────────────────────────
  async function translateWithGemini(text, targetLang, apiKey, model = '', context = null, userCorrections = []) {
    if (!apiKey) throw new Error('Missing Gemini API Key');
    if (!text || !text.trim()) return '';

    const systemPrompt = buildConversationalPrompt(targetLang, context, userCorrections);
    const targetName = getLanguageName(targetLang);
    const userPrompt = `TARGET MESSAGE TO TRANSLATE (translate ONLY this text below into concise, natural ${targetName}, output nothing else):\n${text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const cleanModel = (model || 'gemini-1.5-flash').trim().replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim()
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        let errMsg = `Gemini HTTP ${resp.status}`;
        try {
          const errData = await resp.json();
          if (errData?.error?.message) errMsg = errData.error.message;
        } catch (_) {}
        if (resp.status === 429) {
          const err = new Error(`Gemini rate limit exceeded: ${errMsg}`);
          err.isRateLimit = true;
          throw err;
        }
        throw new Error(errMsg);
      }

      const data = await resp.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rawText) throw new Error('Empty response received from Gemini');

      return cleanAIResponse(rawText);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // ── 4. CHROME BUILT-IN AI (ON-DEVICE GEMINI NANO) ──────────────────────────
  async function isChromeAIAvailable() {
    try {
      if (typeof ai !== 'undefined' && ai.languageModel) {
        const caps = await ai.languageModel.capabilities();
        return caps.available === 'readily';
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  async function translateWithChromeAI(text, targetLang, context = null, userCorrections = []) {
    if (!(await isChromeAIAvailable())) {
      throw new Error('Chrome Built-in AI is not available or enabled on this browser');
    }

    const systemPrompt = buildConversationalPrompt(targetLang, context, userCorrections);
    const session = await ai.languageModel.create({
      systemPrompt
    });

    try {
      const prompt = `TARGET MESSAGE TO TRANSLATE (translate ONLY this text below, output nothing else):\n${text}`;
      const response = await session.prompt(prompt);
      session.destroy();
      return cleanAIResponse(response.trim());
    } catch (err) {
      session.destroy();
      throw err;
    }
  }

  // ── 5. UTILITIES & RESPONSE CLEANING ──────────────────────────────────────
  function cleanAIResponse(text) {
    if (!text) return '';
    let result = text.trim();

    // Strip markdown code fences if AI wrapped the translation in ```
    if (result.startsWith('```') && result.endsWith('```')) {
      result = result.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    // Strip wrapping quotes if entire text is in quotes
    if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith('“') && result.endsWith('”'))) {
      result = result.slice(1, -1).trim();
    }

    // Strip common AI preambles & stray speaker / context prefixes
    const preambles = [
      /^Sure[,!]? (here is|here's) the translation:?\s*/i,
      /^Here is the translation:?\s*/i,
      /^Translation:?\s*/i,
      /^Here's the translation:?\s*/i,
      /^Translating to [a-zA-Z]+:?\s*/i,
      /^Target message translation:?\s*/i,
      /^Target message:?\s*/i,
      /^(?:Me|Other|You|Replied to):[^\n]*\n+/i
    ];

    for (const pat of preambles) {
      result = result.replace(pat, '');
    }

    return result.trim();
  }

  // ── 6. DYNAMIC MODEL DISCOVERY (FETCH REAL LIVE MODELS) ───────────────────
  async function fetchGroqModels(apiKey) {
    if (!apiKey || !apiKey.trim()) throw new Error('API key required to fetch Groq models');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Groq HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid models response structure from Groq');
      }

      const chatKeywords = ['llama', 'qwen', 'gpt-oss', 'deepseek', 'mistral', 'gemma', 'minimax', 'compound'];
      const chatModels = data.data
        .filter(m => chatKeywords.some(kw => m.id.toLowerCase().includes(kw)))
        .map(m => ({ id: m.id, label: m.id }));

      return { success: true, models: chatModels };
    } catch (err) {
      clearTimeout(timeout);
      return { success: false, error: err.message, models: [] };
    }
  }

  async function fetchOpenRouterModels(apiKey) {
    if (!apiKey || !apiKey.trim()) throw new Error('API key required to fetch OpenRouter models');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const resp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `OpenRouter HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid models response from OpenRouter');
      }

      // Prioritize free models first
      const freeModels = data.data
        .filter(m => m.id.endsWith(':free'))
        .map(m => ({ id: m.id, label: `${m.name || m.id} (Free)` }));

      const otherPopular = data.data
        .filter(m => !m.id.endsWith(':free') && (m.id.includes('llama') || m.id.includes('qwen') || m.id.includes('deepseek')))
        .slice(0, 15)
        .map(m => ({ id: m.id, label: m.name || m.id }));

      return { success: true, models: [...freeModels, ...otherPopular] };
    } catch (err) {
      clearTimeout(timeout);
      return { success: false, error: err.message, models: [] };
    }
  }

  async function fetchGeminiModels(apiKey) {
    if (!apiKey || !apiKey.trim()) throw new Error('API key required to fetch Gemini models');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
      const resp = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim()
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data?.models || !Array.isArray(data.models)) {
        throw new Error('Invalid models response structure from Gemini');
      }

      const supported = data.models
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => {
          const cleanId = m.name.replace(/^models\//, '');
          return { id: cleanId, label: m.displayName ? `${m.displayName} (${cleanId})` : cleanId };
        });

      return { success: true, models: supported };
    } catch (err) {
      clearTimeout(timeout);
      return { success: false, error: err.message, models: [] };
    }
  }

  // ── 7. CONNECTION TESTING (FOR POPUP PING BUTTONS) ────────────────────────
  async function testGroqConnection(apiKey, model = 'llama-3.3-70b-versatile') {
    const start = Date.now();
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: (model || 'llama-3.3-70b-versatile').trim(),
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5
        })
      });

      const latencyMs = Date.now() - start;
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return { success: false, error: errData?.error?.message || `HTTP ${resp.status}`, latencyMs };
      }
      return { success: true, latencyMs };
    } catch (err) {
      return { success: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async function testOpenRouterConnection(apiKey, model = 'meta-llama/llama-3.3-70b-instruct:free') {
    const start = Date.now();
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://web.whatsapp.com',
          'X-Title': "Omar Tariq's WhatsApp Translator"
        },
        body: JSON.stringify({
          model: (model || 'meta-llama/llama-3.3-70b-instruct:free').trim(),
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5
        })
      });

      const latencyMs = Date.now() - start;
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return { success: false, error: errData?.error?.message || `HTTP ${resp.status}`, latencyMs };
      }
      return { success: true, latencyMs };
    } catch (err) {
      return { success: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  async function testGeminiConnection(apiKey, model = 'gemini-1.5-flash') {
    const start = Date.now();
    const cleanModel = (model || 'gemini-1.5-flash').trim().replace(/^models\//, '');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim()
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });

      const latencyMs = Date.now() - start;
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return { success: false, error: errData?.error?.message || `HTTP ${resp.status}`, latencyMs };
      }
      return { success: true, latencyMs };
    } catch (err) {
      return { success: false, error: err.message, latencyMs: Date.now() - start };
    }
  }

  const exportObj = {
    translateWithGroq,
    translateWithOpenRouter,
    translateWithOpenAI,
    translateWithGemini,
    translateWithChromeAI,
    isChromeAIAvailable,
    fetchGroqModels,
    fetchOpenRouterModels,
    fetchGeminiModels,
    testGroqConnection,
    testOpenRouterConnection,
    testOpenAIConnection,
    testGeminiConnection,
    cleanAIResponse,
    buildConversationalPrompt
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.TranslationProviders = exportObj;
  }
})();
