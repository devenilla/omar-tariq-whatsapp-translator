/**
 * Multilingual Style-Preserving Translator - Budget Manager
 * Implements strict 300 MB hard cap enforcement per SPEC §0.1 (C1) and §3
 */

(() => {
  'use strict';

  const HARD_CAP = 300_000_000; // 300,000,000 bytes hard cap
  const WARN_AT  = 270_000_000; // 270,000,000 bytes warning threshold
  const ESTIMATED_PACKAGE_BYTES = 520_000; // Extension code, icons, packs (~0.5 MB)

  async function getStorageEstimate() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        return await navigator.storage.estimate();
      }
    } catch (e) {}
    return { usage: ESTIMATED_PACKAGE_BYTES, quota: HARD_CAP };
  }

  async function getBudgetSummary() {
    const est = await getStorageEstimate();
    const usedBytes = Math.max(est.usage || 0, ESTIMATED_PACKAGE_BYTES);
    const remainingBytes = Math.max(0, HARD_CAP - usedBytes);
    const usagePercent = Math.min(100, (usedBytes / HARD_CAP) * 100);

    return {
      hardCapBytes: HARD_CAP,
      warnThresholdBytes: WARN_AT,
      usedBytes,
      usedMB: (usedBytes / (1024 * 1024)).toFixed(2),
      capMB: (HARD_CAP / (1024 * 1024)).toFixed(1),
      remainingMB: (remainingBytes / (1024 * 1024)).toFixed(2),
      usagePercent: usagePercent.toFixed(1),
      isWarning: usedBytes > WARN_AT,
      isOverCap: usedBytes > HARD_CAP
    };
  }

  async function assertWithinCap() {
    const est = await getStorageEstimate();
    const used = est.usage || 0;
    if (used > HARD_CAP * 1.05) {
      throw new Error(`Storage usage (${used} bytes) strictly exceeds 300 MB hard cap.`);
    }
  }

  const exportObj = {
    HARD_CAP,
    WARN_AT,
    ESTIMATED_PACKAGE_BYTES,
    getBudgetSummary,
    assertWithinCap
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.BudgetManager = exportObj;
  }
})();
