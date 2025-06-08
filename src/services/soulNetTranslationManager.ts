
import { translationService } from '@/services/translationService';

interface SoulNetTranslationState {
  translatedText: string;
  isTranslating: boolean;
  hasTranslated: boolean;
  error?: string;
}

interface SoulNetNodeTranslation {
  [nodeId: string]: SoulNetTranslationState;
}

export class SoulNetTranslationManager {
  private static instance: SoulNetTranslationManager;
  private translationStates: SoulNetNodeTranslation = {};
  private subscribers: Set<() => void> = new Set();
  private currentLanguage: string = 'en';

  static getInstance(): SoulNetTranslationManager {
    if (!SoulNetTranslationManager.instance) {
      SoulNetTranslationManager.instance = new SoulNetTranslationManager();
    }
    return SoulNetTranslationManager.instance;
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback());
  }

  setCurrentLanguage(language: string): void {
    if (this.currentLanguage !== language) {
      this.currentLanguage = language;
      this.clearTranslations();
      console.log(`[SoulNetTranslationManager] Language changed to ${language}, clearing translations`);
    }
  }

  getTranslationState(nodeId: string): SoulNetTranslationState {
    return this.translationStates[nodeId] || {
      translatedText: nodeId,
      isTranslating: false,
      hasTranslated: false
    };
  }

  async translateNode(nodeId: string, sourceLanguage: string = 'en'): Promise<void> {
    if (!nodeId || this.currentLanguage === sourceLanguage) {
      this.translationStates[nodeId] = {
        translatedText: nodeId,
        isTranslating: false,
        hasTranslated: true
      };
      this.notifySubscribers();
      return;
    }

    // Check if already translated or translating
    const currentState = this.translationStates[nodeId];
    if (currentState?.hasTranslated || currentState?.isTranslating) {
      return;
    }

    console.log(`[SoulNetTranslationManager] Translating node: ${nodeId} to ${this.currentLanguage}`);

    // Set translating state
    this.translationStates[nodeId] = {
      translatedText: nodeId,
      isTranslating: true,
      hasTranslated: false
    };
    this.notifySubscribers();

    try {
      const translatedText = await translationService.translateText(nodeId, this.currentLanguage, sourceLanguage);
      
      this.translationStates[nodeId] = {
        translatedText: translatedText || nodeId,
        isTranslating: false,
        hasTranslated: true
      };

      console.log(`[SoulNetTranslationManager] Translation completed: ${nodeId} -> ${translatedText}`);
    } catch (error) {
      console.error(`[SoulNetTranslationManager] Translation failed for ${nodeId}:`, error);
      
      this.translationStates[nodeId] = {
        translatedText: nodeId,
        isTranslating: false,
        hasTranslated: true,
        error: error instanceof Error ? error.message : 'Translation failed'
      };
    }

    this.notifySubscribers();
  }

  async batchTranslateNodes(nodeIds: string[], sourceLanguage: string = 'en'): Promise<void> {
    if (this.currentLanguage === sourceLanguage) {
      nodeIds.forEach(nodeId => {
        this.translationStates[nodeId] = {
          translatedText: nodeId,
          isTranslating: false,
          hasTranslated: true
        };
      });
      this.notifySubscribers();
      return;
    }

    console.log(`[SoulNetTranslationManager] Batch translating ${nodeIds.length} nodes to ${this.currentLanguage}`);

    // Filter out already translated nodes
    const nodesToTranslate = nodeIds.filter(nodeId => {
      const state = this.translationStates[nodeId];
      return !state?.hasTranslated && !state?.isTranslating;
    });

    if (nodesToTranslate.length === 0) {
      console.log(`[SoulNetTranslationManager] All nodes already translated`);
      return;
    }

    // Set all as translating
    nodesToTranslate.forEach(nodeId => {
      this.translationStates[nodeId] = {
        translatedText: nodeId,
        isTranslating: true,
        hasTranslated: false
      };
    });
    this.notifySubscribers();

    try {
      const translationResults = await translationService.batchTranslate({
        texts: nodesToTranslate,
        targetLanguage: this.currentLanguage
      });

      nodesToTranslate.forEach(nodeId => {
        const translatedText = translationResults.get(nodeId) || nodeId;
        this.translationStates[nodeId] = {
          translatedText,
          isTranslating: false,
          hasTranslated: true
        };
      });

      console.log(`[SoulNetTranslationManager] Batch translation completed for ${nodesToTranslate.length} nodes`);
    } catch (error) {
      console.error(`[SoulNetTranslationManager] Batch translation failed:`, error);
      
      nodesToTranslate.forEach(nodeId => {
        this.translationStates[nodeId] = {
          translatedText: nodeId,
          isTranslating: false,
          hasTranslated: true,
          error: error instanceof Error ? error.message : 'Translation failed'
        };
      });
    }

    this.notifySubscribers();
  }

  clearTranslations(): void {
    this.translationStates = {};
    this.notifySubscribers();
    console.log(`[SoulNetTranslationManager] Cleared all translations`);
  }

  getOverallTranslationState(): { isAnyTranslating: boolean; totalNodes: number; translatedNodes: number } {
    const states = Object.values(this.translationStates);
    const isAnyTranslating = states.some(state => state.isTranslating);
    const totalNodes = states.length;
    const translatedNodes = states.filter(state => state.hasTranslated).length;

    return { isAnyTranslating, totalNodes, translatedNodes };
  }
}

export const soulNetTranslationManager = SoulNetTranslationManager.getInstance();
