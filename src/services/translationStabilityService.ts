
interface TranslationState {
  translatedText: string;
  isComplete: boolean;
  timestamp: number;
  sourceLanguage: string;
  targetLanguage: string;
}

interface ViewTranslationState {
  [textKey: string]: TranslationState;
}

interface LanguageTranslationState {
  [viewKey: string]: ViewTranslationState;
}

class TranslationStabilityService {
  private translationStates: Map<string, LanguageTranslationState> = new Map();
  private translationLocks: Map<string, boolean> = new Map();
  private completionFlags: Map<string, boolean> = new Map();

  // Generate a unique key for translation state
  private generateStateKey(language: string): string {
    return `lang_${language}`;
  }

  private generateViewKey(route: string, timeRange: string): string {
    return `${route}_${timeRange}`;
  }

  private generateTextKey(text: string): string {
    // Use first 50 chars and hash for unique but manageable keys
    return text.length > 50 ? `${text.substring(0, 50)}_${this.simpleHash(text)}` : text;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Check if translations are locked for a specific view and language
  isTranslationLocked(language: string, route: string, timeRange: string): boolean {
    const lockKey = `${language}_${route}_${timeRange}`;
    return this.translationLocks.get(lockKey) || false;
  }

  // Lock translations for a specific view and language
  lockTranslations(language: string, route: string, timeRange: string): void {
    const lockKey = `${language}_${route}_${timeRange}`;
    this.translationLocks.set(lockKey, true);
    console.log(`[TranslationStability] Locked translations for ${lockKey}`);
  }

  // Unlock translations (when language actually changes)
  unlockAllTranslations(): void {
    this.translationLocks.clear();
    console.log('[TranslationStability] Unlocked all translations due to language change');
  }

  // Check if view translation is complete
  isViewTranslationComplete(language: string, route: string, timeRange: string): boolean {
    const completionKey = `${language}_${route}_${timeRange}`;
    return this.completionFlags.get(completionKey) || false;
  }

  // Mark view translation as complete
  markViewTranslationComplete(language: string, route: string, timeRange: string): void {
    const completionKey = `${language}_${route}_${timeRange}`;
    this.completionFlags.set(completionKey, true);
    this.lockTranslations(language, route, timeRange);
    console.log(`[TranslationStability] Marked translation complete for ${completionKey}`);
  }

  // Get persistent translation state
  getTranslationState(text: string, language: string, route: string, timeRange: string): TranslationState | null {
    const stateKey = this.generateStateKey(language);
    const viewKey = this.generateViewKey(route, timeRange);
    const textKey = this.generateTextKey(text);

    const languageState = this.translationStates.get(stateKey);
    if (!languageState) return null;

    const viewState = languageState[viewKey];
    if (!viewState) return null;

    return viewState[textKey] || null;
  }

  // Set persistent translation state
  setTranslationState(
    text: string, 
    translatedText: string, 
    language: string, 
    route: string, 
    timeRange: string,
    sourceLanguage: string = 'en'
  ): void {
    const stateKey = this.generateStateKey(language);
    const viewKey = this.generateViewKey(route, timeRange);
    const textKey = this.generateTextKey(text);

    if (!this.translationStates.has(stateKey)) {
      this.translationStates.set(stateKey, {});
    }

    const languageState = this.translationStates.get(stateKey)!;
    if (!languageState[viewKey]) {
      languageState[viewKey] = {};
    }

    languageState[viewKey][textKey] = {
      translatedText,
      isComplete: true,
      timestamp: Date.now(),
      sourceLanguage,
      targetLanguage: language
    };

    console.log(`[TranslationStability] Stored translation state: "${text.substring(0, 30)}" -> "${translatedText.substring(0, 30)}" for ${language}_${route}_${timeRange}`);
  }

  // Get the last successfully translated text across all views for fallback
  getLastTranslatedText(text: string, language: string): string | null {
    const stateKey = this.generateStateKey(language);
    const textKey = this.generateTextKey(text);
    const languageState = this.translationStates.get(stateKey);

    if (!languageState) return null;

    // Find the most recent translation across all views
    let mostRecentTranslation: TranslationState | null = null;
    let mostRecentTimestamp = 0;

    for (const viewState of Object.values(languageState)) {
      const translationState = viewState[textKey];
      if (translationState && translationState.timestamp > mostRecentTimestamp) {
        mostRecentTranslation = translationState;
        mostRecentTimestamp = translationState.timestamp;
      }
    }

    return mostRecentTranslation?.translatedText || null;
  }

  // Clear all states for a language (when language changes)
  clearLanguageStates(language: string): void {
    const stateKey = this.generateStateKey(language);
    this.translationStates.delete(stateKey);
    
    // Clear completion flags for this language
    const keysToDelete = Array.from(this.completionFlags.keys()).filter(key => key.startsWith(`${language}_`));
    keysToDelete.forEach(key => this.completionFlags.delete(key));
    
    console.log(`[TranslationStability] Cleared all states for language: ${language}`);
  }

  // Clear all states (complete reset)
  clearAllStates(): void {
    this.translationStates.clear();
    this.translationLocks.clear();
    this.completionFlags.clear();
    console.log('[TranslationStability] Cleared all translation states');
  }

  // Check if we have enough translations to consider a view "stable"
  checkViewStability(language: string, route: string, timeRange: string, requiredTranslations: number = 5): boolean {
    const stateKey = this.generateStateKey(language);
    const viewKey = this.generateViewKey(route, timeRange);
    const languageState = this.translationStates.get(stateKey);

    if (!languageState || !languageState[viewKey]) return false;

    const completedTranslations = Object.values(languageState[viewKey]).filter(state => state.isComplete).length;
    const isStable = completedTranslations >= requiredTranslations;

    if (isStable && !this.isViewTranslationComplete(language, route, timeRange)) {
      this.markViewTranslationComplete(language, route, timeRange);
    }

    return isStable;
  }
}

export const translationStabilityService = new TranslationStabilityService();
