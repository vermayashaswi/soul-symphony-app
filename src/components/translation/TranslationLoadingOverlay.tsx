
/**
 * This overlay is deprecated and will never render.
 * Use page-level translation overlays/progress inside Insights/SoulNet instead.
 */
import React from 'react';

export function TranslationLoadingOverlay() {
  // This should never be rendered.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      "TranslationLoadingOverlay is deprecated and should NOT be used. See SoulNet, Insights, or per-page overlays for translation progress."
    );
  }
  return null;
}
