/**
 * Omar Tariq's WhatsApp Translator - Content Script v4.2
 *
 * Core Engineering Pillars & Invariant Rules:
 * 1. Auto-Translation Strictly for Received Messages:
 *    - Automatically translates received (incoming) messages (.message-in) at a steady, polite rate (160ms).
 *    - Processes visible incoming messages from oldest (top) to newest (bottom).
 *    - Outgoing messages and the input box are NEVER automatically modified.
 * 2. Persistent Translation Storage (LRU Memory Engine):
 *    - All translations are persistently saved to chrome.storage.local keyed by message data-id.
 *    - When switching chats or re-opening WhatsApp Web, translations restore instantly from memory.
 *    - Automatic LRU pruning caps cache at 600 entries to preserve browser space and RAM.
 * 3. Input Draft Control (100% Native):
 *    - The user types and sends normally with zero automatic interference.
 *    - Manual translation on-demand via Ctrl+Enter or the format bar button [文A TR].
 * 4. Single Hover Button & Clean Emoji Reaction Bar:
 *    - Exactly ONE hover translate button per message bubble (beside button[aria-label="React"]).
 *    - Format bar button is strictly barred from ever appearing inside the emoji reaction bar.
 * 5. Nested Quote Translation (Inside the Reply Box):
 *    - Quote translation (.oat-quote-translated) is appended to snippetLeaf.closest('div')
 *      strictly INSIDE the colored reply preview card with a subtle divider line.
 */

