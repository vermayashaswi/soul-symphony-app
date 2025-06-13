
import { soulNetDataService } from './soulNetDataService';
import { translationService } from './translationService';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface LinkData {
  source: string;
  target: string;
  value: number;
}

interface NodeConnectionData {
  connectedNodes: string[];
  totalStrength: number;
  averageStrength: number;
}

interface InstantSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  translationComplete: boolean;
  translationProgress: number;
}

interface TranslationState {
  isTranslating: boolean;
  progress: number;
  complete: boolean;
}

class EnhancedSoulNetPreloadServiceClass {
  private instantCache = new Map<string, InstantSoulNetData>();
  private translationStates = new Map<string, TranslationState>();
  private appLevelTranslationService: any = null;

  // ENHANCED: Set app-level translation service for coordination
  setAppLevelTranslationService(service: any): void {
    this.appLevelTranslationService = service;
    console.log('[EnhancedSoulNetPreloadService] APP-LEVEL: Translation service integration established');
  }

  // ENHANCED: Get current translation state for atomic tracking
  getTranslationState(cacheKey: string): TranslationState {
    return this.translationStates.get(cacheKey) || {
      isTranslating: false,
      progress: 100,
      complete: true
    };
  }

  // ENHANCED: Update translation state atomically
  private setTranslationState(cacheKey: string, state: Partial<TranslationState>): void {
    const currentState = this.getTranslationState(cacheKey);
    const newState = { ...currentState, ...state };
    this.translationStates.set(cacheKey, newState);
    console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Translation state updated for ${cacheKey}:`, newState);
  }

  async preloadInstantData(
    userId: string,
    timeRange: string,
    targetLanguage: string
  ): Promise<InstantSoulNetData | null> {
    const cacheKey = `${userId}-${timeRange}-${targetLanguage}`;
    
    // ENHANCED: Check for complete atomic data first
    const existing = this.instantCache.get(cacheKey);
    if (existing && existing.translationComplete) {
      console.log('[EnhancedSoulNetPreloadService] ATOMIC: Using complete cached data for', cacheKey);
      return existing;
    }

    try {
      console.log('[EnhancedSoulNetPreloadService] ATOMIC: Starting atomic preload for', cacheKey);
      
      // Set translation state to in progress
      this.setTranslationState(cacheKey, {
        isTranslating: true,
        progress: 0,
        complete: false
      });

      // Get base graph data
      const graphData = await soulNetDataService.getSoulNetData(userId, timeRange);
      if (!graphData || graphData.nodes.length === 0) {
        console.log('[EnhancedSoulNetPreloadService] ATOMIC: No graph data available');
        this.setTranslationState(cacheKey, {
          isTranslating: false,
          progress: 100,
          complete: true
        });
        return null;
      }

      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Processing ${graphData.nodes.length} nodes for atomic translation`);

      // Calculate connection percentages and node connection data
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      
      // Process connections
      graphData.nodes.forEach(node => {
        const connections = graphData.links.filter(link => 
          link.source === node.id || link.target === node.id
        );
        
        const connectedNodes = connections.map(link => 
          link.source === node.id ? link.target : link.source
        );
        
        const totalStrength = connections.reduce((sum, link) => sum + link.value, 0);
        const averageStrength = connections.length > 0 ? totalStrength / connections.length : 0;
        
        nodeConnectionData.set(node.id, {
          connectedNodes,
          totalStrength,
          averageStrength
        });

        // Calculate percentages for all connections
        connections.forEach(link => {
          const percentage = Math.round((link.value / Math.max(totalStrength, 1)) * 100);
          const key1 = `${node.id}-${link.source === node.id ? link.target : link.source}`;
          connectionPercentages.set(key1, percentage);
        });
      });

      // ENHANCED: Atomic translation using coordinated service
      let translations = new Map<string, string>();
      let translationComplete = true;

      if (targetLanguage !== 'en') {
        console.log('[EnhancedSoulNetPreloadService] ATOMIC: Starting coordinated atomic translation');
        
        this.setTranslationState(cacheKey, {
          isTranslating: true,
          progress: 25,
          complete: false
        });

        const nodeTexts = [...new Set(graphData.nodes.map(node => node.id))];
        
        try {
          // Use the coordinated translation service for atomic consistency
          const translationResults = await translationService.batchTranslate(
            nodeTexts,
            'en',
            targetLanguage
          );

          translations = translationResults;
          translationComplete = true;
          
          console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Coordinated translation completed for ${translations.size} nodes`);
          
          this.setTranslationState(cacheKey, {
            isTranslating: false,
            progress: 100,
            complete: true
          });
        } catch (error) {
          console.error('[EnhancedSoulNetPreloadService] ATOMIC: Coordinated translation failed:', error);
          translationComplete = false;
          
          this.setTranslationState(cacheKey, {
            isTranslating: false,
            progress: 0,
            complete: false
          });
        }
      } else {
        // For English, no translation needed
        this.setTranslationState(cacheKey, {
          isTranslating: false,
          progress: 100,
          complete: true
        });
      }

      // ENHANCED: Only cache when atomic translation is complete
      const instantData: InstantSoulNetData = {
        nodes: graphData.nodes,
        links: graphData.links,
        translations,
        connectionPercentages,
        nodeConnectionData,
        translationComplete,
        translationProgress: translationComplete ? 100 : 0
      };

      if (translationComplete) {
        this.instantCache.set(cacheKey, instantData);
        console.log('[EnhancedSoulNetPreloadService] ATOMIC: Complete atomic data cached for', cacheKey);
      } else {
        console.log('[EnhancedSoulNetPreloadService] ATOMIC: Incomplete translation, not caching');
      }

      return instantData;
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] ATOMIC: Preload error:', error);
      this.setTranslationState(cacheKey, {
        isTranslating: false,
        progress: 0,
        complete: false
      });
      return null;
    }
  }

  // ENHANCED: Get atomic instant data
  getInstantData(cacheKey: string): { data: InstantSoulNetData } | null {
    const data = this.instantCache.get(cacheKey);
    if (data && data.translationComplete) {
      console.log('[EnhancedSoulNetPreloadService] ATOMIC: Retrieved complete atomic data for', cacheKey);
      return { data };
    }
    console.log('[EnhancedSoulNetPreloadService] ATOMIC: No complete atomic data for', cacheKey);
    return null;
  }

  // ENHANCED: Clear instant cache for specific user or all
  clearInstantCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.instantCache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.instantCache.delete(key);
        this.translationStates.delete(key);
      });
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Cleared atomic cache for user ${userId}`);
    } else {
      this.instantCache.clear();
      this.translationStates.clear();
      console.log('[EnhancedSoulNetPreloadService] ATOMIC: Cleared all atomic cache');
    }
  }

  // Get cache size for debugging
  getCacheSize(): number {
    return this.instantCache.size;
  }

  // Get cached data keys for debugging
  getCachedKeys(): string[] {
    return Array.from(this.instantCache.keys());
  }
}

// FIXED: Single export with unique name
export const EnhancedSoulNetPreloadService = new EnhancedSoulNetPreloadServiceClass();
