# Multilingual Style-Preserving Translator: Implementation Spec (300 MB hard cap)

**Audience:** the coding agent implementing a WhatsApp Web translator browser extension.
**Supersedes:** `STYLE_TRANSLATION_SPEC.md` and `MULTILINGUAL_STYLE_SYSTEM_SPEC.md`. Where they conflict, this file wins.

---

## 0. Read this first

### 0.1 Hard constraints (non-negotiable)

| # | Constraint |
|---|---|
| C1 | **Everything the extension puts on the user's disk (package + downloaded models + wasm + caches) must stay ≤ 300 MB (300,000,000 bytes).** Target ≤ 270 MB. The code must enforce this at runtime (see §3). |
| C2 | **Zero model downloads by default.** The out-of-the-box experience is cloud MT + rules, which costs ~0 MB. Every model download is opt-in, shows its size first, and is deletable. |
| C3 | Works for **all languages** the MT provider supports. Style *restoration* quality varies per language; each language has an explicit support level (§8.4). Never advertise style support for a language that has not passed its acceptance gate (§12). |
| C4 | Every stage has a fallback. The worst case output is the plain machine translation, never a broken message. |
| C5 | Meaning must never change because of a style step. Numbers, names, links, mentions, and formatting markers survive or the style step is rejected. |

### 0.2 Evidence legend

Every external fact in this document is tagged:

- ✅ **Verified**: seen on the cited page during research for this spec.
- ⚠️ **Verify**: stated from general knowledge or inferred; the agent must confirm before relying on it. Each ⚠️ item has a matching task in §14.

### 0.3 Honest expectations

- Rules + language packs deliver most of the visible style fidelity (caps, punctuation, emoji, laughter, many elongations).
- A sub-300 MB model can help with **mood** in some languages but is small and will make mistakes. It is optional, gated per language, and always behind safety checks.
- Under a 300 MB cap, the **offline pair models (Tier 2)** and the **style model (Tier 3)** will normally **not fit together** (§2.3). The budget manager enforces this.

---

## 1. Architecture

### 1.1 Tiers

| Tier | What | Download | Default |
|---|---|---|---|
| **T0** | Cloud MT + rules + language packs | ~0 MB (packs bundled) | **ON** |
| **T1** | Browser-managed translation (Chrome Translator API) | Managed by Chrome, not by us | Opt-in, desktop Chrome only |
| **T2** | Offline pair models (Opus-MT ONNX, ~80–95 MB per language pair) | On demand | Off |
| **T3** | Style model (one small GGUF LLM, ~230–260 MB) | On demand | Off |

### 1.2 Pipeline

```
 WhatsApp DOM text
        │
 [0] Extract + protect spans   (URLs, @mentions, *bold*, _italic_, ~strike~, `code`, numbers)
 [1] Detect source language    (Chrome LanguageDetector → fastText lid.176.ftz → script heuristics)
 [2] Load language pack(s)     (source + target)
 [3] Extract style profile     (caps, elongation, punctuation, emoji, laughter, acronyms)
 [4] Expand slang/acronyms     (pack dictionary, source language side)
 [5] Meaning translation       (T0 cloud | T1 Chrome | T2 Opus-MT)
 [6] Style restoration         (rules, language-aware, always on)
 [7] Optional mood pass        (T3 model; tagger first, restyler only after gate)
 [8] Safety checks             (reject → fall back to step [5] output)
 [9] Restore protected spans → render
```

### 1.3 Decision logic

```
translate(msg):
  provider = pickProvider(settings, availability)   // cloud | chrome | opusPair | none
  base = provider.translate(prepared)               // fallback chain: provider → cloud → original + error badge
  styled = restoreRules(base, profile, packs)       // always
  if settings.aiPass && t3Installed && packs[target].tier3Enabled:
      cand = moodPass(styled, profile, tone)
      if passesSafety(cand, styled, profile): styled = cand
  return styled
```

---

## 2. Size budget

### 2.1 Ledger

The budget manager (§3) tracks:

| Item | Budget |
|---|---|
| Extension package (code, bundled packs, wasm, lid model) | **≤ 15 MB** (⚠️ measure the wllama wasm; target to confirm) |
| fastText `lid.176.ftz` (optional bundle) | 0.9 MB ✅ |
| T2 pair models | ~80–95 MB each ✅ |
| T3 model | 219–260 MB files, see §4 ✅ |
| Cache overhead / duplicates | **0 MB allowed**: delete temp downloads; never keep two copies |

### 2.2 Rules

1. Hard cap **300,000,000 bytes**; warn the user above 270,000,000.
2. Before any download: `projected = current_total + file_size`. If `projected > cap`, refuse and offer to remove an installed model.
3. After any download: measure real usage (`navigator.storage.estimate()` plus the manifest sizes). If the real total exceeds the cap, delete the new file and show an error. Never leave the extension over cap.
4. Model files are stored once, in one place (Cache Storage or OPFS). No duplicate copies in IndexedDB.

### 2.3 What fits (computed from verified sizes)

| Configuration | Approx. total |
|---|---|
| T0 only | package ≤ 15 MB |
| T0 + 1 Opus pair | ~15 + 95 = **110 MB** |
| T0 + 2 Opus pairs | ~15 + 190 = **205 MB** |
| T0 + 3 Opus pairs | ~15 + 285 = **300 MB**, at/over cap, **disallow the third in practice** |
| T0 + LFM2-350M Q4_K_M | ~15 + 229 = **244 MB** |
| T0 + Gemma 3 270M IT Q4_K_M | ~15 + ~250 = **~265 MB** (size inferred, see §4.2) |
| T3 + any Opus pair | **> 300 MB → blocked by the budget manager** |

