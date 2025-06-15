
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/contexts/TranslationContext";
import { NodeTranslationCacheService } from "@/services/nodeTranslationCache";

/**
 * Hook for atomically translating node ids for SoulNet
 * Caches translations across timeRange changes and in sessionStorage
 */
export function useSoulNetNodeTranslations(nodeIds: string[]): {
  translations: Map<string, string>;
  isLoading: boolean;
  progress: number;
  translationsReady: boolean;
  getTranslation: (id: string) => string;
  refresh: () => void;
} {
  const { currentLanguage, translate } = useTranslation();
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(100);
  const [translationsReady, setTranslationsReady] = useState(false);

  // Preserve translation cache in sessionStorage
  const sessionKey = `sn_translations_${currentLanguage}`;
  const lastLangRef = useRef(currentLanguage);

  // Hydrate from session cache if available
  useEffect(() => {
    if (nodeIds.length === 0) {
      setTranslations(new Map());
      setTranslationsReady(true);
      setProgress(100);
      return;
    }
    setIsLoading(true);
    setTranslationsReady(false);

    const hydrate = async () => {
      // If switching languages, reset translation map
      if (lastLangRef.current !== currentLanguage) {
        setTranslations(new Map());
        setTranslationsReady(false);
        setProgress(0);
      }
      lastLangRef.current = currentLanguage;

      // Always load from sessionStorage if available
      let hydrated = false;
      try {
        const serialized = sessionStorage.getItem(sessionKey);
        if (serialized) {
          const parsed: [string, string][] = JSON.parse(serialized);
          if (Array.isArray(parsed)) {
            const m = new Map(parsed);
            setTranslations(m);
            setProgress(Math.round((m.size / nodeIds.length) * 100));
            hydrated = true;
          }
        }
      } catch {}
      if (!hydrated) {
        setTranslations(new Map());
        setProgress(0);
      }
    };

    hydrate();
    setIsLoading(false);
  // Only hydrate on nodeIds or language change
  // eslint-disable-next-line
  }, [JSON.stringify(nodeIds), currentLanguage]);

  // Perform bulk translation (if not English) and update cache
  const fetchTranslations = useCallback(async () => {
    if (nodeIds.length === 0 || currentLanguage === "en") {
      const map = new Map<string, string>();
      nodeIds.forEach((id) => map.set(id, id));
      setTranslations(map);
      setIsLoading(false);
      setTranslationsReady(true);
      setProgress(100);
      sessionStorage.setItem(sessionKey, JSON.stringify(Array.from(map.entries())));
      return;
    }

    setIsLoading(true);
    const results = new Map<string, string>();

    // First, get all cached translations
    const cached = await NodeTranslationCacheService.getBatchCachedTranslations(nodeIds, currentLanguage);
    cached.forEach((val, key) => {
      if (val && val.trim()) results.set(key, val);
    });

    setTranslations(new Map(results));
    setProgress(Math.round((results.size / nodeIds.length) * 100));
    if (results.size === nodeIds.length) {
      setIsLoading(false);
      setTranslationsReady(true);
      sessionStorage.setItem(sessionKey, JSON.stringify(Array.from(results.entries())));
      return;
    }

    // Only translate uncached
    const missing = nodeIds.filter((id) => !results.has(id));
    let complete = results.size;
    for (const id of missing) {
      try {
        const val = await translate(id, "en");
        complete += 1;
        results.set(id, val || id);
        setTranslations(new Map(results));
        setProgress(Math.round((complete / nodeIds.length) * 100));
      } catch {
        // fallback to original
        results.set(id, id);
      }
    }
    setTranslations(new Map(results));
    setIsLoading(false);
    setTranslationsReady(true);
    setProgress(100);

    // Persist all translations immediately after fill
    sessionStorage.setItem(sessionKey, JSON.stringify(Array.from(results.entries())));
    // Also persist in node translation cache for non-English
    if (currentLanguage !== "en") {
      await NodeTranslationCacheService.setBatchCachedTranslations(results, currentLanguage);
    }
  // Only run when ids/lang change
  // eslint-disable-next-line
  }, [JSON.stringify(nodeIds), currentLanguage, translate]);

  // Run fetch on language or time change (controlled by new nodeIds arr)
  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const getTranslation = useCallback(
    (id: string) => {
      return translations.get(id) || id;
    },
    [translations]
  );

  const refresh = useCallback(() => {
    sessionStorage.removeItem(sessionKey);
    setTranslations(new Map());
    setTranslationsReady(false);
    setProgress(0);
    fetchTranslations();
  }, [sessionKey, fetchTranslations]);

  return {
    translations,
    isLoading,
    progress,
    translationsReady,
    getTranslation,
    refresh,
  };
}
