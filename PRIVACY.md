# Privacy Policy

**Effective Date:** October 28, 2026  
**Extension:** Omar Tariq's WhatsApp Translator (Translator for WhatsApp Web)  
**Developer:** Omar Tariq  

This privacy policy explains how **Omar Tariq's WhatsApp Translator** collects, uses, and protects your information.

---

## 1. Zero Tracking & No Data Collection
- We **do not** collect, store, sell, or transmit any personally identifiable information (PII).
- We **do not** use analytics trackers, telemetry scripts, cookies, or remote logging services.
- Your WhatsApp chats, contacts, profile photos, and voice notes are never accessed, monitored, or transmitted to any third party by the extension.

## 2. How Translation Data is Handled
- **On-Demand Processing**: Translation only executes when explicitly triggered (e.g., when you double-click a message bubble, use the input bar translation button, or enable the Auto-Translate toggle).
- **Direct-to-Provider Communication**:
  - Translation requests are routed strictly through the extension's background service worker to the translation endpoints chosen by the user (Google Translate API, Groq, Google Gemini, OpenAI, or OpenRouter).
  - No intermediate servers or proxy relays operated by the developer exist.
- **Local Storage Only**:
  - Per-chat language preferences, translation memory cache, and custom dictionary corrections are stored strictly on your local machine using the browser's `chrome.storage.local` API.
  - This data never leaves your device and can be wiped instantly by clicking **"Clear Translation Cache"** in the extension popup.

## 3. API Keys & Security
- Any AI API keys entered by the user (e.g., Groq, Gemini, OpenAI, OpenRouter) are saved exclusively in your browser's encrypted local extension storage (`chrome.storage.local`).
- API keys are transmitted solely over HTTPS directly to the official provider endpoints during translation requests.

## 4. Permissions Breakdown
- `storage`: Required to save your language preferences, translation memory, and custom corrections locally.
- Host Permission `https://web.whatsapp.com/*`: Required to detect chat messages and render native inline translation UI.
- Host Permissions `https://translate.googleapis.com/*`, `https://api.groq.com/*`, `https://generativelanguage.googleapis.com/*`, `https://openrouter.ai/*`, `https://api.openai.com/*`: Required to fetch translations directly from the respective translation and AI inference providers without page Content Security Policy (CSP) blocking.

## 5. Disclaimer
This extension is an independent open-source project by Omar Tariq and is not affiliated with, endorsed by, sponsored by, or associated with WhatsApp or Meta Inc.

## 6. Contact & Inquiries
For questions regarding this privacy policy or the extension, please open an issue on the official GitHub repository.