(() => {
  'use strict';

  const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Turkish' },
    { code: 'ru', name: 'Russian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'uk', name: 'Ukrainian' }
  ];

  const SVG_TRANSLATE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
  <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2 22l5.08-1.34C8.54 21.52 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18.2c-1.54 0-2.98-.44-4.21-1.2l-.3-.18-3.12.82.83-3.04-.2-.32C4.18 15.02 3.8 13.55 3.8 12c0-4.52 3.68-8.2 8.2-8.2 4.52 0 8.2 3.68 8.2 8.2 0 4.52-3.68 8.2-8.2 8.2z"/>
  <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" transform="matrix(0.55 0 0 0.55 6.2 5.5)"/>
</svg>`;

  // ── State & Storage ───────────────────────────────────────────────────────
  let myLanguage = 'en';
  let defaultTargetLanguage = 'tr';
  let chatTargetLanguages = {};
  let currentChatId = 'default';

  let autoTranslateEnabled = true;
  let autoTranslateMode = 'both';
  let excludedLanguages = [];

  // Persistent Translation LRU Cache
  let savedTranslations = {};
  let saveDebounceTimer = null;

  // Auto-Translate FIFO Queue for Received Messages
  const autoTranslateQueue = [];
  let isProcessingQueue = false;
  // Keyed by message data-id string so it survives DOM re-renders and clears properly on chat switch
  const queuedIds = new Set();
  const knownChatRowIds = new Set();
  let chatOpenTimestamp = 0;

  function getRowId(row) {
    return row?.getAttribute?.('data-id') ||
      row?.dataset?.id ||
      row?.closest?.('[data-id]')?.getAttribute('data-id') ||
      row?.querySelector?.('[data-id]')?.getAttribute('data-id') ||
      null;
  }

  function markCurrentChatRowsAsKnown() {
    const scope = document.querySelector('#main') || document;
    const allRows = scope.querySelectorAll('.message-in, .message-out, [data-id], #main div[role="row"], div[data-testid="msg-container"]');
    for (const r of allRows) {
      const id = getRowId(r) || getMessageId(r);
      if (id) knownChatRowIds.add(id);
    }
  }

  function onChatOpenedOrChanged() {
    autoTranslateQueue.length = 0;
    queuedIds.clear();
    knownChatRowIds.clear();
    chatOpenTimestamp = Date.now();
    restoreAllVisibleSavedTranslations();

    // Mark historical messages so only genuine NEW messages arriving live get auto-translated
    markCurrentChatRowsAsKnown();
    setTimeout(markCurrentChatRowsAsKnown, 180);
    setTimeout(markCurrentChatRowsAsKnown, 500);
  }

  chrome.storage.local.get([
    'myLanguage',
    'defaultTargetLanguage',
    'lastTargetLanguage',
    'chatTargetLanguages',
    'autoTranslateEnabled',
    'autoTranslateMode',
    'excludedLanguages',
    'savedTranslations'
  ], d => {
    if (d.myLanguage) myLanguage = d.myLanguage;
    if (d.defaultTargetLanguage) {
      defaultTargetLanguage = d.defaultTargetLanguage;
    } else if (d.lastTargetLanguage) {
      defaultTargetLanguage = d.lastTargetLanguage;
    }
    if (d.chatTargetLanguages) {
      chatTargetLanguages = d.chatTargetLanguages;
      delete chatTargetLanguages['Chats'];
      delete chatTargetLanguages['default'];
      delete chatTargetLanguages['Archived'];
    }
    if (d.autoTranslateEnabled !== undefined) {
      autoTranslateEnabled = d.autoTranslateEnabled;
    } else {
      autoTranslateEnabled = true;
      chrome.storage.local.set({ autoTranslateEnabled: true });
    }
    if (d.autoTranslateMode) {
      autoTranslateMode = d.autoTranslateMode;
    } else {
      autoTranslateMode = 'both';
      chrome.storage.local.set({ autoTranslateMode: 'both' });
    }
    if (d.excludedLanguages) {
      excludedLanguages = d.excludedLanguages;
    } else {
      excludedLanguages = [];
    }
    if (d.savedTranslations) savedTranslations = d.savedTranslations;
    console.log(`[OAT AutoTranslate] Init: autoTranslateEnabled=${autoTranslateEnabled}, mode=${autoTranslateMode}, myLanguage=${myLanguage}`);
    refreshBadges();
    onChatOpenedOrChanged();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.myLanguage) myLanguage = changes.myLanguage.newValue;
    if (changes.defaultTargetLanguage) defaultTargetLanguage = changes.defaultTargetLanguage.newValue;
    if (changes.lastTargetLanguage && !changes.defaultTargetLanguage) defaultTargetLanguage = changes.lastTargetLanguage.newValue;
    if (changes.chatTargetLanguages) chatTargetLanguages = changes.chatTargetLanguages.newValue || {};
    if (changes.savedTranslations) savedTranslations = changes.savedTranslations.newValue || {};
    if (changes.excludedLanguages) {
      excludedLanguages = changes.excludedLanguages.newValue;
    }
    if (changes.autoTranslateMode) {
      autoTranslateMode = changes.autoTranslateMode.newValue || 'others';
      onChatOpenedOrChanged();
    }
    if ('autoTranslateEnabled' in changes) {
      autoTranslateEnabled = changes.autoTranslateEnabled.newValue;
      if (autoTranslateEnabled) {
        onChatOpenedOrChanged();
      } else {
        autoTranslateQueue.length = 0;
        queuedIds.clear();
      }
    }
    refreshBadges();
  });

  // ── Runtime Message Listener (Cache Purge & Tab Control) ──────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'CACHE_CLEARED') {
      try {
        savedTranslations = {};
        queuedIds.clear();
        autoTranslateQueue.length = 0;
        const translatedBodies = document.querySelectorAll('.oat-translated-content');
        for (const el of translatedBodies) el.remove();
        const translatedQuotes = document.querySelectorAll('.oat-quote-translated');
        for (const el of translatedQuotes) el.remove();
        cleanupStrayTranslationNodes();
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return false;
    }

    if (request.action === 'USER_CORRECTION_SAVED' && request.correction) {
      try {
        const src = (request.correction.sourceText || '').trim().toLowerCase();
        const tgt = (request.correction.targetText || '').trim();
        if (src && tgt) {
          const allTransNodes = document.querySelectorAll('.oat-translated-content, .oat-quote-translated');
          for (const node of allTransNodes) {
            if ((node.dataset.originalText || '').trim().toLowerCase() === src) {
              renderFormattedTranslatedText(node, tgt);
              attachCorrectionAction(node, {
                originalText: request.correction.sourceText,
                currentTranslation: tgt,
                targetLang: request.correction.targetLang || myLanguage || 'en',
                msgId: node.dataset.msgId,
                isQuote: node.dataset.isQuote === 'true'
              });
            }
          }
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return false;
    }
  });

  // ── Persistent Translation LRU Management ─────────────────────────────────

  function getMessageId(row) {
    if (!row) return null;
    const dataId = row.getAttribute?.('data-id') ||
      row.dataset?.id ||
      row.closest?.('[data-id]')?.getAttribute('data-id') ||
      row.querySelector?.('[data-id]')?.getAttribute('data-id');
    if (dataId) return dataId;

    const isOut = (row.classList?.contains('message-out') || !!row.querySelector?.('.message-out') || row.getAttribute?.('data-id')?.startsWith('true_')) ? 'out' : 'in';
    const textSnippet = (row.textContent || '').slice(0, 50).replace(/\s+/g, ' ').trim();
    if (textSnippet) {
      return `${getChatId()}_${isOut}_${textSnippet}`;
    }
    return null;
  }

  function hasTranslationNodes(row) {
    return !!row.querySelector('.oat-translated-content, .oat-quote-translated');
  }

  function persistTranslation(msgId, data) {
    if (!msgId || !data) return;
    savedTranslations[msgId] = {
      ...data,
      timestamp: Date.now()
    };

    // LRU Pruning: Keep up to 600 entries to optimize storage and RAM
    const keys = Object.keys(savedTranslations);
    if (keys.length > 600) {
      keys.sort((a, b) => (savedTranslations[a]?.timestamp || 0) - (savedTranslations[b]?.timestamp || 0));
      for (let i = 0; i < 100; i++) {
        delete savedTranslations[keys[i]];
      }
    }

    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      chrome.storage.local.set({ savedTranslations });
    }, 300);
  }

  function findRowByMessageId(id) {
    if (!id) return null;
    try {
      const el = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (el) return el.closest('.message-in') || el.closest('.message-out') || el.closest('[data-id]') || el.closest('[role="row"]') || el;
    } catch (e) {}
    const scope = document.querySelector('#main') || document;
    const allRows = scope.querySelectorAll('.message-in, .message-out, [data-id], #main div[role="row"], div[data-testid="msg-container"]');
    for (const r of allRows) {
      if (getRowId(r) === id || getMessageId(r) === id) return r;
    }
    return null;
  }

  function getMessageBubble(el) {
    if (!el) return null;
    const bubble = el.closest?.('.message-in, .message-out');
    if (bubble) return bubble;
    const childBubble = el.querySelector?.('.message-in, .message-out');
    if (childBubble) return childBubble;

    // Modern WhatsApp Web without .message-in/.message-out classes:
    const row = el.matches?.('[data-id], [role="row"]') ? el : el.closest?.('[data-id], [role="row"]');
    if (row) {
      const copyableDiv = row.querySelector?.('div.copyable-text');
      if (copyableDiv) {
        const bubbleParent = copyableDiv.closest?.('div._amk4, div[class*="bubble" i], div[data-testid="msg-container"]');
        return bubbleParent || copyableDiv;
      }

      const inner = row.querySelector?.('div._amk4, div[class*="bubble" i], div[data-testid="msg-container"]');
      if (inner && inner.getAttribute?.('role') !== 'row') {
        return inner;
      }

      if (el !== row && el.tagName === 'DIV' && el.getAttribute?.('role') !== 'row') {
        return el;
      }

      const firstDiv = row.querySelector?.(':scope > div, div');
      if (firstDiv && firstDiv.getAttribute?.('role') !== 'row') {
        return firstDiv;
      }
    }

    const copyable = el.closest?.('div.copyable-text') || el.querySelector?.('div.copyable-text');
    if (copyable) return copyable;

    if (el.tagName === 'DIV' && el.getAttribute?.('role') !== 'row') {
      return el;
    }

    return null;
  }

  function getSafeBubbleTarget(bubble, preferredEl) {
    function isDirectRowOrWallpaper(el) {
      if (!el || el.nodeType !== 1) return true;
      if (el.matches?.('[role="row"], #main, #side, [role="region"]')) return true;
      if (el.getAttribute?.('role') === 'row') return true;
      // Direct child of [role="row"] is the full-width flex line wrapper in WhatsApp Web
      if (el.parentElement?.getAttribute?.('role') === 'row' || el.parentElement?.matches?.('[role="row"]')) return true;
      return false;
    }

    // 1. Highest priority: copyable-text container of text
    const copyable = preferredEl?.closest?.('div.copyable-text') ||
      bubble?.querySelector?.('div.copyable-text') ||
      (preferredEl?.classList?.contains('copyable-text') ? preferredEl : null);
    if (copyable && !isDirectRowOrWallpaper(copyable)) {
      return copyable;
    }

    // 2. Selectable text parent inside the bubble
    const selText = preferredEl?.closest?.('.selectable-text') ||
      bubble?.querySelector?.('.selectable-text') ||
      (preferredEl?.classList?.contains('selectable-text') ? preferredEl : null);
    if (selText) {
      const parent = selText.closest('div');
      if (parent && !isDirectRowOrWallpaper(parent) && !parent.closest?.('[data-testid="quoted-message"]')) {
        return parent.parentElement && !isDirectRowOrWallpaper(parent.parentElement) ? parent.parentElement : parent;
      }
    }

    // 3. Inner bubble container inside .message-in or .message-out
    const bubbleRoot = bubble?.matches?.('.message-in, .message-out')
      ? bubble
      : bubble?.closest?.('.message-in, .message-out') || preferredEl?.closest?.('.message-in, .message-out') || bubble?.querySelector?.('.message-in, .message-out');

    if (bubbleRoot) {
      const inner = bubbleRoot.querySelector?.('div.copyable-text') ||
        bubbleRoot.querySelector?.('div._amk4, div[class*="bubble" i]') ||
        bubbleRoot.firstElementChild;
      if (inner && !isDirectRowOrWallpaper(inner)) return inner;
      if (!isDirectRowOrWallpaper(bubbleRoot)) return bubbleRoot;
    }

    return null;
  }

  function isOutgoingRow(el) {
    if (!el) return false;
    const row = el.closest?.('[data-id], [role="row"]') || el;

    // 1. Explicit data-id prefix
    const dataId = getRowId(row) || row.getAttribute?.('data-id') || '';
    if (dataId.startsWith('true_')) return true;
    if (dataId.startsWith('false_')) return false;
    if (dataId.includes('newsletter') || dataId.includes('@newsletter')) return false;

    // 2. Class-based check
    if (row.classList?.contains('message-out') || !!row.querySelector?.('.message-out')) return true;
    if (row.classList?.contains('message-in') || !!row.querySelector?.('.message-in')) return false;

    // 3. WhatsApp checkmarks / read receipt icons (STRICTLY unique to outgoing messages)
    if (row.querySelector?.(
      '[data-icon="msg-dblcheck"], [data-icon="msg-check"], [data-icon="msg-time"], ' +
      '[data-testid*="dblcheck" i], [data-testid*="check" i], [data-testid*="status-time" i], ' +
      '[data-icon="tail-out"], [class*="tail-out" i]'
    )) {
      return true;
    }

    // 4. Tail-in or author display (unique to incoming messages)
    if (row.querySelector?.('[data-icon="tail-in"], [class*="tail-in" i]')) {
      return false;
    }

    // 5. Channel context: if inside a newsletter/channel conversation, broadcast messages are incoming
    const jid = getChatJidFromDOM();
    if (jid && jid.includes('@newsletter')) return false;

    // 6. Geometry fallback: in WhatsApp Web, outgoing bubbles align to the right edge (or left in RTL)
    try {
      const bubble = getMessageBubble(row) || row;
      const main = document.querySelector('#main') || document.body;
      const mainRect = main.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      if (mainRect.width > 400 && bubbleRect.width > 0) {
        const isRTL = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl' || main.getAttribute?.('dir') === 'rtl';
        const distFromRight = mainRect.right - bubbleRect.right;
        const distFromLeft = bubbleRect.left - mainRect.left;
        if (isRTL) {
          if (distFromLeft < distFromRight && distFromLeft < 140) return true;
        } else {
          if (distFromRight < distFromLeft && distFromRight < 140) return true;
        }
      }
    } catch (e) {}

    return false;
  }

  function getIncomingMessageRows() {
    const scope = document.querySelector('#main') || document;
    // Channels use [data-id*="newsletter"], #main div[role="row"], or div[data-testid="msg-container"]
    const sel = autoTranslateMode === 'both'
      ? '.message-in, .message-out, [data-id], #main div[role="row"], div[data-testid="msg-container"]'
      : '.message-in, [data-id^="false_"], [data-id*="newsletter"], #main div[role="row"], div[data-testid="msg-container"]';

    const rawElements = Array.from(scope.querySelectorAll(sel));
    const bubbles = [];
    const seenBubbles = new Set();
    const seenIds = new Set();

    for (const el of rawElements) {
      if (autoTranslateMode !== 'both' && isOutgoingRow(el)) continue;

      const bubble = getMessageBubble(el);
      if (!bubble || bubble.closest('#side')) continue;
      if (seenBubbles.has(bubble)) continue;
      seenBubbles.add(bubble);

      const mid = getRowId(bubble) || getRowId(el) || getMessageId(bubble);
      if (mid && seenIds.has(mid)) continue;
      if (mid) seenIds.add(mid);

      bubbles.push(bubble);
    }

    return bubbles;
  }

  function cleanupStrayTranslationNodes() {
    const allTranslated = document.querySelectorAll('.oat-translated-content, .oat-quote-translated');
    for (const node of allTranslated) {
      const parent = node.parentElement;
      // Direct child of a row or region is an orphaned wallpaper bleed -> delete it!
      if (!parent || parent.getAttribute?.('role') === 'row' || parent.matches?.('[role="row"]')) {
        node.remove();
        continue;
      }
      if (node.closest('#side, [data-testid="chat-list"]')) {
        node.remove();
        continue;
      }
      // Must be inside active message area in #main or message row
      if (!node.closest('#main') && !node.closest('[data-id]')) {
        node.remove();
        continue;
      }
    }

    // Deduplicate: Ensure at most 1 body translation and 1 quote translation per message row
    const scope = document.querySelector('#main') || document;
    const rows = scope.querySelectorAll('[data-id], .message-in, .message-out, #main div[role="row"], div[data-testid="msg-container"]');
    for (const r of rows) {
      const bodies = r.querySelectorAll('.oat-translated-content');
      for (let i = 1; i < bodies.length; i++) bodies[i].remove();
      const quotes = r.querySelectorAll('.oat-quote-translated');
      for (let i = 1; i < quotes.length; i++) quotes[i].remove();
    }
  }

  function restoreSavedTranslation(row) {
    if (!row) return false;
    const bubble = getMessageBubble(row) || row;
    const msgId = getRowId(bubble) || getRowId(row) || getMessageId(bubble);
    if (!msgId || !savedTranslations[msgId]) return false;

    const saved = savedTranslations[msgId];
    if (saved.noop) return true; // Already verified to be in user's language

    let restored = false;

    // 1. Restore Quoted snippet inside quote preview card
    if (saved.quoteTranslation) {
      const quoteData = extractQuoteData(bubble) || extractQuoteData(row);
      if (quoteData?.container) {
        renderQuoteTranslation(quoteData.container, quoteData.textRow, saved.quoteTranslation, saved.quoteOriginal || quoteData.quoteText || '', msgId);
        restored = true;
      }
    }

    // 2. Restore Message body strictly inside the bubble (NEVER on wallpaper)
    if (saved.bodyTranslation) {
      const msgData = getCleanMessageText(bubble) || getCleanMessageText(row);
      const originalText = saved.bodyOriginal || msgData?.replyText || '';
      const existingBody = bubble.querySelector('.oat-translated-content') || (row !== bubble ? row.querySelector('.oat-translated-content') : null);
      if (existingBody) {
        renderFormattedTranslatedText(existingBody, saved.bodyTranslation);
        attachCorrectionAction(existingBody, {
          originalText,
          currentTranslation: saved.bodyTranslation,
          targetLang: myLanguage || 'en',
          msgId,
          isQuote: false
        });
        restored = true;
      } else {
        const targetEl = getSafeBubbleTarget(bubble, msgData?.textEl);
        if (targetEl) {
          const div = document.createElement('div');
          div.className = 'oat-translated-content';
          if (msgData?.isEdited) div.classList.add('oat-has-edited');
          renderFormattedTranslatedText(div, saved.bodyTranslation);
          attachCorrectionAction(div, {
            originalText,
            currentTranslation: saved.bodyTranslation,
            targetLang: myLanguage || 'en',
            msgId,
            isQuote: false
          });
          targetEl.appendChild(div);
          restored = true;
        }
      }
      const extraBodies = bubble.querySelectorAll('.oat-translated-content');
      for (let i = 1; i < extraBodies.length; i++) extraBodies[i].remove();
    }

    return restored;
  }

  function restoreAllVisibleSavedTranslations() {
    cleanupStrayTranslationNodes();
    const rows = getIncomingMessageRows();
    for (const row of rows) {
      restoreSavedTranslation(row);
    }
  }

  // ── Header Title & Chat Tracking ──────────────────────────────────────────

  function getChatJidFromDOM() {
    const rows = document.querySelectorAll('.message-in[data-id], .message-out[data-id], [data-id]');
    for (const r of rows) {
      const dataId = r.getAttribute('data-id') || '';
      // WhatsApp message data-id formats:
      // Regular: (true|false)_(chatJid)_(messageUniqueId)
      // Channels: (chatJid)_(messageUniqueId) or false_(chatJid)_(messageUniqueId)
      const m = dataId.match(/^(?:(?:true|false)_)?([0-9a-zA-Z._-]+@[a-zA-Z0-9._-]+)(?:_|$)/);
      if (m && m[1]) return m[1];
    }
    return null;
  }

  function getConversationHeader() {
    // 1. Explicit #main header (classic WhatsApp Web)
    const mainHeader = document.querySelector('#main header');
    if (mainHeader) return mainHeader;

    const allHeaders = Array.from(document.querySelectorAll('header'));
    if (!allHeaders.length) return null;

    // Filter candidate headers: MUST NOT be the left sidebar header ("Chats", "Archived", new chat)
    const candidates = allHeaders.filter(h => {
      if (h.closest('#side, [data-testid="chat-list"], [data-testid="chat-list-search"]')) return false;
      if (h.querySelector('[data-icon="chat"], [data-icon="new-chat-outline"], [data-icon="filter"]')) return false;
      const t = (h.textContent || '').trim();
      if (isNoiseHeaderTitle(t)) return false;
      return true;
    });

    // If candidate found that is not the first header (headers[0] is always left sidebar), return it
    for (const h of candidates) {
      if (h !== allHeaders[0]) return h;
    }

    // Positional invariant: in WhatsApp Web DOM, headers[0] is sidebar and headers[1] is conversation
    if (allHeaders.length >= 2) return allHeaders[1];
    return null;
  }

  function isValidContactName(t) {
    if (!t || typeof t !== 'string') return false;
    t = t.trim();
    if (t.length < 1 || t.length > 80) return false;
    if (isPresenceText(t)) return false;
    if (isNoiseHeaderTitle(t)) return false;
    return true;
  }

  function isNoiseHeaderTitle(t) {
    if (!t) return true;
    return /^(?:Chats|Archived|Sohbetler|Arşivlenmiş|Чаты|В архиве|Search|Search…|Ara|Поиск|New chat|Yeni sohbet|Новый чат|Communities|Topluluklar|Сообщества|Status|Durum|Статус|Channels|Kanallar|Каналы|Settings|Ayarlar|Настройки|Add to list|Listeye ekle|Contact info|Kişi bilgisi|Данные контакта|Menu|Menü|Меню|Starred messages|Yıldızlı mesajlar|Filter unread chats|Okunmamış sohbetleri filtrele)$/i.test(t.trim());
  }

  function isPresenceText(t) {
    if (!t) return true;
    return /^(?:typing|online|last seen|en ligne|онлайн|печатает|yazıyor|çevrim içi|brouillon|draft)\b/i.test(t.trim());
  }

  function getChatId() {
    const header = getConversationHeader();
    if (header) {
      // 1. Primary span with title attribute on profile button (WhatsApp puts full contact name here)
      const titleSpans = Array.from(header.querySelectorAll('div[role="button"] span[title], span[title]'));
      for (const span of titleSpans) {
        const t = (span.getAttribute('title') || span.textContent || '').trim();
        if (isValidContactName(t)) return t;
      }

      // 2. Explicit data-testid for conversation title
      const explicit = header.querySelector(
        '[data-testid="conversation-info-header-chat-title"] span, ' +
        '[data-testid="chat-title"] span, ' +
        '[data-testid="conversation-info-header"] span[dir="auto"], ' +
        '[data-testid="conversation-info-header"] h2'
      );
      if (explicit) {
        const t = (explicit.getAttribute('title') || explicit.textContent || '').trim();
        if (isValidContactName(t)) return t;
      }

      // 3. Contact header button / primary container
      const titleContainer = header.querySelector('div[role="button"] > div, h2');
      if (titleContainer) {
        const span = titleContainer.querySelector('span[dir="auto"], span');
        if (span) {
          const t = (span.getAttribute('title') || span.textContent || '').trim();
          if (isValidContactName(t)) return t;
        }
      }

      // 4. Any non-noise text span in header
      const allSpans = Array.from(header.querySelectorAll('span[dir="auto"], h2, span'));
      for (const s of allSpans) {
        if (s.closest('button, svg, [data-icon]')) continue;
        const t = (s.getAttribute('title') || s.textContent || '').trim();
        if (isValidContactName(t)) return t;
      }
    }

    // Fallback 1: Selected contact in sidebar chat list
    const activeSidebar = document.querySelector(
      '[aria-selected="true"], [data-active="true"], [data-testid="chat-list"] [aria-selected="true"], #side [aria-selected="true"]'
    );
    if (activeSidebar) {
      const span = activeSidebar.querySelector('span[title], [data-testid="cell-frame-title"] span');
      if (span) {
        const t = (span.getAttribute('title') || span.textContent || '').trim();
        if (isValidContactName(t)) return t;
      }
    }

    // Fallback 2: JID extracted from messages in the current conversation
    const jid = getChatJidFromDOM();
    if (jid) return jid;

    // Fallback 3: Preserve previous valid currentChatId if we're mid-render
    if (currentChatId && currentChatId !== 'default') {
      return currentChatId;
    }

    return 'default';
  }

  function targetLang() {
    const id = getChatId();
    if (id && id !== 'default') {
      if (chatTargetLanguages[id]) return chatTargetLanguages[id];
      const jid = getChatJidFromDOM();
      if (jid && chatTargetLanguages[jid]) return chatTargetLanguages[jid];
    }
    return defaultTargetLanguage || 'tr';
  }

  function setTargetLang(code) {
    const id = getChatId();
    if (id && id !== 'default') {
      chatTargetLanguages[id] = code;
      const jid = getChatJidFromDOM();
      if (jid) chatTargetLanguages[jid] = code;
      chrome.storage.local.set({ chatTargetLanguages });
    } else {
      defaultTargetLanguage = code;
      chrome.storage.local.set({ defaultTargetLanguage });
    }
    refreshBadges();
  }

  function refreshBadges() {
    const code = targetLang().toUpperCase();
    Array.from(document.querySelectorAll('.oat-format-badge, .oat-menu-badge'))
      .forEach(el => { el.textContent = code; });

    const formatBtn = document.querySelector('.oat-format-bar-btn');
    if (formatBtn) {
      formatBtn.title = `Translate input to ${code} (Ctrl+Enter)`;
      formatBtn.setAttribute('aria-label', `Translate input to ${code}`);
    }
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let reloadBannerShown = false;
  function showReloadToast() {
    if (reloadBannerShown || document.querySelector('.oat-reload-banner')) return;
    reloadBannerShown = true;
    const banner = document.createElement('div');
    banner.className = 'oat-reload-banner';
    banner.innerHTML = `
      <div class="oat-reload-text">
        <strong>Omar Tariq's WhatsApp Translator</strong>
        <span>Extension reloaded in browser. Please refresh this tab to reconnect.</span>
      </div>
      <button class="oat-reload-btn" type="button">Refresh Tab</button>
    `;
    banner.querySelector('.oat-reload-btn').addEventListener('click', () => {
      window.location.reload();
    });
    document.body.appendChild(banner);
  }

  async function callTranslate(text, toLang, context = null) {
    try {
      if (!chrome.runtime?.id) {
        showReloadToast();
        console.warn('[OAT] Extension context invalidated. Please refresh the WhatsApp Web page (F5).');
        return { success: false, error: 'Context invalidated' };
      }
      return await chrome.runtime.sendMessage({
        action: 'TRANSLATE_TEXT',
        text,
        targetLang: toLang,
        sourceLang: 'auto',
        context: context || null
      });
    } catch (err) {
      if (err?.message?.includes('Extension context invalidated')) {
        showReloadToast();
        console.warn('[OAT] Extension was reloaded. Please refresh the WhatsApp Web tab (F5).');
      } else {
        console.warn('[OAT] Translation error:', err);
      }
      return { success: false, error: err?.message };
    }
  }

  // ── Noise, Embed & Sender Title Filtering ──────────────────────────────────

  function getNodeTextWithEmojis(root, excludePredicate) {
    if (!root) return '';
    let out = '';

    function walk(node) {
      if (!node) return;
      if (node.nodeType === 1) { // ELEMENT_NODE
        // 1. Direct Emoji Extraction: NEVER exclude an emoji image!
        if (node.tagName === 'IMG') {
          const alt = node.getAttribute('alt') || node.getAttribute('data-plain-text') || node.getAttribute('data-emoji') || '';
          if (alt && !/^[\s]*$/.test(alt)) {
            out += alt;
          }
          return;
        }

        // 2. Line break
        if (node.tagName === 'BR') {
          out += '\n';
          return;
        }

        // 3. Structural pruning: Respect excludePredicate unconditionally for boundaries (quotes, translations, noise)
        if (excludePredicate && excludePredicate(node)) {
          return;
        }

        const isBlock = node !== root && (node.tagName === 'P' || node.tagName === 'DIV');
        if (isBlock && out.length > 0 && !out.endsWith('\n')) {
          out += '\n';
        }

        for (let child = node.firstChild; child; child = child.nextSibling) {
          walk(child);
        }

        if (isBlock && out.length > 0 && !out.endsWith('\n')) {
          out += '\n';
        }
        return;
      } else if (node.nodeType === 3) { // TEXT_NODE
        out += node.nodeValue || '';
        return;
      }

      for (let child = node.firstChild; child; child = child.nextSibling) {
        walk(child);
      }
    }

    walk(root);
    return out;
  }

  function isNoiseElement(el) {
    if (!el) return false;

    // 0. EXPLICIT TIMESTAMP & STATUS CONTAINERS: ALWAYS NOISE!
    if (el.closest?.(
      '[data-testid="msg-meta"], [class*="meta" i], [class*="status-time" i], ' +
      'div._amkd, span._amkd, div._amk6, span._amk6, div._ahyg, span._ahyg'
    )) {
      return true;
    }
    const directTxt = (el.textContent || '').trim();
    if (/^\s*(?:Edited|Düzenlendi|Изменено|معدل[ةه]?\s*)?\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:[AP]M|Ö[SÖ]|ص|م))?\s*$/iu.test(directTxt)) {
      return true;
    }
    if (/^\s*\d{1,2}:\d{2}\s*$/.test(directTxt)) {
      return true;
    }

    // NEVER treat emoji images or line breaks as noise
    if (el.tagName === 'IMG' && (el.hasAttribute('alt') || el.hasAttribute('data-plain-text') || el.classList?.contains('emoji'))) {
      return false;
    }
    if (el.tagName === 'BR') return false;

    // NEVER treat mentions or links inside message text as noise
    if (el.closest('.quoted-mention, [data-testid*="mention" i], [class*="mention" i]') ||
        (el.textContent && /^\s*@(?:~|\p{L}|\p{N})/u.test(el.textContent))) {
      return false;
    }
    if (el.tagName === 'A' || el.closest('a[href]')) {
      return false;
    }

    // Inside selectable message text (span.selectable-text), interactive tags
    // (mentions, contacts, links, numbers) often carry role="button" or tabindex="-1".
    // They are NEVER noise!
    if (el.closest('span.selectable-text, [data-testid="selectable-text"]')) {
      if (el.closest('svg, [data-icon]')) return true;
      return false;
    }

    // Inside a quote preview card, text is the quoted caption or reply text, not player noise
    const inQuote = el.closest('[data-testid="quoted-message"], [class*="quoted" i], div._amv2');

    if (inQuote) {
      // Inside a quote preview card, only exclude SVGs and icon ligature badges
      if (el.closest('svg, [data-icon]')) return true;
      const t = el.textContent?.trim() || '';
      if (!t) return false;
      if (/^ic-[\w-]+$/i.test(t)) return true;
      if (/^tail-(?:in|out)$/i.test(t)) return true;
      if (/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?$/i.test(t)) return true;
      return false; // Do not check buttons or player containers inside quotes!
    }

    // Exclude buttons, SVG icons, sliders, progress bars, audio, video
    if (el.closest('svg, [data-icon], button, [role="button"], [role="slider"], [role="progressbar"], audio, video')) {
      return true;
    }

    // Exclude emoji reaction badge containers / counts (e.g. at bottom of channel messages or chat messages)
    if (el.closest('[data-testid*="reaction" i], [class*="reaction" i], [aria-label*="reaction" i], [aria-label*="реакц" i], [aria-label*="tepki" i]')) {
      return true;
    }

    if (el.closest(
      '[data-testid*="player" i], [data-testid*="audio" i], [data-testid*="video" i], ' +
      '[data-testid*="voice" i], [data-testid*="ptt" i], [data-testid*="sticker" i], ' +
      '[class*="video-thumb" i], [class*="media-play" i], [class*="audio-player" i], [class*="player-" i]'
    )) {
      return true;
    }

    const t = el.textContent?.trim() || '';
    if (!t) return false;

    // 1. Any icon ligature (e.g. ic-play-arrow-filled, ic-videocam-filled, ic-download, ic-check, etc.)
    if (/^ic-[\w-]+$/i.test(t)) return true;

    // 2. Tail markers
    if (/^tail-(?:in|out)$/i.test(t)) return true;

    // 3. Timestamps and durations (e.g. 0:18, 12:45, 4:01 PM)
    if (/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?$/i.test(t)) return true;

    // 4. Timestamps with "Edited" prefix
    if (/^(?:Edited|Düzenlendi|Изменено|معدل[ةه]?\s*)?\d{1,2}:\d{2}(?:\s*[AP]M)?$/i.test(t)) return true;

    // 5. Standalone "Edited" flag
    if (/^(?:Edited|Düzenlendi|Изменено|معدل[ةه]?)$/i.test(t)) return true;

    // 6. File size badges (e.g. 14 MB, 320 kB, 1.2 GB)
    if (/^\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|kB|kb|mb|gb)$/i.test(t)) return true;

    // 7. Playback speeds (1x, 1.5x, 2x)
    if (/^\d(?:\.\d)?x$/i.test(t)) return true;

    // 8. Document pages count
    if (/^\d+\s*(?:pages?|sayfa|страниц[аы]?|صفحات?)$/i.test(t)) return true;

    // 9. Standalone media type placeholders
    if (/^(?:Video|Photo|Audio|Voice message|GIF|Sticker|Document|Resim|Fotoğraf|Ses|Ses kaydı|Видео|Фото|Аудио|Голосовое сообщение|صورة|فيديو|مقطع صوتي|رسالة صوتية)$/i.test(t)) return true;

    return false;
  }

  function isLinkPreviewEmbed(node) {
    if (!node || node.nodeType !== 1) return false;

    // 1. Explicit link preview container markers
    if (node.closest?.(
      '[data-testid*="link-preview" i], [class*="link-preview" i], ' +
      '[data-testid*="rich-link" i], [class*="rich-link" i], ' +
      '[class*="link-card" i], [data-testid*="thumb" i]'
    )) {
      return true;
    }

    // 2. Anchors wrapping rich media cards (thumbnails, videos, play buttons, card layouts)
    const anchor = node.closest?.('a[target="_blank"], a[href]');
    if (anchor) {
      if (anchor.querySelector('img, video, canvas, [data-icon*="play"], [data-icon*="link"], [data-testid*="thumb" i], div, p')) {
        return true;
      }
    }

    return false;
  }

  function isSenderTitle(el) {
    if (!el) return false;

    // Inside message text elements, links, or mentions, it is NEVER a sender title
    if (el.closest('span.selectable-text, .copyable-text span[dir], .quoted-mention, [data-testid*="mention" i], [class*="mention" i]')) {
      return false;
    }

    const t = (el.textContent || '').trim();
    if (!t) return false;

    // Mentions (@~Honda, @User) are never sender headers
    if (/^\s*@/u.test(t)) return false;

    if (/^\+?\d[\d\s\-()]{5,}$/.test(t)) return true;
    if (/^~[\s\p{L}]/u.test(t)) return true;
    if (el.closest('[data-testid*="author" i], [class*="author" i], [class*="header" i], [aria-label*="sender" i]')) {
      return true;
    }
    return false;
  }

  function cleanMetadata(str) {
    if (!str) return '';
    return str
      .replace(/^\+?\d[\d \-()]{5,}\s*~[^\n:]+[: \t]*(?:\r?\n+)?/u, '')
      .replace(/^~[^\n:]+[: \t]*(?:\r?\n+)?/u, '')
      .replace(/^\+?\d[\d \-()]{5,}[: \t]*(?:\r?\n+)?/, '')
      .replace(/^[\p{L}][\p{L} \t._'-]{0,34}:(?:\n+|\s{2,})/u, '')
      .replace(/\bic-[\w-]+(?:\s+ic-[\w-]+)*/gi, '')
      .replace(/\btail-(?:in|out)\b/gi, '')
      // Standalone media / file size placeholders (e.g. "Photo • 1.2 MB", "Document", "Voice message")
      .replace(/^\s*(?:Video|Photo|Audio|Voice message|GIF|Sticker|Document|Resim|Fotoğraf|Ses|Ses kaydı|Видео|Фото|Аудио|Голосовое сообщение|صورة|فيديو|مقطع صوتي|رسالة صوتية)(?:\s*[•·-]\s*.*)?$/gi, '')
      .replace(/[^\S\r\n]*\b(?:Video|Photo|Audio|Document)\b\s*[•·-]\s*\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|kB|kb|mb|gb)[^\S\r\n]*/gi, ' ')
      .replace(/[^\S\r\n]*\b(?:Read more|Daha fazla oku|Читать далее|اقرأ المزيد|Leer más|En savoir plus)\b[^\S\r\n]*/gi, ' ')
      .replace(/[^\S\r\n]*\b\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|kB|kb|mb|gb)\b[^\S\r\n]*/gi, ' ')
      .replace(/[^\S\r\n]*\b\d(?:\.\d)?x\b[^\S\r\n]*/gi, ' ')
      .replace(/[^\S\r\n]*\b(?:Edited|Düzenlendi|Изменено|معدل[ةه]?)\b[^\S\r\n]*/gi, ' ')
      // Trailing timestamp attached to text or at end of bubble (e.g. "Okay6:49 PM", "Okay 18:49", "😭😭4:58")
      .replace(/(?:[\s\n\r]*|\b|\B)\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:[AP]M|Ö[SÖ]|ص|م))?\s*$/iu, '')
      // Standalone duration or time (e.g. "0:14", "6:49 PM", "18:49")
      .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:[AP]M|Ö[SÖ]|ص|م))?\s*$/iu, '')
      .replace(/[^\S\r\n]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^[^\S\r\n]+|[^\S\r\n]+$/gm, '')
      .trim();
  }

  // ── 0b. RICH TRANSLATED CONTENT FORMATTER (LINKS, MENTIONS, PHONES) ───────
  const MENTION_STOPWORDS = new Set([
    'the', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'did', 'do', 'does',
    'will', 'would', 'can', 'could', 'should', 'we', 'you', 'i', 'he', 'she', 'it', 'they',
    'how', 'what', 'where', 'when', 'why', 'who', 'please', 'listen', 'come', 'go', 'let',
    'first', 'second', 'all', 'any', 'my', 'your', 'his', 'her', 'our', 'their', 'in', 'on', 'at'
  ]);

  function refineMentionText(raw) {
    if (!raw || !raw.startsWith('@')) return raw;
    if (raw.startsWith('@~') || /^@\+?\d/.test(raw)) return raw;
    const parenMatch = raw.match(/^(.*?)\s*(\([^)\r\n]+\))$/);
    const namePart = parenMatch ? parenMatch[1] : raw;
    const tagPart = parenMatch ? ' ' + parenMatch[2] : '';
    const words = namePart.slice(1).split(/\s+/);
    const kept = [];
    for (let i = 0; i < words.length && kept.length < 4; i++) {
      const w = words[i];
      if (i > 0 && MENTION_STOPWORDS.has(w.toLowerCase())) break;
      kept.push(w);
    }
    return '@' + kept.join(' ') + tagPart;
  }

  // 1. URLs (full http(s) links OR naked web domains like chess.com, google.com, github.com)
  const URL_TOKEN_REGEX = /(?:https?:\/\/[^\s<>"'{}|\\^`]+(?<![.,;:!?]))|(?:(?<=^|[\s\n\r(\[])(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(?:com|org|net|edu|gov|io|me|ai|co|app|dev|xyz|info|tv|site|online|tech|link|cc|to|us|uk|de|tr|eg|fr|ru|nl|br|in|ly|be|live|store|club|space)(?:\/[^\s<>"'{}|\\^`]*[^\s<>"'{}|\\^`.,;:!?])?)/gi;
  // 2. Mentions (@~handle, @phone, @Name with optional (tag))
  const MENTION_TOKEN_REGEX = /(?:^|(?<=[\s\n\r]))@(?:~[^\r\n,;!?:]+(?:\s*\([^)\r\n]+\))?|\+?\d[\d\s\-]{6,}\d|[a-zA-Z0-9_\u00C0-\u024F]+(?:\s+[a-zA-Z0-9_\u00C0-\u024F]+)*(?:\s*\([^)\r\n]+\))?|[\u0600-\u06FF\u0750-\u077F]+(?:\s+[\u0600-\u06FF\u0750-\u077F]+)*(?:\s*\([^)\r\n]+\))?)(?=$|[\s\n\r,;:!?])/gu;
  // 3. Phone numbers
  const PHONE_TOKEN_REGEX = /(?:^|(?<=[\s\n\r]))\+?\d[\d\s\-()]{6,}\d(?=[\s\r\n,;!?]|$)/g;

  const MASTER_TOKEN_REGEX = new RegExp(
    `(${URL_TOKEN_REGEX.source})|(${MENTION_TOKEN_REGEX.source})|(${PHONE_TOKEN_REGEX.source})`,
    'giu'
  );

  function parseMessageTokens(text) {
    if (!text || typeof text !== 'string') return [];

    const tokens = [];
    let lastIndex = 0;
    let match;

    MASTER_TOKEN_REGEX.lastIndex = 0;
    while ((match = MASTER_TOKEN_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }
      const val = match[0];
      if (match[1]) {
        const href = /^https?:\/\//i.test(val) ? val : `https://${val}`;
        tokens.push({ type: 'link', value: val, url: href });
        lastIndex = MASTER_TOKEN_REGEX.lastIndex;
      } else if (match[2]) {
        const refined = refineMentionText(val.trim());
        tokens.push({ type: 'mention', value: refined });
        const delta = val.length - refined.length;
        lastIndex = MASTER_TOKEN_REGEX.lastIndex - delta;
        MASTER_TOKEN_REGEX.lastIndex = lastIndex;
      } else if (match[3]) {
        tokens.push({ type: 'phone', value: val.trim() });
        lastIndex = MASTER_TOKEN_REGEX.lastIndex;
      }
    }

    if (lastIndex < text.length) {
      tokens.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return tokens;
  }

  function renderFormattedTranslatedText(container, text) {
    if (!container) return;
    container.textContent = ''; // Clear previous child nodes cleanly

    if (!text || typeof text !== 'string') return;

    const tokens = parseMessageTokens(text);
    for (const token of tokens) {
      if (token.type === 'link') {
        const a = document.createElement('a');
        a.className = 'oat-link';
        a.href = token.url;
        a.textContent = token.value;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = token.url;
        // Stop event propagation so clicking the link never triggers WhatsApp row selection
        a.addEventListener('click', e => {
          e.stopPropagation();
        });
        container.appendChild(a);
      } else if (token.type === 'mention') {
        const span = document.createElement('span');
        span.className = 'oat-mention';
        span.textContent = token.value;
        container.appendChild(span);
      } else if (token.type === 'phone') {
        const span = document.createElement('span');
        span.className = 'oat-phone';
        span.textContent = token.value;
        container.appendChild(span);
      } else {
        container.appendChild(document.createTextNode(token.value));
      }
    }
  }

  // ── INLINE REPORT & CORRECTION SYSTEM (USER TRANSLATION MEMORY) ─────────────

  function attachCorrectionAction(container, opts = {}) {
    if (!container) return;
    if (opts.originalText) container.dataset.originalText = opts.originalText;
    if (opts.currentTranslation) container.dataset.currentTranslation = opts.currentTranslation;
    if (opts.targetLang) container.dataset.targetLang = opts.targetLang;
    if (opts.msgId) container.dataset.msgId = opts.msgId;
    container.dataset.isQuote = opts.isQuote ? 'true' : 'false';

    let btn = container.querySelector(':scope > .oat-edit-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'oat-edit-btn';
      btn.setAttribute('type', 'button');
      btn.setAttribute('title', 'Report or correct translation');
      btn.setAttribute('aria-label', 'Report or correct translation');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        openCorrectionModal({
          sourceText: container.dataset.originalText || '',
          currentTranslation: container.dataset.currentTranslation || container.textContent || '',
          targetLang: container.dataset.targetLang || myLanguage || 'en',
          msgId: container.dataset.msgId || null,
          isQuote: container.dataset.isQuote === 'true',
          containerEl: container
        });
      });
      container.appendChild(btn);
    }
  }

  function openCorrectionModal({ sourceText, currentTranslation, targetLang, msgId, isQuote, containerEl }) {
    const existing = document.querySelector('.oat-correction-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'oat-correction-overlay';

    const modal = document.createElement('div');
    modal.className = 'oat-correction-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const languages = [
      { code: 'en', name: 'English' },
      { code: 'ar', name: 'Arabic' },
      { code: 'tr', name: 'Turkish' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'ru', name: 'Russian' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'zh-CN', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'hi', name: 'Hindi' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' }
    ];

    modal.innerHTML = `
      <div class="oat-modal-header">
        <div class="oat-modal-title">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19.36 2.72l1.42 1.42-3.18 3.18-1.42-1.42 3.18-3.18zm-8.86 4.34l-5.3 5.3c-.39.39-.39 1.02 0 1.41l3.54 3.54c.39.39 1.02.39 1.41 0l5.3-5.3-4.95-4.95zm8.56 1.42l-1.42-1.42-2.12 2.12 1.42 1.42 2.12-2.12zm-3.54 3.54l-1.42-1.42-1.41 1.41 1.42 1.42 1.41-1.41zM3 21h18v2H3v-2z"/>
          </svg>
          <span>Report & Correct Translation</span>
        </div>
        <button class="oat-modal-close" aria-label="Close" type="button">✕</button>
      </div>
      <div class="oat-modal-body">
        <div class="oat-form-group">
          <label class="oat-form-label">Original Message / Phrase</label>
          <div class="oat-source-preview">${escapeHtml(sourceText || '')}</div>
        </div>
        <div class="oat-form-row oat-lang-row">
          <div class="oat-form-group oat-half">
            <label class="oat-form-label">From Language</label>
            <select class="oat-select" id="oat-corr-from-lang">
              <option value="auto">Auto Detect</option>
              ${languages.map(l => `<option value="${l.code}">${l.name}</option>`).join('')}
            </select>
          </div>
          <div class="oat-form-group oat-half">
            <label class="oat-form-label">To Language</label>
            <select class="oat-select" id="oat-corr-to-lang">
              ${languages.map(l => `<option value="${l.code}" ${l.code === (targetLang || 'en') ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="oat-form-group">
          <label class="oat-form-label">Preferred / Correct Translation</label>
          <textarea class="oat-textarea" id="oat-corr-target" rows="3" placeholder="Type how this should be translated..."></textarea>
        </div>
        <div class="oat-modal-feedback" id="oat-modal-feedback"></div>
      </div>
      <div class="oat-modal-footer">
        <button class="oat-btn oat-btn-cancel" type="button">Cancel</button>
        <button class="oat-btn oat-btn-save" type="button">Save & Apply</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const textarea = modal.querySelector('#oat-corr-target');
    textarea.value = currentTranslation || '';
    textarea.focus();
    textarea.select();

    const closeModal = () => {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 120);
    };

    modal.querySelector('.oat-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.oat-btn-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });

    const handleSave = () => {
      const preferred = textarea.value.trim();
      const feedback = modal.querySelector('#oat-modal-feedback');
      if (!preferred) {
        feedback.textContent = 'Please enter the preferred translation.';
        feedback.className = 'oat-modal-feedback oat-error';
        return;
      }

      const fromLang = modal.querySelector('#oat-corr-from-lang').value;
      const toLang = modal.querySelector('#oat-corr-to-lang').value;

      // 1. Instantly update the clicked message bubble in the DOM
      if (containerEl) {
        renderFormattedTranslatedText(containerEl, preferred);
        attachCorrectionAction(containerEl, {
          originalText: sourceText,
          currentTranslation: preferred,
          targetLang: toLang,
          msgId,
          isQuote
        });
      }

      // 2. Update all other visible translated elements with matching source text
      if (sourceText) {
        const cleanSrc = sourceText.trim().toLowerCase();
        const allTransNodes = document.querySelectorAll('.oat-translated-content, .oat-quote-translated');
        for (const node of allTransNodes) {
          if (node !== containerEl && (node.dataset.originalText || '').trim().toLowerCase() === cleanSrc) {
            renderFormattedTranslatedText(node, preferred);
            attachCorrectionAction(node, {
              originalText: sourceText,
              currentTranslation: preferred,
              targetLang: toLang,
              msgId: node.dataset.msgId,
              isQuote: node.dataset.isQuote === 'true'
            });
          }
        }
      }

      // 3. Update savedTranslations in storage
      if (msgId && savedTranslations[msgId]) {
        if (isQuote) {
          savedTranslations[msgId].quoteTranslation = preferred;
        } else {
          savedTranslations[msgId].bodyTranslation = preferred;
        }
        chrome.storage.local.set({ savedTranslations });
      }

      // 4. Save to userCustomCorrections via background worker
      chrome.runtime.sendMessage({
        action: 'SAVE_USER_CORRECTION',
        correction: {
          sourceText: sourceText.trim(),
          targetText: preferred,
          sourceLang: fromLang,
          targetLang: toLang
        }
      }, resp => {
        if (resp && resp.success) {
          showToast('✓ Translation corrected & saved to dictionary!');
        }
      });

      closeModal();
    };

    modal.querySelector('.oat-btn-save').addEventListener('click', handleSave);
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let toastTimer = null;
  function showToast(msg) {
    let toast = document.querySelector('.oat-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'oat-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }

  // ── 1. INPUT BOX FULL SELECTION & ZERO-DUPLICATION REPLACEMENT ─────────────

  function getChatInputBox() {
    const active = document.activeElement;
    if (active) {
      if (active.isContentEditable || active.getAttribute('contenteditable') === 'true') {
        if (!active.closest('#side, [data-testid="chat-list-search"]')) {
          return active;
        }
      }
      const editableParent = active.closest('[contenteditable="true"]');
      if (editableParent && !editableParent.closest('#side, [data-testid="chat-list-search"]')) {
        return editableParent;
      }
    }

    const inMain = document.querySelector(
      '#main [contenteditable="true"][role="textbox"], ' +
      '#main [contenteditable="true"][data-tab], ' +
      '#main footer [contenteditable="true"], ' +
      'footer [contenteditable="true"], ' +
      '#main [contenteditable="true"]'
    );
    if (inMain) return inMain;

    const allEditables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
    for (const el of allEditables) {
      if (!el.closest('#side, [data-testid="chat-list-search"]')) {
        return el;
      }
    }

    return null;
  }

  function isInputActive(input) {
    if (!input) return false;
    const active = document.activeElement;
    return active === input || input.contains(active) || (active && active.isContentEditable && !active.closest('#side'));
  }

  function replaceInputContent(input, newText) {
    if (!input) return;
    input.focus();

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(input);
      sel.addRange(range);
    }

    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      keyCode: 65,
      which: 65,
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }));

    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, newText);

    const cleanCurrent = (input.innerText || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const cleanTarget = newText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

    if (cleanCurrent !== cleanTarget) {
      if (newText.includes('\n')) {
        input.innerHTML = '';
        const lines = newText.split('\n');
        for (const line of lines) {
          const p = document.createElement('p');
          p.className = 'selectable-text copyable-text';
          if (line) {
            p.textContent = line;
          } else {
            p.appendChild(document.createElement('br'));
          }
          input.appendChild(p);
        }
      } else {
        const p = input.querySelector('p') || input;
        p.textContent = newText;
      }

      if (sel) {
        sel.removeAllRanges();
        const endRange = document.createRange();
        endRange.selectNodeContents(input);
        endRange.collapse(false);
        sel.addRange(endRange);
      }
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── 2. ROBUST MESSAGE & QUOTE EXTRACTION ──────────────────────────────────

  /**
   * Cleans raw quoted message text by stripping invisible Unicode directional marks,
   * author headers (e.g. "You", "~ Contact", "+PhoneNumber"), and trailing metadata.
   * If the quote has no text (e.g. quoted voice note, sticker, media), returns empty string ''.
   */
  function cleanQuoteText(rawQuote, authorText = '') {
    if (!rawQuote) return '';
    let s = rawQuote.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();

    // Strip known authorText prefix if present
    if (authorText) {
      const cleanAuthor = authorText.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
      if (cleanAuthor) {
        const esc = cleanAuthor.replace(/[.*+?^()|[\]\\\/]/g, '\\$&');
        s = s.replace(new RegExp('^(?:[\\s\\n-]*' + esc + '[:\\s\\n-]*)+', 'iu'), '');
      }
    }

    // Strip standard WhatsApp author headers (Do NOT let phone regex swallow newlines across lines!)
    s = s
      .replace(/^(?:You|Sen|Вы|أنت|Du|Tú|Vous|Lei|Voce|Você|Ty)\b[: \t-]*(?:\r?\n+)?/iu, '')
      .replace(/^~[^\n:]+[: \t-]*(?:\r?\n+)?/u, '')
      .replace(/^\+?\d[\d \-()]{5,}\d[: \t-]*(?:\r?\n+)?/u, '')
      .replace(/^@[\w.-]+[: \t-]*(?:\r?\n+)?/u, '')
      .replace(/^[\p{L}][\p{L} \t._'-]{0,34}:(?:\n+|\s{2,})/u, '');

    // Check first line if multiple lines
    const lines = s.split('\n');
    if (lines.length > 1) {
      const first = lines[0].replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
      if ((authorText && first.toLowerCase() === authorText.toLowerCase()) ||
          /^(?:You|Sen|Вы|أنت|Du|Tú|Vous|Lei|Voce|Você|Ty)$/i.test(first) ||
          /^~[\s\p{L}]/u.test(first) ||
          /^\+?\d[\d \-()]{5,}$/.test(first) ||
          /^@[\w.-]+$/.test(first)) {
        lines.shift();
        s = lines.join('\n').trim();
      }
    }

    // Clean metadata & trailing timestamps
    s = cleanMetadata(s);

    // Final validation: If s is empty, or only duration/number, or media placeholder, or pure contact name
    if (!s ||
        /^\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:[AP]M|Ö[SÖ]|ص|م))?|\d+)\s*$/iu.test(s) ||
        /^(?:Video|Photo|Audio|Voice message|GIF|Sticker|Document|Resim|Fotoğraf|Ses|Ses kaydı|Видео|Фото|Аудио|Голосовое сообщение|صورة|فيديو|مقطع صوتي|رسالة صوتية)$/i.test(s) ||
        /^(?:You|Sen|Вы|أنت|Du|Tú|Vous|Lei|Voce|Você|Ty)$/i.test(s) ||
        /^~[\s\p{L}]+$/u.test(s) ||
        /^\+?\d[\d \-()]{5,}$/.test(s)) {
      return '';
    }

    return s;
  }

  function findQuoteContainer(row) {
    if (!row) return null;

    // Search root: look in the row or row container so sibling quote cards are found even if row is copyable-text
    const searchRoot = row.closest?.('[data-id], [role="row"], .message-in, .message-out') || row;

    // 1. Explicit quote marker across all WhatsApp Web versions (classic + modern minified builds)
    const explicit = searchRoot.querySelector(
      '[data-testid="quoted-message"], [class*="quoted" i], div._amv2, [class*="_amv2"], ' +
      '[class*="_amv1"], [class*="_ak8l"], [aria-label*="quoted" i], [aria-label*="цитируем" i], ' +
      '[aria-label*="ответ на" i], [aria-label*="alıntılanan" i], [aria-label*="en réponse à" i]'
    );
    if (explicit && !explicit.classList.contains('oat-translated-content') && !explicit.classList.contains('oat-quote-translated')) {
      return explicit;
    }

    // 2. Clickable quote preview button inside copyable-text or bubble (WhatsApp quote cards have tabindex="-1")
    const quoteBtn = searchRoot.querySelector(
      'div.copyable-text div[role="button"][tabindex="-1"], ' +
      'div.copyable-text div[tabindex="-1"], ' +
      'div[role="button"][tabindex="-1"]:has(span[dir]), ' +
      'div._amk4 div[role="button"][tabindex="-1"], ' +
      'div._amk4 div[tabindex="-1"]'
    );
    if (quoteBtn && !quoteBtn.closest('button, [aria-label="React"], .oat-hover-translate-btn') &&
        !quoteBtn.classList.contains('oat-translated-content') && !quoteBtn.classList.contains('oat-quote-translated') &&
        !quoteBtn.classList.contains('copyable-text')) {
      return quoteBtn;
    }

    // 3. Semantic author / quote header search:
    // Every quote preview card contains an author tag: "You", "~ Contact", or "+Phone"
    const allSpans = searchRoot.querySelectorAll('span, div[dir="auto"], strong, b');
    for (const cand of allSpans) {
      if (cand.closest?.('.oat-translated-content, .oat-quote-translated, .oat-hover-translate-btn, [data-testid="msg-meta"]')) continue;
      const clean = (cand.textContent || '').replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
      const isAuthor = /^(?:You|Sen|Вы|أنت|Du|Tú|Vous|Lei|Voce|Você|Ty)$/i.test(clean) ||
                       /^~[\s\p{L}]/u.test(clean) ||
                       /^\+?\d[\d \-()]{6,}$/.test(clean) ||
                       cand.classList.contains('quoted-mention') ||
                       cand.getAttribute('data-testid')?.includes('quoted-mention') ||
                       cand.getAttribute('data-testid')?.includes('author') ||
                       cand.classList.contains('_amv9');
      if (isAuthor) {
        // Find enclosing card
        let card = cand.closest?.('div[tabindex="-1"], div[role="button"], div[class*="_amv"], div[class*="_ak8"], [data-testid="quoted-message"]');
        if (!card) {
          const copyable = searchRoot.querySelector('div.copyable-text') || searchRoot;
          let cur = cand;
          while (cur && cur.parentElement && cur.parentElement !== copyable && cur.parentElement !== searchRoot) {
            cur = cur.parentElement;
          }
          card = cur;
        }
        if (card && card !== searchRoot && !card.classList.contains('copyable-text') &&
            !card.classList.contains('oat-translated-content') && !card.classList.contains('oat-quote-translated')) {
          return card;
        }
      }
    }

    // 4. Multi-child copyable-text check: if copyable-text has >= 2 children, child 0 is the quote preview
    const copyable = searchRoot.querySelector('div.copyable-text');
    if (copyable && copyable.children.length >= 2) {
      const firstChild = copyable.children[0];
      if (firstChild && !firstChild.classList.contains('oat-translated-content') && !firstChild.classList.contains('oat-quote-translated')) {
        const firstTxt = (firstChild.textContent || '').replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
        if (firstTxt.length > 0 && (
            /^(?:You|Sen|Вы|أنت|Du|Tú|Vous|Lei|Voce|Você|Ty)\b/i.test(firstTxt) ||
            /^~[\s\p{L}]/u.test(firstTxt) ||
            /^\+?\d[\d \-()]{6,}/.test(firstTxt) ||
            firstChild.querySelector('svg, audio, [data-icon], [tabindex="-1"], span.quoted-mention')
        )) {
          return firstChild;
        }
      }
    }

    return null;
  }

  function renderQuoteTranslation(container, textRow, translation, quoteText = '', msgId = null) {
    if (!container || !translation) return;

    // Safety clean: ensure no leading username/handle/phone number leaked into the translation
    let cleanTrans = translation.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim()
      .replace(/^(?:You|Sen|Вы|أنت|Du|Tú|Vous|Lei|Voce|Você|Ty)[: \t-]*(?:\r?\n+)?/iu, '')
      .replace(/^~[^\n:]+[: \t-]*(?:\r?\n+)?/u, '')
      .replace(/^\+?\d[\d \-()]{5,}\d[: \t-]*(?:\r?\n+)?/u, '')
      .replace(/^@[\w.-]+[: \t-]*(?:\r?\n+)?/u, '')
      .replace(/^[\p{L}\p{N} \t._'-]{1,35}:(?:\n+|\s{2,})/u, '')
      .trim();

    if (!cleanTrans) return;

    let qDiv = container.querySelector('.oat-quote-translated');
    if (!qDiv) {
      qDiv = document.createElement('div');
      qDiv.className = 'oat-quote-translated';
    }
    renderFormattedTranslatedText(qDiv, cleanTrans);
    attachCorrectionAction(qDiv, {
      originalText: quoteText || cleanTrans,
      currentTranslation: cleanTrans,
      targetLang: myLanguage || 'en',
      msgId,
      isQuote: true
    });

    // Find the text column inside the quote container
    const textColumn = container.querySelector('div._amv3, div:has(> span[dir]), div:has(> span), div:has(> p)') ||
      container.firstElementChild ||
      container;

    if (textRow && textRow.parentElement && container.contains(textRow) && textRow !== container) {
      textRow.after(qDiv);
    } else if (textColumn && textColumn !== container) {
      textColumn.appendChild(qDiv);
    } else {
      container.appendChild(qDiv);
    }

    const allQ = container.querySelectorAll('.oat-quote-translated');
    for (let i = 1; i < allQ.length; i++) allQ[i].remove();
  }

  function extractQuoteData(row) {
    if (!row) return null;

    const container = findQuoteContainer(row);
    if (!container) return null;

    // Detect if this quote is a voice message / audio note quote (no text caption)
    const isVoiceQuote = !!container.querySelector(
      'audio, [data-testid*="audio" i], [data-testid*="voice" i], [data-testid*="ptt" i], ' +
      '[data-icon*="audio" i], [data-icon*="ptt" i], [data-icon*="mic" i], ' +
      '[aria-label*="voice message" i], [aria-label*="audio" i], [aria-label*="sesli" i]'
    );

    // 1. Identify author element (e.g. "You", contact name, phone number, ~handle) to exclude from translation
    let authorEl = container.querySelector(
      '[data-testid*="author" i], [class*="author" i], [class*="header" i], [aria-label*="sender" i], ' +
      'span.quoted-mention, [data-testid*="quoted-mention" i], [class*="quoted-mention" i], ' +
      'div._amv9, div._amv8, span._amva, span._amv9, strong, b'
    );

    // In WhatsApp's quote card, the card box has a text column where child 0 is the author header
    const cardBox = container.querySelector('div._amv3, div:has(> span[dir]), div:has(> p), div:has(> div)') || container;
    if (!authorEl && cardBox && cardBox.children.length >= 2) {
      authorEl = cardBox.children[0];
    }

    if (!authorEl) {
      const candidates = container.querySelectorAll('span, div');
      for (const cand of candidates) {
        const txt = (cand.textContent || '').replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
        if (/^~[\s\p{L}]/u.test(txt) || /^\+?\d[\d \-()]{5,}$/.test(txt) || /^@[\w.-]+/.test(txt) || /^(?:You|Sen|Вы|أنت|Du|Tú|Vous|Lei|Voce|Você|Ty)$/i.test(txt)) {
          authorEl = cand.parentElement || cand;
          break;
        }
      }
    }
    const rawAuthor = authorEl ? (authorEl.textContent || '') : '';
    const authorText = rawAuthor.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();

    // Voice note quotes have NO text to translate: return container so quote is excluded from body, but quoteText is empty!
    if (isVoiceQuote) {
      return { container, textRow: null, quoteText: '' };
    }

    // 2. Identify the quoted body text row to anchor the translation directly AFTER it
    const allSpans = Array.from(container.querySelectorAll('span[dir], span.selectable-text, div[dir], span, p'));
    const textSpan = allSpans.find(s => {
      if (authorEl && (s === authorEl || authorEl.contains(s))) return false;
      if (s.matches?.('.oat-quote-translated, .oat-translated-content, svg, [data-icon]')) return false;
      if (s.closest?.('.oat-quote-translated, .oat-translated-content, svg, [data-icon]')) return false;
      if (authorEl && s.closest?.('[data-testid*="author" i], [class*="author" i], [class*="header" i], .quoted-mention, div._amv9, div._amv8')) return false;
      return (s.textContent || '').replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim().length > 0;
    });

    let textRow = null;
    if (textSpan) {
      let cur = textSpan;
      while (cur && cur.parentElement && cur.parentElement !== container) {
        if (authorEl && cur.parentElement.contains(authorEl)) {
          textRow = cur;
          break;
        }
        cur = cur.parentElement;
      }
      if (!textRow || textRow === container || textRow.parentElement === container) {
        textRow = textSpan.parentElement || textSpan;
      }
    } else if (cardBox && cardBox.children.length >= 2) {
      textRow = cardBox.children[1];
    }

    function isQuoteExcluded(node) {
      if (node.nodeType !== 1) return false;
      if (node.matches?.('.oat-quote-translated, .oat-translated-content, svg, [data-icon]')) return true;
      if (node.closest?.('.oat-quote-translated, .oat-translated-content, svg, [data-icon]')) return true;
      if (authorEl && (authorEl === node || authorEl.contains(node))) return true;
      return false;
    }

    // 3. Extract quoted body text strictly targeting textRow/textSpan so author is excluded
    let rawQuoteText = '';
    if (textRow && textRow !== container && (!authorEl || !textRow.contains(authorEl))) {
      rawQuoteText = getNodeTextWithEmojis(textRow, isQuoteExcluded);
    }
    if (!rawQuoteText.trim() && textSpan && (!authorEl || !authorEl.contains(textSpan))) {
      rawQuoteText = getNodeTextWithEmojis(textSpan, isQuoteExcluded);
    }
    if (!rawQuoteText.trim()) {
      rawQuoteText = getNodeTextWithEmojis(container, isQuoteExcluded);
    }

    const quoteText = cleanQuoteText(rawQuoteText, authorText);

    // If quoteText cleaned down to empty (e.g. only duration or media placeholder):
    // Still return container so the quote is excluded from the message body!
    if (!quoteText) {
      return { container, textRow: null, quoteText: '' };
    }

    return { container, textRow, quoteText };
  }

  function getCleanMessageText(row) {
    if (!row) return null;

    // Detect if this bubble is a pure voice message or audio recording (waveform/player with no text caption)
    const hasAudio = !!row.querySelector(
      'audio, [data-testid*="audio" i], [data-testid*="voice" i], [data-testid*="ptt" i], ' +
      '[data-icon="audio-play"], [data-icon="ptt-play"], [data-icon="audio-pause"], [data-icon="ptt-pause"], ' +
      '[aria-label*="voice message" i], [aria-label*="sesli mesaj" i], [aria-label*="голосовое" i], [aria-label*="رسالة صوتية" i]'
    );
    if (hasAudio) {
      const bodySpanCheck = row.querySelector('span.selectable-text, [data-testid="selectable-text"]');
      const bodyTxt = (bodySpanCheck?.textContent || '').trim();
      if (!bodySpanCheck || !bodyTxt || /^\d{1,2}:\d{2}$/.test(bodyTxt)) {
        return null; // Pure voice message has NO text: never translate voice message timestamps/durations!
      }
    }

    const isEdited = /\b(?:Edited|Düzenlendi|Изменено|معدل[ةه]?)\b/i.test(row.textContent || '');

    const quoteData = extractQuoteData(row);
    const quoteContainer = quoteData?.container || null;
    const textRow = quoteData?.textRow || null;
    const innerCard = quoteContainer;
    const quoteText = quoteData?.quoteText || '';

    function shouldExcludeNode(node) {
      if (node.nodeType !== 1) return false;
      if (quoteContainer && (quoteContainer === node || quoteContainer.contains(node))) return true;
      if (node.matches?.('.oat-translated-content, .oat-quote-translated, .oat-hover-translate-btn')) return true;
      if (node.closest?.('.oat-translated-content, .oat-quote-translated, .oat-hover-translate-btn')) return true;
      // Timestamp & metadata containers
      if (node.closest?.(
        '[data-testid="msg-meta"], div[class*="meta" i], span[data-icon], ' +
        'div._amkd, span._amkd, div._amk6, span._amk6, div._ahyg, span._ahyg'
      )) return true;
      const txt = (node.textContent || '').trim();
      if (/^\s*(?:Edited|Düzenlendi|Изменено|معدل[ةه]?\s*)?\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:[AP]M|Ö[SÖ]|ص|م))?\s*$/iu.test(txt)) return true;
      if (/^\s*\d{1,2}:\d{2}\s*$/.test(txt)) return true;
      if (isNoiseElement(node)) return true;
      if (isSenderTitle(node)) return true;
      if (isLinkPreviewEmbed(node)) return true;
      return false;
    }

    let rawText = '';
    let textEl = null;

    // 1. WhatsApp puts message body text strictly in span.selectable-text
    // CRITICAL: We select the body text element that is OUTSIDE any quote container
    const candidateBodySpans = Array.from(row.querySelectorAll(
      'span.selectable-text, div.copyable-text > div span[dir], div.copyable-text > span[dir], .copyable-text span.selectable-text'
    )).filter(el => !shouldExcludeNode(el) && (!quoteContainer || !quoteContainer.contains(el)));

    const bodySpan = candidateBodySpans[0] || null;

    if (bodySpan) {
      // Walk strictly inside candidateBodySpans so the timestamp sibling outside is NEVER touched!
      rawText = candidateBodySpans
        .map(span => getNodeTextWithEmojis(span, shouldExcludeNode))
        .filter(t => t && t.trim())
        .join('\n');
      textEl = getSafeBubbleTarget(row, bodySpan);
    } else {
      // Fallback: Check copyable-text directly if selectable-text wasn't matched
      const copyable = row.querySelector('div.copyable-text');
      if (copyable && !shouldExcludeNode(copyable)) {
        rawText = getNodeTextWithEmojis(copyable, shouldExcludeNode);
        textEl = getSafeBubbleTarget(row, copyable);
      }
    }

    // 2. Fallback: Search candidate text spans/divs in the row if neither was present
    if (!rawText.trim()) {
      const candidates = Array.from(row.querySelectorAll('span[dir], p, div[dir]'))
        .filter(el => !shouldExcludeNode(el) && (!quoteContainer || !quoteContainer.contains(el)));
      for (const cand of candidates) {
        const txt = (cand.textContent || '').trim();
        if (txt.length > 0 && !isNoiseElement(cand)) {
          const containerParent = cand.closest?.('div._amk4, div[class*="bubble" i], div[data-testid="msg-container"]') || cand;
          rawText = getNodeTextWithEmojis(containerParent, shouldExcludeNode);
          if (rawText.trim()) {
            textEl = getSafeBubbleTarget(row, containerParent);
            break;
          }
        }
      }
    }

    // 3. Fallback for link-preview-only messages: if message contains NO body text, allow translating link preview title
    if (!rawText.trim()) {
      const linkPreviewTitle = row.querySelector(
        '[data-testid*="link-preview" i] span[dir], [class*="link-preview" i] span[dir], ' +
        'a[target="_blank"]:has(img) span[dir], a[href]:has(img) span[dir]'
      );
      if (linkPreviewTitle && !quoteContainer?.contains(linkPreviewTitle)) {
        rawText = (linkPreviewTitle.textContent || '').trim();
        textEl = getSafeBubbleTarget(row, linkPreviewTitle);
      }
    }

    // 4. Inner bubble fallback (STRICTLY inside message bubble, never outer row or wallpaper)
    if (!rawText.trim()) {
      const safe = getSafeBubbleTarget(row, null);
      if (safe && !shouldExcludeNode(safe)) {
        rawText = getNodeTextWithEmojis(safe, shouldExcludeNode);
        textEl = safe;
      }
    }

    let replyText = cleanMetadata(rawText);
    if (quoteText && replyText.includes(quoteText)) {
      replyText = replyText.replace(quoteText, '').trim();
    }
    // Safety: Strip any quoted author headers that might have leaked into replyText
    replyText = replyText
      .replace(/^(?:You|Sen|Вы|أنت|Du|Tú|Vous|Lei|Voce|Você|Ty)\b[: \t-]*(?:\r?\n+)?/iu, '')
      .replace(/^~[^\n:]+[: \t-]*(?:\r?\n+)?/u, '')
      .replace(/^\+?\d[\d \-()]{5,}\d[: \t-]*(?:\r?\n+)?/u, '')
      .trim();
    replyText = cleanMetadata(replyText);

    // If replyText is empty or just a timestamp or duration, do NOT translate!
    if (!replyText || !replyText.trim() || /^\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:[AP]M|Ö[SÖ]|ص|م))?$/iu.test(replyText.trim())) {
      replyText = '';
    }

    if (!replyText && !quoteText) return null;

    return { textEl, container: quoteContainer, textRow, innerCard, quoteContainer, replyText, quoteText, isEdited };
  }

  // ── SURROUNDING CONVERSATION CONTEXT EXTRACTION ────────────────────────────

  /**
   * Fast C++ DOM sibling pointer traversal (<0.05ms) to capture preceding
   * and subsequent messages, chat topic/contact name, and active replied-to quote.
   */
  function extractSurroundingChatContext(row, quoteText = '') {
    if (!row) return null;

    const rowContainer = row.closest?.('[data-id], [role="row"], .message-in, .message-out') || row;
    const parts = [];

    // 0. Active chat contact / group title
    const chatTitleEl = document.querySelector('#main header span[dir="auto"][title], #main header [data-testid="conversation-info-header-chat-title"], #main header span[title]');
    const chatTitle = chatTitleEl?.getAttribute('title') || chatTitleEl?.textContent?.trim();
    if (chatTitle) {
      parts.push(`Active Chat: "${chatTitle}"`);
    }

    // 1. Quoted message directly replied to (highest signal in WhatsApp chats)
    if (quoteText && typeof quoteText === 'string' && quoteText.trim()) {
      const cleanQuote = quoteText.trim();
      const quoteSnippet = cleanQuote.length > 180 ? cleanQuote.slice(0, 180) + '…' : cleanQuote;
      parts.push(`In direct reply to quote:\n"${quoteSnippet}"`);
    }

    // 2. Preceding messages (up to 5 previous turns)
    const beforeSnippets = [];
    let prev = rowContainer.previousElementSibling;
    let prevCount = 0;
    while (prev && prevCount < 5) {
      // Exclude system notices, encryption announcements, and date badges
      const isSystemOrDate = prev.querySelector?.('[data-testid="chat-history-synced"], [data-testid="system-message-text"], [data-testid="date-badge"]') ||
        (prev.textContent || '').includes('Messages and calls are end-to-end encrypted');

      const textNode = prev.querySelector?.('span.selectable-text, div.copyable-text > div span[dir], div.copyable-text, span[dir]');
      if (textNode && !isSystemOrDate) {
        const text = cleanMetadata(getNodeTextWithEmojis(textNode, n => {
          if (n.nodeType !== 1) return false;
          if (n.matches?.('.oat-translated-content, .oat-quote-translated, .oat-hover-translate-btn')) return true;
          if (n.closest?.('.oat-translated-content, .oat-quote-translated, .oat-hover-translate-btn')) return true;
          if (isNoiseElement(n) || isSenderTitle(n) || isLinkPreviewEmbed(n)) return true;
          return false;
        })).trim();

        if (text && text.length > 0) {
          const isMe = isOutgoingRow(prev);
          const speaker = isMe ? 'Me' : 'Other';
          const snippet = text.length > 140 ? text.slice(0, 140) + '…' : text;
          beforeSnippets.unshift(`${speaker}: "${snippet}"`);
          prevCount++;
        }
      }
      prev = prev.previousElementSibling;
    }

    if (beforeSnippets.length > 0) {
      parts.push(`Recent dialogue before this message:\n${beforeSnippets.join('\n')}`);
    }

    // 3. Sender perspective
    const isTargetMe = isOutgoingRow(row);
    parts.push(`Target Message Sender: ${isTargetMe ? 'Me (outgoing to friend)' : 'Other (incoming from friend)'}`);

    // 4. Subsequent messages (up to 3 turns that followed in conversation)
    const afterSnippets = [];
    let next = rowContainer.nextElementSibling;
    let nextCount = 0;
    while (next && nextCount < 3) {
      const isSystemOrDate = next.querySelector?.('[data-testid="chat-history-synced"], [data-testid="system-message-text"], [data-testid="date-badge"]') ||
        (next.textContent || '').includes('Messages and calls are end-to-end encrypted');

      const textNode = next.querySelector?.('span.selectable-text, div.copyable-text > div span[dir], div.copyable-text, span[dir]');
      if (textNode && !isSystemOrDate) {
        const text = cleanMetadata(getNodeTextWithEmojis(textNode, n => {
          if (n.nodeType !== 1) return false;
          if (n.matches?.('.oat-translated-content, .oat-quote-translated, .oat-hover-translate-btn')) return true;
          if (n.closest?.('.oat-translated-content, .oat-quote-translated, .oat-hover-translate-btn')) return true;
          if (isNoiseElement(n) || isSenderTitle(n) || isLinkPreviewEmbed(n)) return true;
          return false;
        })).trim();

        if (text && text.length > 0) {
          const isMe = isOutgoingRow(next);
          const speaker = isMe ? 'Me' : 'Other';
          const snippet = text.length > 140 ? text.slice(0, 140) + '…' : text;
          afterSnippets.push(`${speaker}: "${snippet}"`);
          nextCount++;
        }
      }
      next = next.nextElementSibling;
    }

    if (afterSnippets.length > 0) {
      parts.push(`Dialogue that followed after this message:\n${afterSnippets.join('\n')}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  /**
   * Pulls active chat title, active reply card, and last 5 messages of conversation
   * to pass as context when translating the input box via Ctrl+Enter or format bar button.
   */
  function extractActiveChatRecentContext() {
    const parts = [];

    // 0. Active chat contact / group title
    const chatTitleEl = document.querySelector('#main header span[dir="auto"][title], #main header [data-testid="conversation-info-header-chat-title"], #main header span[title]');
    const chatTitle = chatTitleEl?.getAttribute('title') || chatTitleEl?.textContent?.trim();
    if (chatTitle) {
      parts.push(`Active Chat: "${chatTitle}"`);
    }

    // 1. Quoted reply card active above the input box in WhatsApp footer
    const footer = document.querySelector('#main footer, footer');
    if (footer) {
      const replyCard = footer.querySelector('[data-testid="quoted-message"], [class*="quoted" i], [aria-label*="quoted" i], [aria-label*="alıntılanan" i], [aria-label*="цитируем" i]');
      if (replyCard) {
        const replyText = cleanMetadata(getNodeTextWithEmojis(replyCard, n => isNoiseElement(n) || isSenderTitle(n))).trim();
        if (replyText) {
          parts.push(`Replying directly to quote: "${replyText.length > 140 ? replyText.slice(0, 140) + '…' : replyText}"`);
        }
      }
    }

    // 2. Last 5 messages in active conversation
    const scope = document.querySelector('#main') || document;
    const allRows = Array.from(scope.querySelectorAll('.message-in, .message-out, [data-id], #main div[role="row"]'))
      .filter(r => !r.closest('#side, [data-testid="chat-list"]'));

    const recent = [];
    let i = allRows.length - 1;
    while (i >= 0 && recent.length < 5) {
      const r = allRows[i];
      i--;
      const textNode = r.querySelector?.('div.copyable-text, .selectable-text, span[dir]');
      if (!textNode) continue;
      const isSystem = (r.textContent || '').includes('Messages and calls are end-to-end encrypted');
      if (isSystem) continue;

      const text = cleanMetadata(getNodeTextWithEmojis(textNode, n => isNoiseElement(n) || isSenderTitle(n))).trim();
      if (!text) continue;

      const isMe = isOutgoingRow(r);
      const speaker = isMe ? 'Me' : 'Other';
      const snippet = text.length > 120 ? text.slice(0, 120) + '…' : text;
      recent.unshift(`${speaker}: "${snippet}"`);
    }

    if (recent.length > 0) {
      parts.push(`Recent dialogue in chat:\n${recent.join('\n')}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  // ── 3. TRANSLATION EXECUTION & RATE-LIMITED QUEUE (RECEIVED ONLY) ──────────

  async function executeMessageTranslationAsync(row, currentData = null, btnEl = null) {
    const bubble = getMessageBubble(row) || row;
    if (btnEl) {
      bubble.querySelectorAll('.oat-quote-translated, .oat-translated-content').forEach(el => el.remove());
    }

    // Always query live DOM first to ensure textEl and innerCard are attached to the active document
    const current = getCleanMessageText(bubble) || currentData;
    if (!current || (!current.replyText && !current.quoteText)) return;

    if (btnEl) btnEl.classList.add('loading');

    const msgId = getRowId(bubble) || getMessageId(bubble);
    const persistData = { quoteTranslation: null, bodyTranslation: null, noop: false };
    const promises = [];

    async function translateSegment(text, appendCallback, isQuote = false, context = null) {
      if (!text) return;

      // Invariant: Translating any message bubble always translates strictly into myLanguage
      const res = await callTranslate(text, myLanguage, context);
      if (!res?.success || !res.translation) return;

      const src = (res.detectedSource || '').toLowerCase();
      const translation = (res.translation || '').trim();
      const original = (text || '').trim();

      const stripPunct = s => (s || '').replace(/[\p{P}\p{S}\s]+/gu, '').toLowerCase();
      const origStripped = stripPunct(original);
      const isIdentical = origStripped ? (stripPunct(translation) === origStripped) : (original.trim() === translation.trim());
      const isSourceSameAsTarget = src && (src === myLanguage.toLowerCase() || src.startsWith(myLanguage.toLowerCase() + '-'));
      const isExcluded = src && excludedLanguages.includes(src);

      // If manual click via translate button, always display in myLanguage
      // If auto-translate / hover-translate:
      // 1. Must provide a meaningful translation (!isIdentical). If translation !== original, foreign parts were translated!
      // 2. Must NOT be in the user's excludedLanguages list (unless manual click).
      // Note: Never let isSourceSameAsTarget block a mixed-language message when foreign words were translated (!isIdentical).
      const shouldRender = btnEl ? true : (!isIdentical && !isExcluded);

      if (shouldRender) {
        appendCallback(translation);
        if (isQuote) {
          persistData.quoteTranslation = translation;
          persistData.quoteOriginal = original;
        } else {
          persistData.bodyTranslation = translation;
          persistData.bodyOriginal = original;
        }
        console.log(`[OAT Translate] Translated: "${original.slice(0, 30)}..." -> "${translation.slice(0, 30)}..." (${src} -> ${myLanguage})`);
      } else if (!btnEl && !isExcluded) {
        // Mark as noop so we do not re-request already-matching language messages
        persistData.noop = true;
        console.log(`[OAT Translate] In ${myLanguage} already, skipped duplicate: "${original.slice(0, 30)}..."`);
      }
    }

    // 1. Quoted snippet INSIDE the reply preview card
    if (current.quoteText && (current.container || current.innerCard)) {
      const quoteContext = extractSurroundingChatContext(bubble, null);
      promises.push(
        translateSegment(current.quoteText, translation => {
          renderQuoteTranslation(current.container || current.innerCard, current.textRow, translation, current.quoteText, msgId);
        }, true, quoteContext)
      );
    }

    // 2. Message body text strictly INSIDE the bubble (NEVER on wallpaper)
    // Passes surrounding dialogue context and replied quote for grounding pronouns and tone
    if (current.replyText) {
      const surroundingContext = extractSurroundingChatContext(bubble, current.quoteText);
      promises.push(
        translateSegment(current.replyText, translation => {
          const existing = bubble.querySelector('.oat-translated-content') || (row !== bubble ? row.querySelector('.oat-translated-content') : null);
          if (existing) {
            renderFormattedTranslatedText(existing, translation);
            if (current.isEdited) existing.classList.add('oat-has-edited');
            attachCorrectionAction(existing, {
              originalText: current.replyText,
              currentTranslation: translation,
              targetLang: myLanguage || 'en',
              msgId,
              isQuote: false
            });
          } else {
            const target = getSafeBubbleTarget(bubble, current.textEl);
            if (!target) return; // Never append outside the bubble!
            const div = document.createElement('div');
            div.className = 'oat-translated-content';
            if (current.isEdited) div.classList.add('oat-has-edited');
            renderFormattedTranslatedText(div, translation);
            attachCorrectionAction(div, {
              originalText: current.replyText,
              currentTranslation: translation,
              targetLang: myLanguage || 'en',
              msgId,
              isQuote: false
            });
            target.appendChild(div);
          }
          const allBodies = bubble.querySelectorAll('.oat-translated-content');
          for (let i = 1; i < allBodies.length; i++) allBodies[i].remove();
        }, false, surroundingContext)
      );
    }

    try {
      await Promise.all(promises);
      if (msgId && (persistData.quoteTranslation || persistData.bodyTranslation || persistData.noop)) {
        persistTranslation(msgId, persistData);
      }
    } finally {
      if (btnEl) btnEl.classList.remove('loading');
      if (msgId) queuedIds.delete(msgId);
    }
  }

  function executeMessageTranslation(row, btnEl = null) {
    executeMessageTranslationAsync(row, null, btnEl);
  }

  // Scans all messages from oldest (top) to newest (bottom) and translates at a polite rate
  function scanAndEnqueueReceivedMessages() {
    if (!autoTranslateEnabled) return;

    restoreAllVisibleSavedTranslations();

    const incomingRows = getIncomingMessageRows();
    for (const row of incomingRows) {
      if (autoTranslateMode !== 'both' && isOutgoingRow(row)) continue;
      if (hasTranslationNodes(row)) continue;

      const rid = getRowId(row) || getMessageId(row);
      if (rid && (queuedIds.has(rid) || savedTranslations[rid])) {
        if (savedTranslations[rid] && !savedTranslations[rid].noop) {
          restoreSavedTranslation(row);
        }
        continue;
      }

      const msgData = getCleanMessageText(row);
      if (!msgData || (!msgData.replyText && !msgData.quoteText)) continue;

      if (rid) queuedIds.add(rid);
      autoTranslateQueue.push({ row, rid, msgData });
    }

    if (!isProcessingQueue && autoTranslateQueue.length > 0) {
      processAutoTranslateQueue();
    }
  }

  // Live incoming message queueing
  function enqueueIncomingRow(row, retryCount = 0) {
    if (!autoTranslateEnabled || !row) return;

    let bubble = getMessageBubble(row);
    if (!bubble) {
      // Incoming WebSocket message row may take 50-200ms for React to mount the inner bubble
      if (retryCount < 10 && row && document.body.contains(row)) {
        setTimeout(() => {
          if (document.body.contains(row)) {
            enqueueIncomingRow(row, retryCount + 1);
          }
        }, 100);
      }
      return;
    }

    if (bubble.closest('#side')) return;

    if (autoTranslateMode !== 'both' && (isOutgoingRow(bubble) || isOutgoingRow(row))) return;
    if (hasTranslationNodes(bubble) || hasTranslationNodes(row)) return;

    const rid = getRowId(row) || getRowId(bubble) || getMessageId(bubble);
    if (rid && (queuedIds.has(rid) || savedTranslations[rid])) {
      if (savedTranslations[rid] && !savedTranslations[rid].noop) {
        restoreSavedTranslation(bubble);
      }
      return;
    }

    const msgData = getCleanMessageText(bubble) || getCleanMessageText(row);
    if (!msgData || (!msgData.replyText && !msgData.quoteText)) {
      if (retryCount < 10 && document.body.contains(row)) {
        setTimeout(() => {
          let liveRow = document.body.contains(row) ? row : (rid ? findRowByMessageId(rid) : null);
          if (liveRow) enqueueIncomingRow(liveRow, retryCount + 1);
        }, 120);
      }
      return;
    }

    if (rid) queuedIds.add(rid);
    console.log(`[OAT AutoTranslate] Enqueued live message (${rid}): "${msgData.replyText?.slice(0, 30) || 'msg'}"`);
    autoTranslateQueue.push({ row: bubble, rowParent: row, rid, msgData });

    if (!isProcessingQueue) {
      processAutoTranslateQueue();
    }
  }

  async function processAutoTranslateQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    try {
      while (autoTranslateQueue.length > 0) {
        if (!autoTranslateEnabled) {
          autoTranslateQueue.length = 0;
          break;
        }

        const item = autoTranslateQueue.shift();
        if (!item || (!item.row && !item.rowParent)) continue;

        let liveRow = (item.row && document.body.contains(item.row)) ? item.row : null;
        if (!liveRow && item.rowParent && document.body.contains(item.rowParent)) {
          liveRow = getMessageBubble(item.rowParent) || item.rowParent;
        }
        if (!liveRow) {
          const mid = item.rid || getRowId(item.row) || getMessageId(item.row);
          if (mid) {
            const found = findRowByMessageId(mid);
            if (found) liveRow = getMessageBubble(found) || found;
          }
        }

        if (!liveRow || !document.body.contains(liveRow)) {
          if (item.rid) queuedIds.delete(item.rid);
          continue;
        }

        if (autoTranslateMode !== 'both' && isOutgoingRow(liveRow)) {
          if (item.rid) queuedIds.delete(item.rid);
          continue;
        }

        if (hasTranslationNodes(liveRow)) {
          if (item.rid) queuedIds.delete(item.rid);
          continue;
        }

        try {
          await executeMessageTranslationAsync(liveRow, item.msgData, null);
        } catch (err) {
          console.warn('[OAT AutoTranslate] Error for row:', err);
        } finally {
          const rid = item.rid || getRowId(liveRow) || getMessageId(liveRow);
          if (rid) queuedIds.delete(rid);
        }

        // Polite rate delay (160ms) ensures smooth visual loading and zero HTTP 429 rate limits
        await new Promise(r => setTimeout(r, 160));
      }
    } finally {
      isProcessingQueue = false;
    }
  }

  // ── 4. HOVER ACTION BUTTON INJECTION (STRICTLY ONE PER MESSAGE) ─────────────

  function decorateMessageActionBar(reactBtn) {
    if (!reactBtn) return;
    const actionBar = reactBtn.parentElement;
    if (!actionBar) return;

    // STRICT GUARD: Must NOT be inside a reaction badge tray, emoji picker, or popup
    if (actionBar.closest('[data-testid="reactions-row"], [class*="reactions" i], [role="dialog"], [role="menu"]')) {
      return;
    }

    if (actionBar.querySelector('.oat-hover-translate-btn')) return;

    const row = reactBtn.closest('.message-in, .message-out, [data-id], #main div[role="row"], div[data-testid="msg-container"]') || reactBtn.parentElement;
    if (!row) return;

    actionBar.style.setProperty('display', 'inline-flex', 'important');
    actionBar.style.setProperty('flex-direction', 'row', 'important');
    actionBar.style.setProperty('flex-wrap', 'nowrap', 'important');
    actionBar.style.setProperty('align-items', 'center', 'important');
    actionBar.style.setProperty('width', 'auto', 'important');
    actionBar.style.setProperty('max-width', 'none', 'important');
    actionBar.style.setProperty('overflow', 'visible', 'important');
    actionBar.style.setProperty('gap', '3px', 'important');

    const btn = document.createElement('button');
    btn.className = 'oat-hover-translate-btn';
    btn.setAttribute('aria-label', 'Translate message');
    btn.title = `Translate message`;
    btn.innerHTML = SVG_TRANSLATE;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      executeMessageTranslation(row, btn);
    });

    actionBar.insertBefore(btn, reactBtn);
  }

  // ── 5. FORMAT BAR BUTTON & INPUT TRANSLATION ───────────────────────────────

  function isEmojiReactionContainer(el) {
    if (!el) return true;
    if (el.closest('[role="dialog"], [data-testid*="reaction" i], [class*="reaction" i], [aria-label*="reaction" i], [aria-label*="реакц" i], [aria-label*="tepki" i]')) {
      return true;
    }
    if (el.querySelector('img[src*="emoji"], img[alt], [data-icon*="reaction" i], [data-testid*="reaction" i]')) {
      return true;
    }
    if (/[👍❤️😂😮😢🙏]/.test(el.textContent || '')) {
      return true;
    }
    return false;
  }

  function findFormatToolbar() {
    // 1. MUST have text selected in the active chat input
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      return null;
    }

    const input = getChatInputBox();
    if (!input || !isInputActive(input)) return null;

    // 2. Reject emoji reaction pill bars
    const matchClass = document.querySelector('div.x46w9ns, div[class*="x46w9ns"]');
    if (matchClass && !isEmojiReactionContainer(matchClass)) {
      return matchClass;
    }

    const allDivs = Array.from(document.querySelectorAll('div'));
    for (const div of allDivs) {
      if (isEmojiReactionContainer(div)) continue;
      const count = div.children.length;
      if (count >= 5 && count <= 9) {
        const r = div.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 250 && r.height >= 24 && r.height <= 60) {
          if (!div.closest('[data-id], [role="dialog"], [class*="reaction" i]')) {
            return div;
          }
        }
      }
    }
    return null;
  }

  function attachFormattingBarButton() {
    const toolbar = findFormatToolbar();
    if (!toolbar) return;
    if (toolbar.querySelector('.oat-format-bar-btn')) return;

    const code = targetLang().toUpperCase();
    const sample = toolbar.firstElementChild;

    const btn = document.createElement(sample?.tagName || 'div');
    btn.className = (sample?.className || '') + ' oat-format-bar-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.title = `Translate input to ${code} (Ctrl+Enter)`;
    btn.setAttribute('aria-label', `Translate input to ${code}`);
    btn.innerHTML = `${SVG_TRANSLATE}<span class="oat-format-badge">${code}</span>`;

    const blockFocus = e => {
      e.preventDefault();
      e.stopPropagation();
    };
    btn.addEventListener('pointerdown', blockFocus);
    btn.addEventListener('mousedown', blockFocus);

    btn.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      translateInputBox(btn);
    });

    toolbar.appendChild(btn);
  }

  async function translateInputBox(btnEl = null) {
    if (btnEl && btnEl.classList.contains('loading')) return;

    const input = getChatInputBox();
    if (!input) return;

    // Use getNodeTextWithEmojis so emoji <img> tags, <p> paragraph blocks, and <br> newlines are fully preserved
    const raw = getNodeTextWithEmojis(input);
    const text = cleanMetadata(raw).trim();
    if (!text) return;

    if (btnEl) btnEl.classList.add('loading');
    try {
      const recentContext = extractActiveChatRecentContext();
      const res = await callTranslate(text, targetLang(), recentContext);
      if (btnEl) btnEl.classList.remove('loading');
      if (res?.success && res.translation) {
        replaceInputContent(input, res.translation);
      }
    } catch (err) {
      if (btnEl) btnEl.classList.remove('loading');
      console.error('[OAT] input translation error:', err);
    }
  }

  // ── 6. KEYBOARD SHORTCUT (CTRL+ENTER TO TRANSLATE INPUT MANUALLY) ─────────

  document.addEventListener('keydown', e => {
    const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
    const isModifier = e.ctrlKey || e.metaKey;

    // Manual shortcut: Ctrl+Enter (always available to translate input draft)
    if (isEnter && isModifier) {
      const input = getChatInputBox();
      if (input && isInputActive(input)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const btn = document.querySelector('.oat-format-bar-btn');
        translateInputBox(btn);
      }
    }
  }, true);

  // ── 7. THREE-DOTS MENU HOOK ───────────────────────────────────────────────

  let menuPollTimer = null;
  let menuPollCount = 0;

  function startMenuPoll() {
    clearInterval(menuPollTimer);
    menuPollCount = 0;
    menuPollTimer = setInterval(() => {
      menuPollCount++;
      if (menuPollCount > 25) {
        clearInterval(menuPollTimer);
        return;
      }
      tryInjectMenu();
    }, 50);
  }

  function tryInjectMenu() {
    const menus = Array.from(document.querySelectorAll('div[role="menu"]'));
    if (!menus.length) return;

    for (const menu of menus) {
      if (menu.querySelector('.oat-menu-item') || menu.closest('.oat-lang-backdrop')) {
        clearInterval(menuPollTimer);
        return;
      }

      // Collect interactive buttons in the menu
      const allButtons = Array.from(menu.querySelectorAll('button, [role="button"], li[role="button"], [role="menuitem"]'));
      if (!allButtons.length) continue;

      // Detect Contact info OR Group info (multi-lingual)
      let targetBtn = allButtons.find(b => {
        const text = (b.textContent || '').trim().toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
        const combined = `${text} ${aria}`;
        return (
          /info\b|bilgi|данные|información|infos|معلومات/i.test(combined) &&
          /(?:contact|group|kisi|kişi|grup|contacto|grupo|groupe|جهة الاتصال|المجموعة)/i.test(combined)
        );
      });

      // Fallback: If not matched by info regex, verify this menu is indeed the conversation 3-dots menu
      if (!targetBtn) {
        const menuText = (menu.textContent || '').toLowerCase();
        const isConvMenu = (
          /info\b|bilgi|данные|información|infos|معلومات/i.test(menuText) ||
          /select message|mesajları seç|выбрать|seleccionar/i.test(menuText) ||
          /close chat|clear chat|exit group|gruptan ayrıl|sohbeti/i.test(menuText) ||
          /mute|sessize al|без звука|silenciar/i.test(menuText)
        );
        if (isConvMenu) {
          targetBtn = allButtons[0];
        }
      }

      if (!targetBtn) continue;

      const itemsWrapper = targetBtn.parentElement;
      if (!itemsWrapper) continue;

      clearInterval(menuPollTimer);

      const code = targetLang().toUpperCase();
      const btn = document.createElement('button');
      btn.className = (targetBtn.className || '') + ' oat-menu-item';
      btn.setAttribute('aria-label', 'Change target language');
      btn.innerHTML = `${SVG_TRANSLATE}<span style="flex:1;text-align:left">Change target language</span><span class="oat-menu-badge">${code}</span>`;

      const cs = window.getComputedStyle(targetBtn);
      const contactSvg = targetBtn.querySelector('svg');
      if (contactSvg) {
        const contactSvgRect = contactSvg.getBoundingClientRect();
        const contactBtnRect = targetBtn.getBoundingClientRect();
        const nativeIconOffset = Math.round(contactSvgRect.left - contactBtnRect.left);
        if (nativeIconOffset > 0) {
          btn.style.setProperty('padding-left', `${nativeIconOffset}px`, 'important');
        }
      } else if (cs.paddingLeft) {
        btn.style.setProperty('padding-left', cs.paddingLeft, 'important');
      }

      if (cs.paddingRight) btn.style.setProperty('padding-right', cs.paddingRight, 'important');
      if (cs.minHeight) btn.style.setProperty('min-height', cs.minHeight, 'important');

      btn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        menu.remove();
        openLanguagePanel();
      });

      if (targetBtn.parentElement?.tagName === 'LI') {
        const li = document.createElement('li');
        li.className = targetBtn.parentElement.className || '';
        li.setAttribute('role', 'none');
        li.appendChild(btn);
        targetBtn.parentElement.parentElement.insertBefore(li, targetBtn.parentElement.parentElement.firstChild);
      } else {
        itemsWrapper.insertBefore(btn, itemsWrapper.firstChild);
      }
      break;
    }
  }

  document.addEventListener('click', startMenuPoll, { capture: true, passive: true });
  document.addEventListener('mousedown', startMenuPoll, { capture: true, passive: true });

  // ── 8. LANGUAGE MODAL DIALOG ──────────────────────────────────────────────

  function openLanguagePanel() {
    document.querySelector('.oat-lang-backdrop')?.remove();
    const chatName = getChatId();

    const isRealChat = chatName && chatName !== 'default';

    const backdrop = document.createElement('div');
    backdrop.className = 'oat-lang-backdrop';

    let currentFilter = '';

    function render() {
      const active = targetLang();
      const filtered = LANGUAGES.filter(l =>
        !currentFilter ||
        l.name.toLowerCase().includes(currentFilter) ||
        l.code.toLowerCase().includes(currentFilter)
      );

      backdrop.innerHTML = `
        <div class="oat-lang-dialog">
          <div class="oat-lang-header">
            <div style="display:flex; flex-direction:column; gap:2px; min-width:0; flex:1;">
              <span style="font-size:15px; font-weight:600;">Target Language</span>
              <span style="font-size:12px; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(chatName)}">
                ${isRealChat ? `Saved for: ${esc(chatName)}` : 'Applies to all chats'}
              </span>
            </div>
            <button class="oat-lang-close" title="Close">✕</button>
          </div>
          <div class="oat-lang-search-wrap">
            <input class="oat-lang-search" id="oat-ps"
                   type="text" placeholder="Search language…" autocomplete="off"
                   value="${esc(currentFilter)}" />
          </div>
          <div class="oat-lang-list">
            ${filtered.map(l => `
              <div class="oat-lang-item ${l.code === active ? 'active' : ''}"
                   data-code="${l.code}">
                <span>${l.name}</span>
                <span class="oat-lang-code">${l.code.toUpperCase()}</span>
              </div>`).join('')}
          </div>
        </div>`;

      backdrop.querySelector('.oat-lang-close').addEventListener('click', () => backdrop.remove());
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) backdrop.remove();
      });

      backdrop.querySelector('#oat-ps').addEventListener('input', e => {
        currentFilter = e.target.value.toLowerCase().trim();
        render();
        const newInput = backdrop.querySelector('#oat-ps');
        if (newInput) { newInput.focus(); newInput.setSelectionRange(9999, 9999); }
      });

      Array.from(backdrop.querySelectorAll('.oat-lang-item')).forEach(item => {
        item.addEventListener('click', () => {
          setTargetLang(item.dataset.code);
          backdrop.remove();
        });
      });
    }

    render();
    document.body.appendChild(backdrop);
    setTimeout(() => backdrop.querySelector('#oat-ps')?.focus(), 60);

    backdrop.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        backdrop.remove();
      }
    });
  }

  // ── 9. MUTATION OBSERVER & CHAT CHANGE DETECTION ──────────────────────────

  function checkChatChange() {
    const newChatId = getChatId();
    if (newChatId && newChatId !== 'default' && newChatId !== currentChatId && !isPresenceText(newChatId)) {
      currentChatId = newChatId;
      refreshBadges();
      onChatOpenedOrChanged();
    }
  }

  const observer = new MutationObserver(mutations => {
    checkChatChange();

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;

        // Message hover bar decoration: strictly target button[aria-label="React"]
        if (node.getAttribute?.('aria-label') === 'React' || (node.tagName === 'BUTTON' && node.getAttribute?.('aria-label') === 'React')) {
          decorateMessageActionBar(node);
        } else if (typeof node.querySelectorAll === 'function') {
          Array.from(node.querySelectorAll('button[aria-label="React"]'))
            .forEach(btn => decorateMessageActionBar(btn));
        }

        // Live incoming/chat messages auto-translation
        if (autoTranslateEnabled) {
          const isStabilized = (Date.now() - chatOpenTimestamp) > 350;
          if (isStabilized) {
            const candidates = new Set();

            const isMatch = el => el.classList?.contains('message-in') ||
              el.getAttribute?.('data-id')?.startsWith('false_') ||
              el.getAttribute?.('data-id')?.includes('newsletter') ||
              (el.getAttribute?.('role') === 'row' && el.closest?.('#main') && (autoTranslateMode === 'both' || !isOutgoingRow(el))) ||
              (autoTranslateMode === 'both' && (el.classList?.contains('message-out') || el.getAttribute?.('data-id')?.startsWith('true_')));

            if (isMatch(node)) {
              candidates.add(node);
            } else {
              const parentRow = node.closest?.('.message-in, [data-id^="false_"], [data-id*="newsletter"], #main div[role="row"], div[data-testid="msg-container"]' + (autoTranslateMode === 'both' ? ', .message-out, [data-id^="true_"]' : ''));
              if (parentRow && (autoTranslateMode === 'both' || !isOutgoingRow(parentRow))) candidates.add(parentRow);
            }

            if (typeof node.querySelectorAll === 'function') {
              const sel = autoTranslateMode === 'both'
                ? '.message-in, .message-out, [data-id], #main div[role="row"], div[data-testid="msg-container"]'
                : '.message-in, [data-id^="false_"], [data-id*="newsletter"], #main div[role="row"], div[data-testid="msg-container"]';
              node.querySelectorAll(sel).forEach(el => {
                if (autoTranslateMode === 'both' || !isOutgoingRow(el)) candidates.add(el);
              });
            }

            for (const cand of candidates) {
              const rid = getRowId(cand) || getMessageId(cand);
              if (rid && knownChatRowIds.has(rid)) continue;
              if (rid) knownChatRowIds.add(rid);

              // 1. If stored translation exists in cache, restore it immediately
              if (rid && savedTranslations[rid]) {
                if (!savedTranslations[rid].noop) {
                  restoreSavedTranslation(cand);
                }
                continue;
              }

              // 2. User rule: DO NOT auto-translate old historical messages loaded via scroll!
              // Only genuinely NEW live messages arriving at the bottom of the active conversation get auto-translated.
              if (!isLiveNewMessageAtBottom(cand)) {
                continue; // Historical message left untouched until user hovers on it
              }

              if (autoTranslateMode !== 'both' && isOutgoingRow(cand)) continue;
              enqueueIncomingRow(cand);
            }
          }
        }
      }
    }

    attachFormattingBarButton();
    tryInjectMenu();
  });

  function isLiveNewMessageAtBottom(cand) {
    if (!cand) return false;
    const scope = document.querySelector('#main');
    if (!scope) return false;

    // Check if the chat scroll pane is scrolled up into history
    const scrollContainer = scope.querySelector('div[tabindex="-1"], [data-testid="conversation-panel-messages"], section') || scope;
    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
      const scrollBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      if (scrollBottom > 280) return false; // Scrolled back in history -> historical node
    }

    // A genuine new live message is at or near the very bottom of the message rows
    const allRows = scope.querySelectorAll('.message-in, .message-out, [data-id], #main div[role="row"], div[data-testid="msg-container"]');
    if (allRows.length === 0) return false;

    const rowEl = cand.closest?.('[data-id], [role="row"], .message-in, .message-out') || cand;
    const total = allRows.length;
    for (let i = Math.max(0, total - 3); i < total; i++) {
      if (allRows[i] === rowEl || allRows[i].contains(cand) || cand.contains(allRows[i])) {
        return true;
      }
    }
    return false;
  }

  observer.observe(document.body, { childList: true, subtree: true });

  // Listen to clicks on sidebar items for instant chat switch synchronization
  document.addEventListener('click', e => {
    if (e.target.closest?.('#side, [data-testid="chat-list"], [role="row"], [role="listitem"]')) {
      setTimeout(checkChatChange, 80);
      setTimeout(checkChatChange, 250);
      setTimeout(checkChatChange, 500);
    }
  }, { passive: true });

  // Heartbeat check ensures language badges stay synchronized and visible translations are restored
  setInterval(() => {
    checkChatChange();
    restoreAllVisibleSavedTranslations();
  }, 2500);

  // When scrolling the chat history, restore saved translations instantly
  let scrollScanTimer = null;
  document.addEventListener('scroll', () => {
    clearTimeout(scrollScanTimer);
    scrollScanTimer = setTimeout(() => {
      restoreAllVisibleSavedTranslations();
    }, 100);
  }, { passive: true, capture: true });

  // ── Hover-to-Translate Engine ─────────────────────────────────────────────
  let hoverTranslateTimer = null;
  let currentHoverRow = null;

  function handleMessageHover(targetEl) {
    if (!targetEl || !targetEl.closest?.('#main')) {
      clearHoverTimer();
      return;
    }

    const row = targetEl.closest?.('.message-in, .message-out, [data-id], #main div[role="row"], div[data-testid="msg-container"]');
    if (!row) {
      clearHoverTimer();
      return;
    }

    // Decorate react button with hover translate button
    const reactBtn = row.querySelector('button[aria-label="React"]');
    if (reactBtn) decorateMessageActionBar(reactBtn);

    // Verify user is actually hovering over the message bubble itself, NOT empty wallpaper beside an outgoing bubble
    const bubble = getMessageBubble(row);
    const isOverBubble = bubble ? (bubble === targetEl || bubble.contains(targetEl)) : true;
    if (!isOverBubble) {
      clearHoverTimer();
      return;
    }

    if (!autoTranslateEnabled) return;
    if (autoTranslateMode !== 'both' && isOutgoingRow(row)) return;
    if (hasTranslationNodes(row) || (bubble && hasTranslationNodes(bubble))) return;

    const rid = getRowId(row) || getMessageId(row);
    if (rid && savedTranslations[rid]) {
      if (!savedTranslations[rid].noop) {
        restoreSavedTranslation(row);
      }
      return;
    }

    if (rid && queuedIds.has(rid)) return;

    if (currentHoverRow === row) return;
    clearHoverTimer();
    currentHoverRow = row;

    hoverTranslateTimer = setTimeout(() => {
      if (currentHoverRow === row && document.body.contains(row) && !hasTranslationNodes(row)) {
        console.log(`[OAT HoverTranslate] Hover detected on message (${rid}), translating to ${myLanguage}...`);
        executeMessageTranslationAsync(row);
      }
    }, 200);
  }

  function clearHoverTimer() {
    if (hoverTranslateTimer) {
      clearTimeout(hoverTranslateTimer);
      hoverTranslateTimer = null;
    }
    currentHoverRow = null;
  }

  document.addEventListener('mouseover', e => {
    handleMessageHover(e.target);
  }, { passive: true });

  document.addEventListener('mouseout', e => {
    if (currentHoverRow && (!e.relatedTarget || !currentHoverRow.contains(e.relatedTarget))) {
      clearHoverTimer();
    }
  }, { passive: true });

  attachFormattingBarButton();

  console.log("[Omar Tariq's WhatsApp Translator] v4.6 active & ready.");
})();
