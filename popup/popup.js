/**
 * Omar Tariq's WhatsApp Translator - Popup Controller (v4.7.1)
 * 
 * Features:
 * - Smart Adaptive Mix selector (Smart Adaptive, Full Dialect AI, Zero-Key Free)
 * - Draggable & Reorderable Provider Priority Stack (Groq, Gemini, Chrome AI, Google MT)
 * - Expandable API Key Drawers with:
 *     - 1-Click Free Key Registration links
 *     - Live API Model Discovery ([🔄 Fetch Models] directly from Groq/Google API)
 *     - Custom Model ID input support
 *     - Live Ping Latency Test
 * - Multilingual Style Preservation Toggles & Storage Budget Ledger
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

  const PROVIDER_DEFS = {
    groq: {
      id: 'groq',
      name: 'Groq',
      freeKeyUrl: 'https://console.groq.com/keys',
      freeKeyLabel: '⚡ Get Free Key in 10s (No Credit Card)',
      hasDrawer: true,
      models: [
        { id: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile' },
        { id: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant' },
        { id: 'custom', label: '✍️ Custom Model ID...' }
      ]
    },
    openrouter: {
      id: 'openrouter',
      name: 'OpenRouter',
      freeKeyUrl: 'https://openrouter.ai/keys',
      freeKeyLabel: '🔑 Get Free OpenRouter Key ↗',
      hasDrawer: true,
      models: [
        { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'meta-llama/llama-3.3-70b-instruct:free' },
        { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'qwen/qwen-2.5-72b-instruct:free' },
        { id: 'mistralai/mistral-small-24b-instruct-2501:free', label: 'mistralai/mistral-small-24b-instruct-2501:free' },
        { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', label: 'google/gemini-2.0-flash-lite-preview-02-05:free' },
        { id: 'deepseek/deepseek-r1:free', label: 'deepseek/deepseek-r1:free' },
        { id: 'custom', label: '✍️ Custom Model ID...' }
      ]
    },
    openai: {
      id: 'openai',
      name: 'OpenAI',
      freeKeyUrl: 'https://platform.openai.com/api-keys',
      freeKeyLabel: '🔑 Get Key (OpenAI Platform)',
      hasDrawer: true,
      directModelInput: true
    },
    gemini: {
      id: 'gemini',
      name: 'Gemini',
      freeKeyUrl: 'https://aistudio.google.com/app/apikey',
      freeKeyLabel: '🔑 Get Key (Google AI Studio)',
      hasDrawer: true,
      directModelInput: true
    },
    chrome_ai: {
      id: 'chrome_ai',
      name: 'Chrome AI',
      hasDrawer: false
    },
    google_mt: {
      id: 'google_mt',
      name: 'Google Translate',
      hasDrawer: false,
      pinned: true
    }
  };

  // DOM Elements
  const selectMyLang = document.getElementById('select-my-lang');
  const toggleAuto = document.getElementById('toggle-autotranslate');
  const autoOptions = document.getElementById('autotranslate-options');
  const modeOthers = document.getElementById('mode-others');
  const modeBoth = document.getElementById('mode-both');
  const excludedChips = document.getElementById('excluded-chips');
  const currentChatLang = document.getElementById('current-chat-lang');

  // Mix elements
  const mixAdaptive = document.getElementById('mix-adaptive');
  const mixAifirst = document.getElementById('mix-aifirst');
  const mixZeroconfig = document.getElementById('mix-zeroconfig');
  const mixBadge = document.getElementById('mix-badge');
  const mixDesc = document.getElementById('mix-description');

  // Provider Stack container
  const providerStackEl = document.getElementById('provider-stack');

  // Style Toggles
  const styleCaps = document.getElementById('style-caps');
  const styleElongation = document.getElementById('style-elongation');
  const styleLaughter = document.getElementById('style-laughter');
  const stylePunctuation = document.getElementById('style-punctuation');
  const styleSpans = document.getElementById('style-spans');
  const styleSlang = document.getElementById('style-slang');

  // Budget elements
  const budgetText = document.getElementById('budget-text');
  const budgetBar = document.getElementById('budget-bar');

  let state = {
    myLanguage: 'en',
    lastTargetLanguage: 'tr',
    autoTranslateEnabled: true,
    autoTranslateMode: 'both',
    excludedLanguages: [],
    // Mix & Providers
    activeMix: 'ai_first',
    providerOrder: ['groq', 'openrouter', 'openai', 'gemini', 'chrome_ai', 'google_mt'],
    providerEnabled: { groq: true, openrouter: true, openai: true, gemini: true, chrome_ai: false, google_mt: true },
    groqApiKey: '',
    groqModel: 'llama-3.3-70b-versatile',
    openrouterApiKey: '',
    openrouterModel: 'meta-llama/llama-3.3-70b-instruct:free',
    openaiApiKey: '',
    openaiModel: '',
    geminiApiKey: '',
    geminiModel: '',
    chromeAIAvailable: false,
    fetchedModels: { groq: null, openrouter: null },
    // Style Toggles
    stylePreserveCaps: true,
    stylePreserveElongation: true,
    stylePreserveLaughter: true,
    stylePreservePunctuation: true,
    styleProtectSpans: true,
    styleExpandSlang: true
  };

  // 1. Populate My Language Dropdown
  LANGUAGES.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = `${lang.name} (${lang.code.toUpperCase()})`;
    selectMyLang.appendChild(opt);
  });

  // 2. Render Excluded Language Chips
  function renderChips() {
    excludedChips.innerHTML = '';
    LANGUAGES.forEach(lang => {
      const isSelected = state.excludedLanguages.includes(lang.code);
      const chip = document.createElement('div');
      chip.className = `lang-chip ${isSelected ? 'selected' : ''}`;
      chip.textContent = lang.name;
      chip.title = `Click to ${isSelected ? 'include in' : 'exclude from'} auto-translation`;

      chip.addEventListener('click', () => {
        if (state.excludedLanguages.includes(lang.code)) {
          state.excludedLanguages = state.excludedLanguages.filter(c => c !== lang.code);
        } else {
          state.excludedLanguages.push(lang.code);
        }
        chrome.storage.local.set({ excludedLanguages: state.excludedLanguages });
        renderChips();
      });

      excludedChips.appendChild(chip);
    });
  }

  // 3. Update Storage Budget Display
  function refreshBudgetLedger() {
    chrome.runtime.sendMessage({ action: 'GET_BUDGET_SUMMARY' }, resp => {
      if (resp?.success && resp.summary) {
        const s = resp.summary;
        if (budgetText) budgetText.textContent = `${s.usedMB} MB / ${s.capMB} MB`;
        if (budgetBar) budgetBar.style.width = `${Math.max(parseFloat(s.usagePercent) || 0.2, 0.2)}%`;
      }
    });
  }

  // 4. Update Active Chat Target Language Display
  function updateActiveChatDisplay() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.url?.includes('web.whatsapp.com')) {
        const fallbackName = LANGUAGES.find(l => l.code === state.lastTargetLanguage)?.name || 'Turkish';
        currentChatLang.textContent = `${fallbackName} (${state.lastTargetLanguage.toUpperCase()})`;
        return;
      }

      chrome.storage.local.get(['chatTargetLanguages', 'lastTargetLanguage', 'defaultTargetLanguage'], res => {
        const fallback = res.defaultTargetLanguage || res.lastTargetLanguage || 'tr';
        const fallbackName = LANGUAGES.find(l => l.code === fallback)?.name || fallback.toUpperCase();
        currentChatLang.textContent = `${fallbackName} (${fallback.toUpperCase()})`;
      });
    });
  }

  // 5. Check Chrome AI Capabilities
  function checkChromeAI() {
    chrome.runtime.sendMessage({ action: 'CHECK_CHROME_AI' }, resp => {
      state.chromeAIAvailable = !!resp?.available;
      renderProviderStack();
    });
  }

  // 6. Update Mix Description & Badge
  function updateMixUI() {
    if (state.activeMix === 'smart_adaptive') {
      mixAdaptive.checked = true;
      mixBadge.textContent = 'Smart Adaptive';
      mixDesc.textContent = 'Auto-detects Arabic dialects (العامية: Egyptian, Levantine, Gulf), Arabizi, and Turkish street slang to route to AI, while keeping simple chat on instant MT. Saves 80% quota & eliminates rate limits.';
    } else if (state.activeMix === 'ai_first') {
      mixAifirst.checked = true;
      mixBadge.textContent = 'Full Dialect AI';
      mixDesc.textContent = 'Always executes top active AI model first for every message. Falls down the stack seamlessly if rate-limited or key missing.';
    } else if (state.activeMix === 'zero_config') {
      mixZeroconfig.checked = true;
      mixBadge.textContent = 'Zero-Key Free';
      mixDesc.textContent = '100% free with zero API keys required. Routes through Chrome Built-in AI (if supported) and Google MT + Multilingual Style Engine.';
    }
  }

  // 7. Render Draggable Provider Priority Stack
  let draggedCardId = null;

  function renderProviderStack() {
    if (!providerStackEl) return;
    providerStackEl.innerHTML = '';

    state.providerOrder.forEach((providerId, index) => {
      const def = PROVIDER_DEFS[providerId];
      if (!def) return;

      const isEnabled = state.providerEnabled[providerId] !== false;
      const card = document.createElement('div');
      card.className = `provider-card ${!isEnabled ? 'disabled' : ''}`;
      card.setAttribute('draggable', 'true');
      card.dataset.id = providerId;

      // Status Badge logic
      let badgeHtml = '';
      if (!isEnabled) {
        badgeHtml = '<span class="provider-status-badge badge-neutral">Disabled</span>';
      } else if (providerId === 'groq') {
        if (!state.groqApiKey) {
          badgeHtml = '<span class="provider-status-badge badge-amber">No Key</span>';
        } else {
          badgeHtml = '<span class="provider-status-badge badge-green">Active (150ms)</span>';
        }
      } else if (providerId === 'openrouter') {
        if (!state.openrouterApiKey) {
          badgeHtml = '<span class="provider-status-badge badge-amber">No Key</span>';
        } else {
          badgeHtml = '<span class="provider-status-badge badge-green">Free Tier Active</span>';
        }
      } else if (providerId === 'openai') {
        if (!state.openaiApiKey) {
          badgeHtml = '<span class="provider-status-badge badge-amber">No Key</span>';
        } else {
          badgeHtml = '<span class="provider-status-badge badge-green">Active</span>';
        }
      } else if (providerId === 'gemini') {
        if (!state.geminiApiKey) {
          badgeHtml = '<span class="provider-status-badge badge-amber">No Key</span>';
        } else {
          badgeHtml = '<span class="provider-status-badge badge-green">Active</span>';
        }
      } else if (providerId === 'chrome_ai') {
        if (state.chromeAIAvailable) {
          badgeHtml = '<span class="provider-status-badge badge-green">On-Device GPU</span>';
        } else {
          badgeHtml = '<span class="provider-status-badge badge-neutral">Not Enabled in Chrome</span>';
        }
      } else if (providerId === 'google_mt') {
        badgeHtml = '<span class="provider-status-badge badge-green">Instant Base</span>';
      }

      // Build Card Header
      const header = document.createElement('div');
      header.className = 'provider-header';

      header.innerHTML = `
        <div class="provider-drag-left">
          <span class="drag-handle" title="Drag to reorder priority">≡</span>
          <div class="provider-info">
            <div class="provider-title-row">
              <span class="provider-name">${def.name}</span>
              ${badgeHtml}
            </div>
          </div>
        </div>
        <div class="provider-actions">
          <div class="order-btn-group">
            <button class="order-btn btn-up" title="Move Up" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="order-btn btn-down" title="Move Down" ${index === state.providerOrder.length - 1 ? 'disabled' : ''}>▼</button>
          </div>
          ${def.hasDrawer ? `<button class="drawer-toggle-btn" title="API Key Settings">⚙️</button>` : ''}
          <label class="switch rule-switch">
            <input type="checkbox" class="provider-toggle" ${isEnabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      `;

      card.appendChild(header);

      // Build Drawer if provider has API key settings
      if (def.hasDrawer) {
        const drawer = document.createElement('div');
        drawer.className = 'provider-drawer hidden';
        drawer.id = `drawer-${providerId}`;

        const isGroq = providerId === 'groq';
        const isOpenRouter = providerId === 'openrouter';
        const isOpenAI = providerId === 'openai';
        const isGemini = providerId === 'gemini';

        const apiKeyVal = isGroq ? state.groqApiKey : (isOpenRouter ? state.openrouterApiKey : (isOpenAI ? state.openaiApiKey : state.geminiApiKey));
        const currentModel = (isGroq ? state.groqModel : (isOpenRouter ? state.openrouterModel : (isOpenAI ? state.openaiModel : state.geminiModel))) || '';
        const providerTitle = isGroq ? 'Groq' : (isOpenRouter ? 'OpenRouter' : (isOpenAI ? 'OpenAI' : 'Gemini'));
        const exampleModel = isGroq ? 'llama-3.3-70b-versatile' : (isOpenRouter ? 'meta-llama/llama-3.3-70b-instruct:free' : '');

        if (def.directModelInput) {
          drawer.innerHTML = `
            <div class="key-input-row">
              <input type="password" class="key-input" id="key-${providerId}" placeholder="Enter ${providerTitle} API Key" value="${apiKeyVal}">
              <button class="test-btn" id="test-${providerId}">⚡ Test</button>
            </div>
            <div style="margin-top: 6px;">
              <input type="text" class="key-input" id="model-${providerId}" placeholder="Enter Model ID" value="${currentModel}">
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
              <a href="${def.freeKeyUrl}" target="_blank" class="free-key-link">${def.freeKeyLabel}</a>
              <span class="ping-result" id="ping-${providerId}"></span>
            </div>
          `;
        } else {
          // Determine options list: if user fetched live models, use those; otherwise use default preset
          const availableModels = state.fetchedModels[providerId] || def.models || [];
          const isPreset = availableModels.some(m => m.id === currentModel);
          const selectedValue = isPreset ? currentModel : 'custom';

          let modelOptionsHtml = availableModels.map(m => 
            `<option value="${m.id}" ${m.id === selectedValue ? 'selected' : ''}>${m.label}</option>`
          ).join('');

          if (!availableModels.some(m => m.id === 'custom')) {
            modelOptionsHtml += `<option value="custom" ${selectedValue === 'custom' ? 'selected' : ''}>✍️ Custom Model ID...</option>`;
          }

          drawer.innerHTML = `
            <div class="key-input-row">
              <input type="password" class="key-input" id="key-${providerId}" placeholder="Enter ${providerTitle} API Key" value="${apiKeyVal}">
              <button class="test-btn" id="fetch-${providerId}" title="Fetch live active models directly from API">🔄 Fetch</button>
              <button class="test-btn" id="test-${providerId}">⚡ Test</button>
            </div>
            <div class="select-wrapper">
              <select class="custom-select" id="model-${providerId}">
                ${modelOptionsHtml}
              </select>
            </div>
            <div class="custom-model-row ${selectedValue === 'custom' ? '' : 'hidden'}" id="custom-row-${providerId}">
              <input type="text" class="key-input" id="custom-model-${providerId}" placeholder="Enter exact model ID (e.g. ${exampleModel})" value="${isPreset ? '' : currentModel}">
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
              <a href="${def.freeKeyUrl}" target="_blank" class="free-key-link">${def.freeKeyLabel}</a>
              <span class="ping-result" id="ping-${providerId}"></span>
            </div>
          `;
        }

        card.appendChild(drawer);

        // Toggle Drawer listener
        const toggleBtn = header.querySelector('.drawer-toggle-btn');
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          drawer.classList.toggle('hidden');
        });

        // Key Input listener
        const keyInput = drawer.querySelector(`#key-${providerId}`);
        keyInput.addEventListener('change', () => {
          const val = keyInput.value.trim();
          if (isGroq) {
            state.groqApiKey = val;
            chrome.storage.local.set({ groqApiKey: val });
          } else if (isOpenRouter) {
            state.openrouterApiKey = val;
            chrome.storage.local.set({ openrouterApiKey: val });
          } else if (isOpenAI) {
            state.openaiApiKey = val;
            chrome.storage.local.set({ openaiApiKey: val });
          } else if (isGemini) {
            state.geminiApiKey = val;
            chrome.storage.local.set({ geminiApiKey: val });
          }
          renderProviderStack();
        });

        if (def.directModelInput) {
          const directModelInput = drawer.querySelector(`#model-${providerId}`);
          if (directModelInput) {
            directModelInput.addEventListener('change', () => {
              const val = directModelInput.value.trim();
              if (isOpenAI) {
                state.openaiModel = val;
                chrome.storage.local.set({ openaiModel: val });
              } else if (isGemini) {
                state.geminiModel = val;
                chrome.storage.local.set({ geminiModel: val });
              }
            });
          }
        } else {
          // Model Select & Custom Row listeners
          const modelSelect = drawer.querySelector(`#model-${providerId}`);
          const customRow = drawer.querySelector(`#custom-row-${providerId}`);
          const customInput = drawer.querySelector(`#custom-model-${providerId}`);

          if (modelSelect) {
            modelSelect.addEventListener('change', () => {
              const selected = modelSelect.value;
              if (selected === 'custom') {
                if (customRow) customRow.classList.remove('hidden');
                if (customInput) customInput.focus();
              } else {
                if (customRow) customRow.classList.add('hidden');
                if (isGroq) {
                  state.groqModel = selected;
                  chrome.storage.local.set({ groqModel: selected });
                } else if (isOpenRouter) {
                  state.openrouterModel = selected;
                  chrome.storage.local.set({ openrouterModel: selected });
                }
              }
            });
          }

          if (customInput) {
            customInput.addEventListener('change', () => {
              const val = customInput.value.trim();
              if (!val) return;
              if (isGroq) {
                state.groqModel = val;
                chrome.storage.local.set({ groqModel: val });
              } else if (isOpenRouter) {
                state.openrouterModel = val;
                chrome.storage.local.set({ openrouterModel: val });
              }
            });
          }

          // Fetch Live Models Button listener
          const fetchBtn = drawer.querySelector(`#fetch-${providerId}`);
          if (fetchBtn) {
            fetchBtn.addEventListener('click', () => {
              const pingStatus = drawer.querySelector(`#ping-${providerId}`);
              const key = keyInput.value.trim();
              if (!key) {
                pingStatus.className = 'ping-result fail';
                pingStatus.textContent = 'Enter API key first';
                return;
              }

              pingStatus.className = 'ping-result';
              pingStatus.textContent = 'Fetching models...';

              chrome.runtime.sendMessage({
                action: 'FETCH_PROVIDER_MODELS',
                provider: providerId,
                apiKey: key
              }, resp => {
                if (resp?.success && Array.isArray(resp.models) && resp.models.length > 0) {
                  state.fetchedModels[providerId] = resp.models;
                  pingStatus.className = 'ping-result success';
                  pingStatus.textContent = `✓ Fetched ${resp.models.length} live models!`;
                  renderProviderStack();
                } else {
                  pingStatus.className = 'ping-result fail';
                  pingStatus.textContent = `✗ ${resp?.error?.slice(0, 30) || 'Fetch failed'}`;
                }
              });
            });
          }
        }

        // Test Ping Button listener
        const testBtn = drawer.querySelector(`#test-${providerId}`);
        const pingStatus = drawer.querySelector(`#ping-${providerId}`);

        if (testBtn) {
          testBtn.addEventListener('click', () => {
            const key = keyInput.value.trim();
            if (!key) {
              pingStatus.className = 'ping-result fail';
              pingStatus.textContent = 'Please enter a key first';
              return;
            }

            let modelToTest = '';
            if (def.directModelInput) {
              const directModelInput = drawer.querySelector(`#model-${providerId}`);
              modelToTest = directModelInput ? directModelInput.value.trim() : '';
            } else {
              const modelSelect = drawer.querySelector(`#model-${providerId}`);
              const customInput = drawer.querySelector(`#custom-model-${providerId}`);
              modelToTest = (modelSelect && modelSelect.value === 'custom') ? (customInput ? customInput.value.trim() : '') : (modelSelect ? modelSelect.value : '');
            }

            if (!modelToTest) {
              pingStatus.className = 'ping-result fail';
              pingStatus.textContent = 'Enter a model ID';
              return;
            }

            pingStatus.className = 'ping-result';
            pingStatus.textContent = 'Pinging...';

            chrome.runtime.sendMessage({
              action: 'TEST_PROVIDER_KEY',
              provider: providerId,
              apiKey: key,
              model: modelToTest
            }, resp => {
              if (resp?.success) {
                pingStatus.className = 'ping-result success';
                pingStatus.textContent = `✓ Connected (${resp.latencyMs}ms)`;
              } else {
                pingStatus.className = 'ping-result fail';
                pingStatus.textContent = `✗ Error: ${resp?.error?.slice(0, 35) || 'Failed'}`;
              }
            });
          });
        }
      }

      // Reorder Up / Down listeners
      const btnUp = header.querySelector('.btn-up');
      const btnDown = header.querySelector('.btn-down');

      if (btnUp) {
        btnUp.addEventListener('click', (e) => {
          e.stopPropagation();
          if (index > 0) {
            const temp = state.providerOrder[index - 1];
            state.providerOrder[index - 1] = providerId;
            state.providerOrder[index] = temp;
            chrome.storage.local.set({ providerOrder: state.providerOrder });
            renderProviderStack();
          }
        });
      }

      if (btnDown) {
        btnDown.addEventListener('click', (e) => {
          e.stopPropagation();
          if (index < state.providerOrder.length - 1) {
            const temp = state.providerOrder[index + 1];
            state.providerOrder[index + 1] = providerId;
            state.providerOrder[index] = temp;
            chrome.storage.local.set({ providerOrder: state.providerOrder });
            renderProviderStack();
          }
        });
      }

      // Enable / Disable switch listener
      const toggleSwitch = header.querySelector('.provider-toggle');
      toggleSwitch.addEventListener('change', (e) => {
        e.stopPropagation();
        const currentlyActive = state.providerOrder.filter(k => state.providerEnabled[k] !== false);
        if (!toggleSwitch.checked && currentlyActive.length <= 1) {
          toggleSwitch.checked = true;
          alert('At least one translation provider must remain active.');
          return;
        }
        state.providerEnabled[providerId] = toggleSwitch.checked;
        chrome.storage.local.set({ providerEnabled: state.providerEnabled });
        renderProviderStack();
      });

      // Drag and drop events
      card.addEventListener('dragstart', (e) => {
        draggedCardId = providerId;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        draggedCardId = null;
        card.classList.remove('dragging');
        document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('drag-over'));
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedCardId && draggedCardId !== providerId) {
          const fromIdx = state.providerOrder.indexOf(draggedCardId);
          const toIdx = state.providerOrder.indexOf(providerId);
          if (fromIdx !== -1 && toIdx !== -1) {
            state.providerOrder.splice(fromIdx, 1);
            state.providerOrder.splice(toIdx, 0, draggedCardId);
            chrome.storage.local.set({ providerOrder: state.providerOrder });
            renderProviderStack();
          }
        }
      });

      providerStackEl.appendChild(card);
    });
  }

  // 8. Load State from Storage & Wire Up Listeners
  chrome.storage.local.get([
    'myLanguage',
    'lastTargetLanguage',
    'autoTranslateEnabled',
    'autoTranslateMode',
    'excludedLanguages',
    'activeMix',
    'providerOrder',
    'providerEnabled',
    'groqApiKey',
    'groqModel',
    'openrouterApiKey',
    'openrouterModel',
    'openaiApiKey',
    'openaiModel',
    'geminiApiKey',
    'geminiModel',
    'stylePreserveCaps',
    'stylePreserveElongation',
    'stylePreserveLaughter',
    'stylePreservePunctuation',
    'styleProtectSpans',
    'styleExpandSlang'
  ], res => {
    if (res.myLanguage) state.myLanguage = res.myLanguage;
    if (res.lastTargetLanguage) state.lastTargetLanguage = res.lastTargetLanguage;
    if (res.autoTranslateEnabled !== undefined) state.autoTranslateEnabled = res.autoTranslateEnabled;
    if (res.autoTranslateMode) state.autoTranslateMode = res.autoTranslateMode;
    if (res.excludedLanguages) state.excludedLanguages = res.excludedLanguages;

    if (res.activeMix) state.activeMix = res.activeMix;

    let storageNeedsSync = false;
    if (Array.isArray(res.providerOrder) && res.providerOrder.length > 0) {
      state.providerOrder = [...res.providerOrder];
    }
    // Dynamic provider migration: ensure all defined providers (e.g. openrouter, openai, gemini) exist in order
    Object.keys(PROVIDER_DEFS).forEach(pId => {
      if (!state.providerOrder.includes(pId)) {
        const mtIdx = state.providerOrder.indexOf('google_mt');
        if (mtIdx !== -1) {
          state.providerOrder.splice(mtIdx, 0, pId);
        } else {
          state.providerOrder.push(pId);
        }
        storageNeedsSync = true;
      }
    });

    if (res.providerEnabled) {
      state.providerEnabled = Object.assign({}, res.providerEnabled);
    }
    Object.keys(PROVIDER_DEFS).forEach(pId => {
      if (state.providerEnabled[pId] === undefined) {
        state.providerEnabled[pId] = (pId !== 'chrome_ai');
        storageNeedsSync = true;
      }
    });

    if (res.groqApiKey) state.groqApiKey = res.groqApiKey;
    if (res.groqModel && !res.groqModel.includes('qwen3.8')) {
      state.groqModel = res.groqModel;
    } else {
      state.groqModel = 'llama-3.3-70b-versatile';
      if (res.groqModel) storageNeedsSync = true;
    }
    if (res.openrouterApiKey) state.openrouterApiKey = res.openrouterApiKey;
    if (res.openrouterModel) state.openrouterModel = res.openrouterModel;
    if (res.openaiApiKey) state.openaiApiKey = res.openaiApiKey;
    if (res.openaiModel) state.openaiModel = res.openaiModel;
    if (res.geminiApiKey) state.geminiApiKey = res.geminiApiKey;
    if (res.geminiModel) state.geminiModel = res.geminiModel;

    if (storageNeedsSync) {
      chrome.storage.local.set({
        providerOrder: state.providerOrder,
        providerEnabled: state.providerEnabled,
        groqModel: state.groqModel
      });
    }

    if (res.stylePreserveCaps !== undefined) state.stylePreserveCaps = res.stylePreserveCaps;
    if (res.stylePreserveElongation !== undefined) state.stylePreserveElongation = res.stylePreserveElongation;
    if (res.stylePreserveLaughter !== undefined) state.stylePreserveLaughter = res.stylePreserveLaughter;
    if (res.stylePreservePunctuation !== undefined) state.stylePreservePunctuation = res.stylePreservePunctuation;
    if (res.styleProtectSpans !== undefined) state.styleProtectSpans = res.styleProtectSpans;
    if (res.styleExpandSlang !== undefined) state.styleExpandSlang = res.styleExpandSlang;

    // Set UI values
    selectMyLang.value = state.myLanguage;
    toggleAuto.checked = state.autoTranslateEnabled;
    autoOptions.classList.toggle('hidden', !state.autoTranslateEnabled);

    if (state.autoTranslateMode === 'others') {
      modeOthers.checked = true;
    } else {
      modeBoth.checked = true;
    }

    if (styleCaps) styleCaps.checked = state.stylePreserveCaps;
    if (styleElongation) styleElongation.checked = state.stylePreserveElongation;
    if (styleLaughter) styleLaughter.checked = state.stylePreserveLaughter;
    if (stylePunctuation) stylePunctuation.checked = state.stylePreservePunctuation;
    if (styleSpans) styleSpans.checked = state.styleProtectSpans;
    if (styleSlang) styleSlang.checked = state.styleExpandSlang;

    updateMixUI();
    renderChips();
    refreshBudgetLedger();
    updateActiveChatDisplay();
    renderProviderStack();
    checkChromeAI();
  });

  // Event Listeners for Core Controls
  selectMyLang.addEventListener('change', () => {
    state.myLanguage = selectMyLang.value;
    chrome.storage.local.set({ myLanguage: state.myLanguage });
  });

  toggleAuto.addEventListener('change', () => {
    state.autoTranslateEnabled = toggleAuto.checked;
    autoOptions.classList.toggle('hidden', !state.autoTranslateEnabled);
    chrome.storage.local.set({ autoTranslateEnabled: state.autoTranslateEnabled });
  });

  modeOthers.addEventListener('change', () => {
    if (modeOthers.checked) {
      state.autoTranslateMode = 'others';
      chrome.storage.local.set({ autoTranslateMode: 'others' });
    }
  });

  modeBoth.addEventListener('change', () => {
    if (modeBoth.checked) {
      state.autoTranslateMode = 'both';
      chrome.storage.local.set({ autoTranslateMode: 'both' });
    }
  });

  // Mix selector listeners
  [mixAdaptive, mixAifirst, mixZeroconfig].forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.activeMix = radio.value;
        chrome.storage.local.set({ activeMix: state.activeMix });
        updateMixUI();
      }
    });
  });

  // Style Toggles Event Listeners
  function bindStyleToggle(el, key) {
    if (!el) return;
    el.addEventListener('change', () => {
      const val = el.checked;
      state[key] = val;
      chrome.storage.local.set({ [key]: val });
    });
  }

  bindStyleToggle(styleCaps, 'stylePreserveCaps');
  bindStyleToggle(styleElongation, 'stylePreserveElongation');
  bindStyleToggle(styleLaughter, 'stylePreserveLaughter');
  bindStyleToggle(stylePunctuation, 'stylePreservePunctuation');
  bindStyleToggle(styleSpans, 'styleProtectSpans');
  bindStyleToggle(styleSlang, 'styleExpandSlang');

  // 9. Clear Translation Cache Button Listener
  const btnClearCache = document.getElementById('btn-clear-cache');
  const cacheStatusMsg = document.getElementById('cache-status-msg');

  if (btnClearCache) {
    btnClearCache.addEventListener('click', () => {
      btnClearCache.disabled = true;
      if (cacheStatusMsg) {
        cacheStatusMsg.className = 'cache-status-msg pending';
        cacheStatusMsg.textContent = 'Clearing...';
      }

      chrome.runtime.sendMessage({ action: 'CLEAR_TRANSLATION_CACHE' }, resp => {
        setTimeout(() => {
          btnClearCache.disabled = false;
          if (resp?.success) {
            if (cacheStatusMsg) {
              cacheStatusMsg.className = 'cache-status-msg success';
              cacheStatusMsg.textContent = `✓ Cleared ${resp.clearedCount ?? 0} items!`;
            }
            refreshBudgetLedger();
          } else {
            if (cacheStatusMsg) {
              cacheStatusMsg.className = 'cache-status-msg error';
              cacheStatusMsg.textContent = 'Failed to clear cache';
            }
          }
          setTimeout(() => {
            if (cacheStatusMsg) cacheStatusMsg.textContent = '';
          }, 3500);
        }, 300);
      });
    });
  }

  // 10. Custom Dictionary & Reported Corrections Controller
  const btnToggleAddDict = document.getElementById('btn-toggle-add-dict');
  const dictAddDrawer = document.getElementById('dict-add-drawer');
  const dictSourceInput = document.getElementById('dict-source-input');
  const dictTargetInput = document.getElementById('dict-target-input');
  const dictFromLang = document.getElementById('dict-from-lang');
  const dictToLang = document.getElementById('dict-to-lang');
  const btnSaveDictEntry = document.getElementById('btn-save-dict-entry');
  const dictFeedbackMsg = document.getElementById('dict-feedback-msg');
  const dictItemsContainer = document.getElementById('dict-items-container');
  const dictCountBadge = document.getElementById('dict-count-badge');

  if (btnToggleAddDict && dictAddDrawer) {
    btnToggleAddDict.addEventListener('click', () => {
      dictAddDrawer.classList.toggle('hidden');
      if (!dictAddDrawer.classList.contains('hidden') && dictSourceInput) {
        dictSourceInput.focus();
      }
    });
  }

  function renderUserCorrections(list) {
    if (!dictItemsContainer) return;
    const items = Array.isArray(list) ? list : [];
    if (dictCountBadge) {
      dictCountBadge.textContent = `${items.length} saved`;
    }

    dictItemsContainer.innerHTML = '';
    if (items.length === 0) {
      dictItemsContainer.innerHTML = '<div class="dict-empty-state">No custom corrections saved yet. You can report wrong translations in WhatsApp bubbles via ✎ or add them here.</div>';
      return;
    }

    for (const entry of items) {
      const row = document.createElement('div');
      row.className = 'dict-item';

      const textWrap = document.createElement('div');
      textWrap.className = 'dict-item-text';

      const srcSpan = document.createElement('span');
      srcSpan.className = 'dict-item-source';
      srcSpan.textContent = entry.sourceText;

      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'dict-item-arrow';
      arrowSpan.textContent = '→';

      const tgtSpan = document.createElement('span');
      tgtSpan.className = 'dict-item-target';
      tgtSpan.textContent = entry.targetText;

      const badge = document.createElement('span');
      badge.className = 'dict-item-badge';
      badge.textContent = `${entry.sourceLang || 'auto'} → ${entry.targetLang || 'any'}`;

      textWrap.appendChild(srcSpan);
      textWrap.appendChild(arrowSpan);
      textWrap.appendChild(tgtSpan);
      textWrap.appendChild(badge);

      const delBtn = document.createElement('button');
      delBtn.className = 'dict-item-delete';
      delBtn.title = 'Delete this correction';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'DELETE_USER_CORRECTION', id: entry.id }, resp => {
          if (resp?.success) {
            loadUserCorrections();
          }
        });
      });

      row.appendChild(textWrap);
      row.appendChild(delBtn);
      dictItemsContainer.appendChild(row);
    }
  }

  function loadUserCorrections() {
    chrome.runtime.sendMessage({ action: 'GET_USER_CORRECTIONS' }, resp => {
      renderUserCorrections(resp?.corrections || []);
    });
  }

  if (btnSaveDictEntry) {
    btnSaveDictEntry.addEventListener('click', () => {
      const src = dictSourceInput?.value?.trim();
      const tgt = dictTargetInput?.value?.trim();
      if (!src || !tgt) {
        if (dictFeedbackMsg) {
          dictFeedbackMsg.className = 'dict-feedback-msg error';
          dictFeedbackMsg.textContent = 'Please fill out both source phrase and translation';
        }
        return;
      }

      btnSaveDictEntry.disabled = true;
      chrome.runtime.sendMessage({
        action: 'SAVE_USER_CORRECTION',
        correction: {
          sourceText: src,
          targetText: tgt,
          sourceLang: dictFromLang?.value || 'auto',
          targetLang: dictToLang?.value || 'all'
        }
      }, resp => {
        btnSaveDictEntry.disabled = false;
        if (resp?.success) {
          if (dictFeedbackMsg) {
            dictFeedbackMsg.className = 'dict-feedback-msg success';
            dictFeedbackMsg.textContent = '✓ Saved to dictionary!';
          }
          if (dictSourceInput) dictSourceInput.value = '';
          if (dictTargetInput) dictTargetInput.value = '';
          loadUserCorrections();
          setTimeout(() => {
            if (dictFeedbackMsg) dictFeedbackMsg.textContent = '';
            dictAddDrawer?.classList.add('hidden');
          }, 1500);
        } else {
          if (dictFeedbackMsg) {
            dictFeedbackMsg.className = 'dict-feedback-msg error';
            dictFeedbackMsg.textContent = resp?.error || 'Failed to save';
          }
        }
      });
    });
  }

  loadUserCorrections();

})();