So the user effectively chooses: **offline pairs** *or* **style model**. UI must explain this plainly and allow swapping.

---

## 3. Budget manager (required component)

```ts
// budget.ts
export const HARD_CAP = 300_000_000;   // bytes, decimal MB to stay conservative
export const WARN_AT  = 270_000_000;

export interface ModelEntry {
  id: string;          // e.g. "lfm2-350m-q4km"
  bytes: number;       // exact size from the manifest (pinned)
  installed: boolean;
}

export async function currentUsageBytes(manifest: ModelEntry[], packageBytes: number): Promise<number> {
  const models = manifest.filter(m => m.installed).reduce((s, m) => s + m.bytes, 0);
  return packageBytes + models;
}

export async function canInstall(entry: ModelEntry, manifest: ModelEntry[], packageBytes: number) {
  const used = await currentUsageBytes(manifest, packageBytes);
  const projected = used + entry.bytes;
  return {
    ok: projected <= HARD_CAP,
    projected,
    warn: projected > WARN_AT,
    shortBy: Math.max(0, projected - HARD_CAP),
  };
}

// Verify real disk usage after install; throw if over cap.
export async function assertWithinCap() {
  const est = await navigator.storage.estimate();   // usage includes caches; allow ~5% slack for browser accounting
  if ((est.usage ?? 0) > HARD_CAP * 1.05) throw new Error("Storage over cap");
}
```

**Tests required:** (a) install refused when projected > cap; (b) warning shown above 270 MB; (c) removing a model frees budget; (d) T3 + Opus pair combination refused.

---

## 4. Resource manifest (verified downloads)

### 4.1 Overview table

| Role | Resource | Exact file(s) | Size | License | Status |
|---|---|---|---|---|---|
| Style model (primary) | LiquidAI **LFM2-350M-GGUF** | `LFM2-350M-Q4_K_M.gguf` | **229 MB** | LFM license ("lfm1.0" listed) | ✅ size; ⚠️ read license terms |
| Style model (smaller) | same repo | `LFM2-350M-Q4_0.gguf` | **219 MB** | same | ✅ |
| Style model (bigger, still fits) | same repo | `LFM2-350M-Q5_K_M.gguf` | **260 MB** | same | ✅ (leaves ~25 MB headroom incl. package; avoid) |
| Style model (alt.) | **unsloth/gemma-3-270m-it-GGUF** | `gemma-3-270m-it-Q4_K_M.gguf` | **~250 MB** (inferred) | Gemma Terms of Use | ✅ filename; ⚠️ confirm exact size |
| Offline MT (per pair) | **Xenova/opus-mt-{src}-{tgt}** (ONNX, Transformers.js) | `onnx/…` + tokenizer files | **~80–95 MB** per pair | ⚠️ check each model card (Helsinki-NLP) | ✅ sizes sampled |
| Language ID | fastText **lid.176.ftz** | `lid.176.ftz` | **917 kB** | CC BY-SA 3.0 | ✅ |
| Browser translation | Chrome **Translator API** + **LanguageDetector API** | n/a (browser-managed) | not ours | n/a | ✅ availability; ⚠️ per-language pack sizes unknown |
| LLM runtime | **wllama** (`@wllama/wllama`) | npm | ⚠️ measure wasm | ⚠️ check | ✅ exists |
| ONNX runtime | **@huggingface/transformers** | npm | ⚠️ measure | ⚠️ check | ✅ exists |

### 4.2 Evidence and links

**LFM2-350M GGUF (primary T3 candidate)**
- Repo: `https://huggingface.co/LiquidAI/LFM2-350M-GGUF` ✅
- Files and sizes seen: `Q4_0` 219 MB, `Q4_K_M` 229 MB, `Q5_K_M` 260 MB, `Q6_K` 293 MB, `Q8_0` 379 MB, `F16` 711 MB ✅. **Only Q4_0 and Q4_K_M are recommended under the cap.** Q6_K (293 MB) cannot coexist with the package. Q8_0 and F16 are over the cap.
- Language coverage: the newer **LFM2.5-350M** model is described as supporting English, Arabic, Chinese, French, German, Japanese, Korean, Portuguese, Spanish ✅ (third-party model page). ⚠️ Confirm the language list on the official LFM2-350M card, and decide whether to adopt LFM2.5-350M (a `LFM2.5-350M-Q4_K_M.gguf` filename was seen in a benchmark list ✅; its official repo and size are ⚠️ unverified).
- Download URL pattern: `https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q4_K_M.gguf` (pattern ✅ from other HF repos; ⚠️ pin to a commit hash).

**Gemma 3 270M IT GGUF (alternate T3 candidate)**
- Repo: `https://huggingface.co/unsloth/gemma-3-270m-it-GGUF` ✅
- Filenames seen: `gemma-3-270m-it-Q4_K_M.gguf`, `-Q4_0`, `-Q5_K_M`, `-Q6_K`, `-Q8_0`, `-IQ4_XS`, `-UD-Q4_K_XL`, others ✅.
- Size: no direct size seen for this exact file. Evidence from same-architecture files: FunctionGemma 270M Q4_K_M is 0.25 GB and Q8_0 is 0.29 GB ✅; a Gemma 3 270M Q8_0 file is quoted at ~292 MB ✅. So **Q4_K_M ≈ 250 MB (inferred)**. ⚠️ Read the real size from the repo before pinning. **Q8_0 (~292 MB) is excluded**: no headroom.
- License: Gemma Terms of Use ✅ (`https://ai.google.dev/gemma/terms`). ⚠️ Confirm that a browser extension distributing downloads is permitted.
- ⚠️ **Do not run the ONNX build in the browser.** A reported ONNX Runtime issue (#26732) shows unusable output for Gemma 3 270M ONNX at fp16 and q4f16 on WebGPU and wasm ✅. Use the **GGUF via wllama** instead.

**Opus-MT ONNX pairs (T2)**
- Pattern: `Xenova/opus-mt-{src}-{tgt}`, loaded with `pipeline('translation', 'Xenova/opus-mt-fr-ro')` ✅. Example repos seen: `Xenova/opus-mt-en-ro`, `Xenova/opus-mt-fr-ro` ✅.
- Older quantized layout sampled (folder totals): `opus-mt-it-en` 95.2 MB, `opus-mt-fi-en` 82.6 MB, `opus-mt-en-mul` 84.9 MB; `model.onnx` alone: de-en 76.4 MB, en-fi 79.9 MB ✅. **Budget 95 MB per pair as the planning number.**
- Multi-target models (`en-mul`, `mul-en`) need a target-language token and have lower quality than dedicated pairs ⚠️. Prefer dedicated pairs.
- ⚠️ Not every language pair exists. The agent must enumerate available pairs at build time (HF API) and ship a `pairs.json`; do not assume coverage.
- ⚠️ Pin an exact dtype (`q8` or `q4`) and file set; measure the real bytes downloaded.

**fastText language ID**
- `lid.176.ftz`, 917 kB, 176 languages, CC BY-SA 3.0 ✅ (`https://fasttext.cc/docs/en/language-identification.html`). The `.bin` is 126 MB and **must not be used** (over budget).
- Accuracy note: the compressed model is less accurate on very short text and closely related languages ✅. Chat messages are short, so use it only as a fallback and combine with script detection and the Chrome detector.
- ⚠️ The `.ftz` download URL is expected to mirror the verified `.bin` path (`https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz`). Confirm it. ⚠️ A maintained JS/WASM fastText reader is needed. Pick one and verify its size and license, or skip this fallback and rely on the Chrome detector plus script heuristics.
- CC BY-SA means attribution and share-alike apply to the model file ⚠️. Review before bundling.

**Chrome built-in APIs**
- Translator API and LanguageDetector API are stable from **Chrome 138** ✅ (`https://developer.chrome.com/docs/ai/built-in-apis`). They work in desktop Chrome and **not on mobile** ✅. The model downloads on first use and `Translator.availability()` reports `downloadable` when a download is needed ✅.
- The Prompt API (Gemini Nano) is listed for extensions ✅, but **it is excluded from this design**: its download is far larger than our cap ⚠️ (size not verified here), and it is not ours to control. Do not use it.
- ⚠️ The Translator API's per-language download sizes are unknown. Treat T1 as opt-in with a clear disclosure: "Chrome will download its own translation files; this is separate from this extension."

**wllama (runs GGUF in the browser)**
- `https://github.com/ngxson/wllama`, npm `@wllama/wllama` ✅. Runs llama.cpp in WebAssembly with SIMD, no GPU required ✅. Multi-thread needs COOP/COEP headers ✅. `loadModelFromUrl` and `loadModelFromHF` exist ✅.
- A compatibility build `@wllama/wllama-compat` exists for browsers lacking JSPI or MEMORY64 ✅. ⚠️ This implies the current build may require those features; check the browser matrix before shipping and wire in the compat fallback.
- ⚠️ Confirm exact API names (`createCompletion`, sampling options, chat-template helpers) against the installed version.

**Considered and excluded (over the cap or out of scope)**
- Qwen2.5-0.5B-Instruct Q4_K_M ≈ 491 MB ✅ (too large). Qwen3-0.6B Q4 is reported around 350–480 MB in third-party notes ⚠️ (too large either way).
- NLLB-200 distilled 600M, 4-bit ≈ 316 MB (third-party figure ⚠️): over the cap.
- Tiny Aya (3.35B), Index-Translate, GemmaX2-28-2B, Hy-MT2 and similar: all far over the cap.
- SenseVoice-Small GGUF (139–241 MB depending on quant) ✅ is out of scope: voice transcription would blow the budget.

### 4.3 `models.manifest.json` (template the agent must fill and commit)

```json
{
  "schema": 1,
  "capBytes": 300000000,
  "models": [
    {
      "id": "lfm2-350m-q4km",
      "role": "style-model",
      "runtime": "wllama",
      "url": "https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/<PINNED_COMMIT>/LFM2-350M-Q4_K_M.gguf",
      "bytes": "TO_FILL_EXACT",
      "sha256": "TO_FILL",
      "approxMB": 229,
      "license": "LFM license (read and record terms)",
      "languages": ["en","ar","zh","fr","de","ja","ko","pt","es"],
      "languagesStatus": "verify-on-official-card"
    },
    {
      "id": "gemma3-270m-it-q4km",
      "role": "style-model",
      "runtime": "wllama",
      "url": "https://huggingface.co/unsloth/gemma-3-270m-it-GGUF/resolve/<PINNED_COMMIT>/gemma-3-270m-it-Q4_K_M.gguf",
      "bytes": "TO_FILL_EXACT",
      "sha256": "TO_FILL",
      "approxMB": 250,
      "license": "Gemma Terms of Use"
    },
    {
      "id": "opus-en-es-q8",
      "role": "mt-pair",
      "runtime": "transformers.js",
      "hfRepo": "Xenova/opus-mt-en-es",
      "dtype": "q8",
      "bytes": "TO_FILL_EXACT_SUM_OF_FILES",
      "approxMB": 95,
      "pair": ["en","es"]
    }
  ]
}
```

### 4.4 `scripts/pin-models.mjs` (required build step)

For every manifest entry the script must: resolve the repo's current commit hash; compute **exact file sizes** and **SHA-256**; write them into the manifest; fail the build if any model exceeds the cap or if sum(selected defaults) + package size > cap. The runtime downloader **verifies SHA-256** and rejects mismatches.

### 4.5 Hosting

- Preferred: **mirror the pinned files on your own CDN/storage** (license permitting) so downloads are fast, versioned, and not subject to third-party rate limits.
- If downloading from Hugging Face directly: ⚠️ HF redirects large files to a separate CDN host; confirm the extension's `host_permissions` and CORS cover the final host. Test from a real installed extension, not from `localhost`.
- Downloads must be **resumable** (HTTP Range) and cancelable, with a visible progress bar and the byte size shown **before** starting.

---

## 5. Extension architecture (Chrome/Edge MV3 assumed)

> ⚠️ The browser target was not specified. This section assumes Chromium MV3. If Firefox is required, tell the user: Chrome's built-in AI APIs (T1) will not exist there, and the wasm/worker setup differs.

### 5.1 Components

| Component | Responsibility |
|---|---|
| **Content script** (WhatsApp Web) | Read message text nodes, add the translate button/overlay, send text to the service worker. **No model code here.** WhatsApp's page environment is hostile and changes often. |
| **Service worker** | Orchestration, settings, provider selection, budget manager, download manager. Must be stateless-tolerant (it can be killed). |
| **Offscreen document** | Hosts wllama and Transformers.js (needs a DOM, workers, and long-lived memory). ⚠️ Choose a valid `chrome.offscreen` reason and verify current rules in the Chrome docs. |
| **Options page** | Language packs, model manager (install/remove, sizes, budget bar), settings, privacy text. |
| **Language pack loader** | Loads JSON packs bundled in the package, merges source+target, validates schema. |

### 5.2 Manifest essentials

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "offscreen", "unlimitedStorage"],
  "host_permissions": [
    "https://web.whatsapp.com/*",
    "https://translate.googleapis.com/*"
  ],
  "optional_host_permissions": [
    "https://huggingface.co/*"
  ],
  "content_scripts": [{
    "matches": ["https://web.whatsapp.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

- ⚠️ Multi-threaded wasm needs cross-origin isolation of the extension page hosting it. MV3 provides manifest keys for this; verify the exact keys in the current Chrome extension docs. If isolation is unavailable, run single-thread (slower but works).
- ⚠️ Verify the default MV3 CSP allows wasm for extension pages (`'wasm-unsafe-eval'`) and do not loosen it further.
- `optional_host_permissions` so the model-host permission is requested only when the user starts a download.
- `unlimitedStorage` is requested so the browser does not evict the model; the **budget manager still enforces 300 MB**.

### 5.3 Messaging contract

```ts
type Req =
  | { type: "TRANSLATE", id: string, text: string, target: string, source?: string, opts: Opts }
  | { type: "MODEL_STATUS" }
  | { type: "MODEL_INSTALL", modelId: string }
  | { type: "MODEL_REMOVE", modelId: string };

type Res =
  | { type: "RESULT", id: string, text: string, stages: StageLog, fellBack: boolean }
  | { type: "ERROR", id: string, code: string, message: string };
```

`StageLog` records which stages ran and which safety checks failed (for debugging and the test suite; never shown to the user).

### 5.4 WhatsApp DOM handling

- Selectors are fragile. Keep them in **one** file (`selectors.ts`) with a self-test that reports when they stop matching.
- Message text may contain emoji rendered as images with the emoji in an attribute (⚠️ verify the current DOM). Convert them back to Unicode before profile extraction.
- Preserve WhatsApp formatting markers: `*bold*`, `_italic_`, `~strike~`, `` `code` ``, and triple-backtick blocks. Treat them as protected spans (§6.1).
- Translate only on user action (click or per-chat toggle). Do not auto-translate every message by default.

---

## 6. Pipeline details

### 6.1 Protected spans (step 0 and 9)

Replace these with placeholders before translation and restore after:

| Span | Pattern note |
|---|---|
| URLs | standard URL regex |
| @mentions and phone numbers | `@\S+`, digit runs with `+` |
| WhatsApp formatting | `*…*`, `_…_`, `~…~`, `` `…` `` |
| Numbers | `\p{Nd}+` with separators |
| Code blocks | triple-backtick blocks |

⚠️ **MT engines may mangle placeholders.** Implement two strategies and pick per provider after testing: (A) placeholder tokens such as `⟦0⟧`; (B) split the text at protected spans, translate segments separately, and rejoin. If a placeholder is missing from the MT output, fall back to strategy B for that message. Record the placeholder survival rate per provider in the test report.

### 6.2 Language detection (step 1)

Order of attempts:
1. **User-set source language** (per chat), if any.
2. **Chrome `LanguageDetector`** when available ✅.
3. **Script heuristics** (Unicode block ratios): decisive for Arabic, Hebrew, Thai, Devanagari, Hangul, Kana, Han, Cyrillic, Greek, and so on.
4. **fastText `lid.176.ftz`** for Latin-script disambiguation ✅ (⚠️ needs a JS reader).
5. Cloud MT auto-detect (`sl=auto`) as the final fallback.

Rules: if confidence is low or the text is under ~12 letters, prefer the chat's previous detected language. Mixed-language messages (code-switching such as Spanglish or Arabizi) are common: do not assume one language; when uncertain, skip slang expansion for that message (§6.4).

### 6.3 Style profile extraction (step 3)

Write against Unicode properties, not English assumptions.

```ts
export interface StyleProfile {
  cased: boolean;               // script has case
  allCaps: boolean;
  capsWords: string[];
  elongations: { text: string; base: string; run: number; tokenIndex: number }[];
  tatweel: boolean;             // Arabic-script elongation char used
  trailingPunct: string;        // e.g. "?!", "...", "!!!", "？", "！"
  runsInside: string[];         // punctuation runs inside the text
  emoji: string[];
  emojiPlacement: "end" | "inline" | "mixed" | "only";
  laughter: { text: string; kind: string }[];   // from pack patterns
  acronyms: string[];
  exclaims: number;
  questions: number;
  tone: Tone;                   // rule-based first
}

const RX = {
  letter: /\p{L}/u,
  upper: /\p{Lu}/u,
  lower: /\p{Ll}/u,
  emoji: /\p{Extended_Pictographic}/u,
  elong: /(\p{L})\1{2,}/gu,          // letter repeated ≥3 times
  tatweel: /\u0640{2,}/u,            // Arabic tatweel
  trail: /[!?.…！？。؟]+\s*$/u,
};

export function isAllCaps(text: string): boolean {
  let up = 0, lo = 0;
  for (const ch of text) { if (RX.upper.test(ch)) up++; else if (RX.lower.test(ch)) lo++; }
  const cased = up + lo;
  return cased >= 4 && up / cased >= 0.8;   // scripts without case never trigger
}
```

Rules:

- **Caps:** only for cased scripts; need ≥ 4 cased letters so "OK" and "LOL" alone do not trigger full-caps.
- **Elongation:** ≥ 3 identical letters in a row, excluding pack-listed legitimate triples and excluding digits, URLs, mentions. Record `base` (collapsed to the shortest plausible form, using the pack) and `run`.
- **Laughter:** matched from the pack's `laughter.patterns` (for example `jaja`, `haha`, `ㅋㅋ`, `wkwk`, `www`, `哈哈`, `555`). Laughter is **not** elongation and has its own mapping.
- **Emoji:** capture sequences (ZWJ and variation selectors) as units.
- Strip protected spans before running any detection.

### 6.4 Slang and acronym expansion (step 4)

- Runs on the **source** text with the **source pack**.
- Whole-token matching only, case-insensitive for the key, using Unicode-aware boundaries (`\b` is unreliable for non-Latin scripts; use `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])`).
- Replace with the pack's plain `expansion` in the **source** language (so MT sees real words), and record the original in the profile.
- Skip expansion if the token is ambiguous with a normal word in that language and the pack marks it `ambiguous: true`, unless a context rule fires.
- Skip entirely when language detection confidence is low (code-switching).
- Vulgar entries are expanded only if the user disabled the vulgarity filter; otherwise left as-is.

### 6.5 Meaning translation (step 5)

| Provider | Notes |
|---|---|
| **Cloud (default)** | ⚠️ The free Google endpoint (`translate.googleapis.com/translate_a/single`, `client=gtx`) is **unofficial** and can break or change terms without notice. Wrap it behind a `Provider` interface and ship a documented alternative (the official Cloud Translation API with a user-supplied key). Privacy text must say message text is sent to the provider. |
| **Chrome Translator (T1)** ✅ | `Translator.availability()` → create with `{sourceLanguage, targetLanguage}` → `translate()`. Desktop only. Show a download disclosure. |
| **Opus-MT pair (T2)** ✅ | Transformers.js `pipeline('translation', model)`. Only for installed pairs. Literal and formal; the rules layer matters most here. |

Rules: never send style instructions to MT; send clean text. Never strip emoji or punctuation before MT (restore anyway in step 6). On empty result or error, fall through the provider chain, then show the original with an error badge (in the UI, not in the message text).

### 6.6 Style restoration (step 6, always on)

Apply in this order. Each rule is skipped if the target pack says it does not apply.

1. **Caps:** if `allCaps` and the target script is cased and the pack allows it, uppercase with the target locale (`toLocaleUpperCase(targetLang)`, which matters for Turkish `i/İ`). If the target script has no case, **do not** uppercase; instead rely on punctuation and elongation for emphasis (pack `caps_strategy`).
2. **Partial caps:** uppercase only the translated word aligned to each source caps word, when alignment is trustworthy (§6.7); otherwise skip.
3. **Laughter:** map each source laughter token to the target language's natural form via pack `laughter.map`, keeping the repeat intensity (`hahahaha` → `jajajaja`).
4. **Elongation:** see §6.7.
5. **Trailing punctuation:** replace the translation's trailing run with the source's run, **converted to the target convention** (¿…? / ¡…! for Spanish, `？` `！` for Chinese/Japanese, `؟` for Arabic-script languages).
6. **Internal runs** (`?!`, `...`): reinsert only if sentence counts match.
7. **Emoji:** reinsert missing emoji per `emojiPlacement`. Emoji-only messages pass through untouched.
8. **Exclamation/question counts:** top up at the final sentence end if the source had more.

### 6.7 Elongation restoration (hard part, do it conservatively)

Alignment is unreliable. Use this strategy:

1. **Short messages (≤ 8 tokens) or single-token messages:** align by relative token position.
2. **Longer messages:** only act if the elongated source word's `base` is in the pack's `intensifiers`/`interjections` map **and** the mapped target word appears in the translation exactly once.
3. Stretch the **target** word to `min(run, 6)`:
   - Latin/Cyrillic/Greek and similar: repeat the **last vowel** of the word (use the pack's `vowels` regex; if absent, repeat the final letter).
   - Arabic-script: insert tatweel `ـ` after a connecting letter, `min(run, 5)` times.
   - CJK, Thai and others: do **not** stretch letters; use the pack's `elongation_marker` if defined (for example Japanese `〜` / `ー`), otherwise skip.
4. Never stretch a word that is not in the pack map. When unsure, leave the word unchanged.

```ts
export function stretchWord(word: string, run: number, pack: Pack): string {
  const n = Math.min(Math.max(run, 3), 6);
  if (pack.script === "Arab") {
    // insert tatweel after the first connecting letter; keep it simple and test per language
    return word.replace(/(\p{L})(?=\p{L})/u, m => m + "\u0640".repeat(n - 1));
  }
  if (pack.elongation_marker) return word + pack.elongation_marker.repeat(Math.min(n, 3));
  if (!pack.vowels) return word;                       // skip if no rule
  const re = new RegExp(`(${pack.vowels})(?!.*(?:${pack.vowels}))`, "iu"); // last vowel
  return word.replace(re, v => v.repeat(n));
}
```

### 6.8 Mood pass (step 7, optional, T3 only)

Two modes. **Ship Mode A first. Enable Mode B per language only after its gate passes (§12.4).**

**Mode A: tone tagger (low risk).** The model outputs one label from a fixed list; code uses it to pick restoration options and decide whether Mode B should run.

```
Classify the tone of this chat message. Answer with exactly one word from:
neutral, excited, angry, sad, flirty, playful, sarcastic, formal, affectionate, anxious.

Message: {source_text}
Answer:
```

Decode with temperature 0 and a very small `nPredict` (about 3). Parse by prefix match against the label list; on no match, use the rule-based tone. Never trust free-form output.

**Mode B: restyler (higher risk).** Input is the **already translated and rule-restored** text plus explicit style instructions. The model **must not translate**.

```
You are editing the style of a chat message written in {target_lang}.
Do not translate. Do not change the meaning. Do not add or remove information.

Message: {styled}
Tone: {tone}
Style notes: {notes}

Rules:
- Keep every name, number, link, mention, emoji, and formatting symbol exactly as is.
- Only adjust casualness, intensity, and wording to fit the tone, as a native speaker would text it.
- If the message already fits, return it unchanged.
- Output only the message.
```

`{notes}` is generated from the profile (for example "all caps", "keep the stretched word", "end with ?!", "playful, informal"). Use the model's **own chat template** (⚠️ read it from the GGUF metadata or the model card; do not hand-write it if the runtime can apply it). Decoding: temperature 0 to 0.2, `nPredict` ≈ 1.5 × input tokens + 16, stop at end-of-turn.

Few-shot examples (2 to 3, in the **target language**, from the pack's `fewshot` field) improve small-model behavior. Keep them short to protect latency.

### 6.9 Safety checks (step 8)

Reject the candidate and use the previous safe text if **any** fails:

| Check | Rule |
|---|---|
| Empty | empty or whitespace |
| Length ratio | candidate/base length within 0.4 to 2.5 (use a 0.25 to 3 range for CJK/Thai by **character count**) |
| Protected spans | every placeholder, number, URL, mention, and formatting marker from the base is present |
| Emoji | count not lower than in the base |
| Commentary | begins with a refusal or preamble (per-language phrase list such as "Sure", "Here is", "Translation:") or wraps the whole text in quotes |
| Script | contains letters of the target script (catches replies in the wrong language) |
| Identity | if the output equals the **source** text and the languages differ, treat as failure |
| Latency | exceeds the budget (default 4 s on mid-range desktop) → abort and keep base |

---

## 7. Language packs

### 7.1 Structure

```
packs/
  _schema.json
  en.json   es.json   ar.json   ja.json   ko.json   zh.json   fr.json   de.json   pt.json
  ru.json   tr.json   hi.json   id.json   it.json   …
  variants/  es-MX.json  es-AR.json  ar-EG.json  en-GB.json  pt-BR.json …
```

Variants inherit from the base pack and override. Packs are **bundled** (JSON, small) and count against the 15 MB package budget; check the total.

### 7.2 Schema

```json
{
  "lang": "es",
  "script": "Latn",
  "dir": "ltr",
  "caps": { "supported": true, "strategy": "uppercase" },
  "vowels": "aeiouáéíóúü",
  "elongation": { "marker": null, "tatweel": false, "legitTriples": [] },
  "punct": { "question": ["¿", "?"], "exclaim": ["¡", "!"], "ellipsis": "…" },
  "laughter": {
    "patterns": ["j[aeiou]{2,}", "ja(ja)+", "jaja+", "xd+"],
    "map": { "haha": "jaja", "lol": "jaja", "lmao": "jajaja" }
  },
  "acronyms": {
    "xq": { "expansion": "porque", "register": "informal" },
    "tqm": { "expansion": "te quiero mucho", "register": "informal" }
  },
  "slang": {
    "chido": { "meaning": "genial", "register": "slang", "region": "MX", "ambiguous": false }
  },
  "intensifiers": { "no": "no", "sí": "sí", "muy": "muy", "tan": "tan", "hola": "hola" },
  "commentaryPhrases": ["Claro", "Aquí está", "Traducción:"],
  "fewshot": [
    { "tone": "excited", "text": "¡¡Sííí!! ¡¡Lo logramos!! 🎉" }
  ],
  "tier3": { "enabled": false, "gate": "not-run" },
  "review": { "status": "draft", "by": null, "date": null }
}
```

Required: `lang`, `script`, `caps`, `laughter`, `acronyms`, `review`. Everything else optional.

### 7.3 Language-specific rules (must be implemented in the core or per-pack)

| Language family | Rule |
|---|---|
| **Arabic, Persian, Urdu** | No case. Elongation uses tatweel `ـ`. Question mark `؟`. Keep RTL; do not break bidi order when restoring emoji/punctuation (use Unicode bidi marks if needed). Arabizi (Latin-script Arabic with digits like 3, 7) is common in chat: detect and mark `code-switching`; skip slang expansion. |
| **Hebrew** | No case, RTL. |
| **Hindi and Indic scripts** | No case. Hinglish (romanized Hindi) is common: treat as code-switching. |
| **Chinese, Japanese, Korean** | No case. Laughter: `哈哈`, `www`/`ｗｗｗ`, `ㅋㅋㅋ`, `ㅎㅎ`, `555` (Thai). Full-width `！？`. Japanese `〜` and `ー` are elongation markers. Character-count length checks. |
| **Spanish, Portuguese, French** | Preserve/restore `¿ ¡`. Stretch the last vowel (`holaaa`, `siiii`). Note French typographic spacing before `? !` is not needed in chat; do not add it. |
| **German** | Nouns are capitalized: **never** treat that as caps emphasis. |
| **Turkish** | Locale-aware upper/lower casing (`İ`/`ı`). |
| **Russian, Ukrainian** | Elongation and caps are common; Cyrillic vowels in `vowels`. |
| **Thai, Vietnamese, Lao** | Do not strip tone marks or normalize aggressively. Thai has no spaces: tokenization-based alignment does not apply, so skip elongation restoration except laughter (`555`). |
| **Indonesian, Malay, Tagalog** | Pack must cover `wkwk`, `haha`, `kwkw`, common abbreviations (`yg`, `gk`, `dgn`, `bgt`). |

### 7.4 Sourcing pack content

The agent cannot invent slang. Use this process:

1. **Draft** acronyms, slang, laughter, and intensifiers per language with a **large model at development time** (offline, not shipped), outputting the schema above. This is allowed and efficient, but it is **draft quality**.
2. **Cross-check** against open, license-compatible sources: Wiktionary slang/abbreviation categories (⚠️ CC BY-SA; check obligations), Tatoeba (⚠️ check license), OPUS subtitle corpora for real informal usage (⚠️ check per-corpus license).
3. **Native-speaker review** is mandatory before a pack's `review.status` becomes `reviewed`. Drafts ship **only** behind a visible "experimental language" setting.
4. Every entry needs `register`; vulgar entries are marked and filtered by default.
5. Packs have a version and a changelog. Slang ages quickly; schedule reviews.

---

## 8. Quality tiers per language

### 8.1 Support levels (shown in the options page)

| Level | Meaning |
|---|---|
| **Basic** | Meaning only (cloud MT). No claims about style. |
| **Rules** | Pack exists (draft or reviewed); rule-based restoration enabled. |
| **Rules + AI** | Tier 3 gate passed for this language. |

### 8.2 Default assignments

- All languages start at **Basic** until a pack exists.
- A language becomes **Rules** when its pack validates against the schema and passes the §12 rule tests.
- A language becomes **Rules + AI** only after the §12.4 gate with native-speaker ratings.

### 8.3 Languages likely to benefit from T3

T3 candidates are limited by the model's own language coverage. For LFM2.5-350M the listed languages are en, ar, zh, fr, de, ja, ko, pt, es ✅ (⚠️ confirm for the chosen model). For other languages, the mood pass is **off** and the UI says so.

### 8.4 Honesty rule

If a language has not passed its gate, the UI must not describe it as style-preserving. Show "Basic" or "Rules (experimental)".

---

## 9. Optional: fine-tuning for the mood pass

If the zero-shot 270M/350M restyler fails the gate, the next step is a **LoRA fine-tune** (for example with Unsloth, which publishes Gemma 3 270M tooling ✅) on (plain translation → styled translation) pairs generated offline and then human-checked. This is a research task with real cost; do not start it before measuring the zero-shot baseline (§12). Any fine-tuned weights must respect the base model's license and be re-exported to GGUF and re-measured against the 300 MB cap.

---

## 10. Settings and UX

### 10.1 Settings

| Setting | Default |
|---|---|
| Translate on click | ON |
| Show original under translation | ON |
| Provider | Cloud |
| Keep slang as written / expand / gloss | Keep as written |
| Vulgarity filter | ON |
| Experimental language packs | OFF |
| AI mood pass | OFF |
| Model manager | shows installed models, sizes, a **budget bar (x / 300 MB)**, delete buttons |

### 10.2 Download flow

1. User taps "Install style model (229 MB)".
2. Dialog: size, what it does, that it runs **on your device**, the license name, estimated time, and the remaining budget.
3. Request `optional_host_permissions` for the host.
4. Download with progress, resume support, SHA-256 verification, then budget re-check.
5. On failure: delete partials, show the reason.
6. Always offer "Remove" and show freed space.

### 10.3 Error messaging

Never show raw errors inside the chat message. Use a small badge in the extension UI with a retry button.

---

## 11. Privacy, licensing, compliance

- **Privacy:** T0 sends message text to the translation provider; say so in the options page and the store listing. T2/T3 run fully on-device. Store no message history unless the user enables it.
- **Licenses (⚠️ verify each, record in `THIRD_PARTY.md`):** Gemma Terms of Use ✅, LFM license ("lfm1.0" listed) ✅ name / ⚠️ terms, Opus-MT per-model cards ⚠️, fastText `lid.176.ftz` CC BY-SA 3.0 ✅, wllama ⚠️, Transformers.js ⚠️.
- **Provider terms:** the unofficial Google endpoint may violate terms for a public product ⚠️. Offer the official API as the production path.
- **Chrome Web Store policy:** ⚠️ confirm that downloading model weights after install and any remote-code rules are satisfied (weights are data, not code, but verify the current policy).

---

## 12. Testing and acceptance gates

### 12.1 Unit tests (must exist before any feature is "done")

- Unicode profile extraction: Latin, Cyrillic, Greek, Arabic (with tatweel), Hebrew, Devanagari, Thai, CJK, Hangul, emoji with ZWJ.
- False positives: `OK`, `LOL`, `book`, `coffee`, numbers like `10000`, URLs, mentions, German nouns, Turkish `İ`.
- Restoration: each rule individually with fixed input/output pairs per language.
- Placeholder survival through each provider.
- Safety checks: each rejection reason fires on a crafted bad output.
- Budget manager (§3).

### 12.2 Fixtures

For each language with a pack, at least **100 real chat-style messages** written or reviewed by native speakers, covering: formal, casual, abbreviations/acronyms, ALL CAPS, elongation, `?!`/`...`, emoji-only, laughter, flirty, sarcastic, slang that must not be translated literally, code-switching. Store as `fixtures/{lang}.jsonl` with source, expected profile, and acceptable outputs.

### 12.3 Automated metrics (no humans needed)

Computed for rules-only vs plain MT:

| Metric | Definition |
|---|---|
| Caps retention | source all-caps → target uppercase (cased targets only) |
| Punctuation retention | trailing run matches (after convention mapping) |
| Emoji retention | emoji multiset preserved |
| Span integrity | numbers/URLs/mentions/markers preserved |
| Fallback rate | share of messages rejected by safety checks |
| Latency | p50/p95 on a mid-range laptop |

### 12.4 T3 per-language gate (proposed thresholds; adjust with evidence)

A language may be marked **Rules + AI** only if, on ≥ 100 fixtures reviewed by ≥ 2 native speakers:

1. Meaning rating (1 to 5) is within 0.1 of plain MT.
2. Style rating improves over rules-only by a meaningful margin (proposed ≥ 0.3).
3. Native raters prefer the result over plain Google Translate in ≥ 60% of paired comparisons.
4. Safety-check rejection rate ≤ 15% and no meaning-changing errors in the sample.
5. p95 latency ≤ 4 s on the target device class.

If a language fails, T3 stays off for it. Report numbers **per language**, never a single global score.

### 12.5 Budget CI

CI fails if: any default install path exceeds 270 MB; any manifest entry lacks `bytes`/`sha256`; package size exceeds 15 MB; or the T3 + Opus pair combination is allowed by the UI.

---

## 13. Implementation plan

| Milestone | Deliverable | Done when |
|---|---|---|
| **M1** | Content script, service worker, cloud provider, protected spans, English pack, rules restoration, fixtures for English | English fixtures pass; span integrity 100% |
| **M2** | Pack loader + schema validation; Spanish, Arabic, Japanese packs (draft); language-specific rules (tatweel, CJK laughter, `¿¡`, Turkish casing) | Per-language rule tests pass |
| **M3** | Language detection chain (Chrome detector + script heuristics; fastText optional) | Detection tests pass, low-confidence path skips slang |
| **M4** | Budget manager, manifest pinning script, download manager (resume, SHA-256) | §3 and §12.5 tests pass |
| **M5** | T2: Opus-MT pair install/use via Transformers.js, pair catalog | One pair installs and translates offline within budget |
| **M6** | T3 Mode A (tone tagger) with wllama in an offscreen document | Tagger parses labels reliably; fallback verified |
| **M7** | T3 Mode B (restyler) behind the per-language gate | At least one language passes §12.4, or Mode B stays off |
| **M8** | Options UI, privacy text, license file, store listing | Review checklist complete |
| **M9+** | More packs with native review | Each new language passes its gates before its label changes |

Parallelism: M2 and M4 can run together. Do **not** start M6 before M4.

---

## 14. Verification checklist (every ⚠️ item)

The agent must resolve these and record the result in `docs/VERIFIED.md`:

1. Exact byte size and SHA-256 of `LFM2-350M-Q4_K_M.gguf` and `gemma-3-270m-it-Q4_K_M.gguf`; pin repo commits.
2. Official language list for LFM2-350M; whether to adopt LFM2.5-350M and its official GGUF repo and size.
3. LFM license terms and Gemma Terms of Use: confirm extension distribution of downloaded weights is allowed.
4. Real downloaded bytes for each Opus-MT pair chosen; which pairs exist; dtype to ship.
5. License text on each Opus-MT model card.
6. wllama: wasm size, API names, JSPI/MEMORY64 requirements, compat build path.
7. MV3: valid `chrome.offscreen` reason, cross-origin-isolation manifest keys, default CSP for wasm.
8. HF download behavior from an extension (redirect host, CORS, rate limits) or a mirror plan.
9. `lid.176.ftz` URL, a maintained JS/WASM reader (size and license), CC BY-SA obligations.
10. Chrome Translator API per-language download sizes; behavior when unavailable.
11. WhatsApp Web DOM: emoji representation, text node structure, formatting markers.
12. Placeholder survival rate per MT provider.
13. Chrome Web Store policy on post-install model downloads.
14. Provider terms for the free Google endpoint; wire in the official-API alternative.

---

## 15. Known limits (state these in the product, not just here)

- The meaning ceiling is the MT provider. Style layers cannot fix a wrong translation.
- Rules cannot see mood. Flirting, sarcasm, and affection need the T3 model, which is small and unreliable until it passes a language's gate.
- Elongation restoration only works for words the pack lists, or short messages with clean alignment.
- Slang is regional and ages fast. Packs need native review and a maintenance schedule.
- Under a 300 MB cap, you get **either** offline pairs **or** the style model, not both.
- Low-resource languages will usually stay at **Basic** until someone writes and reviews a pack.
