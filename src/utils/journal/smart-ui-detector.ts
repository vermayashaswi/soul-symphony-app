import { processingStateManager } from './processing-state-manager';
import { debounce } from '@/lib/utils';

/**
 * Smart UI Detector - Watches for DOM changes and immediately hides loader cards
 * when processed journal entry cards appear in the UI
 */
class SmartUIDetector {
  private observer: MutationObserver | null = null;
  private isObserving = false;
  private containerElement: Element | null = null;

  /**
   * Start watching for DOM changes in the journal entries container
   */
  startWatching() {
    if (this.isObserving) {
      console.log('[SmartUIDetector] Already watching, skipping start');
      return;
    }

    // Find the journal entries container
    this.containerElement = document.getElementById('journal-entries-container');
    if (!this.containerElement) {
      console.log('[SmartUIDetector] Journal container not found, will retry...');
      setTimeout(() => this.startWatching(), 100);
      return;
    }

    console.log('[SmartUIDetector] Starting to watch for DOM changes');

    // Create MutationObserver to watch for new entry cards
    this.observer = new MutationObserver(this.handleMutations);
    
    // Enhanced observation for faster detection
    this.observer.observe(this.containerElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-temp-id', 'data-processing', 'data-content-ready', 'class']
    });

    this.isObserving = true;
  }

  /**
   * Stop watching for DOM changes
   */
  stopWatching() {
    if (this.observer) {
      console.log('[SmartUIDetector] Stopping DOM observation');
      this.observer.disconnect();
      this.observer = null;
    }
    this.isObserving = false;
    this.containerElement = null;
  }

  /**
   * Handle DOM mutations - optimized for faster detection
   */
  private handleMutations = debounce((mutations: MutationRecord[]) => {
    console.log('[SmartUIDetector] Processing DOM mutations:', mutations.length);
    
    // Use requestAnimationFrame for immediate DOM checks
    requestAnimationFrame(() => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check for newly added nodes
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForProcessedEntryCard(node as Element);
            }
          });
        } else if (mutation.type === 'attributes') {
          // Check for critical attribute changes
          if (mutation.target.nodeType === Node.ELEMENT_NODE) {
            const target = mutation.target as Element;
            // Enhanced attribute monitoring
            if (mutation.attributeName === 'data-processing' || 
                mutation.attributeName === 'data-content-ready' ||
                mutation.attributeName === 'class') {
              this.checkForProcessedEntryCard(target);
            }
          }
        }
      }
    });
  }, 10); // Reduced from 50ms to 10ms for faster detection

  /**
   * Check if an element is a processed journal entry card and trigger cleanup
   */
  private checkForProcessedEntryCard(element: Element) {
    // Look for journal entry cards (either the element itself or children)
    const entryCards = [element, ...element.querySelectorAll('[data-temp-id]')];
    
    for (const card of entryCards) {
      if (!(card instanceof Element)) continue;
      
      const tempId = card.getAttribute('data-temp-id');
      const isProcessing = card.getAttribute('data-processing') === 'true';
      
      // Skip if no tempId or still processing
      if (!tempId || isProcessing) continue;
      
      // Check if this looks like a processed entry card (has content, not a skeleton)
      const hasContent = this.hasRealContent(card);
      if (!hasContent) continue;

      console.log(`[SmartUIDetector] Detected processed entry card: ${tempId}, triggering immediate cleanup`);
      
      // Immediately trigger loader cleanup
      this.triggerImmediateCleanup(tempId);
    }
  }

  /**
   * Enhanced content verification for faster and more accurate detection
   */
  private hasRealContent(element: Element): boolean {
    // Fast rejection for obvious loading elements
    if (element.classList.contains('animate-pulse') ||
        element.classList.contains('loading-entry') ||
        element.classList.contains('processing-card') ||
        element.querySelector('[data-loading-skeleton="true"]') ||
        element.querySelector('.shimmer-skeleton')) {
      return false;
    }

    // Enhanced content detection with multiple criteria
    const contentIndicators = [
      // Explicit content ready flag
      () => element.getAttribute('data-content-ready') === 'true',
      
      // Specific content elements
      () => element.querySelector('[data-entry-title], [data-entry-content], [data-entry-date], [data-entry-actions]'),
      
      // Real content selectors
      () => element.querySelector('.journal-entry-content, .entry-content, .transcript, .entry-text, .journal-content'),
      
      // Audio content that's not loading
      () => element.querySelector('audio:not(.loading), .audio-player:not(.loading)'),
      
      // Substantial text content (more than loading messages)
      () => {
        const textContent = element.textContent?.trim() || '';
        return textContent.length > 50 && 
               !textContent.includes('Processing') && 
               !textContent.includes('Loading') &&
               !textContent.includes('analyzing');
      }
    ];

    const hasRealContent = contentIndicators.some(check => {
      try {
        return check();
      } catch (e) {
        return false;
      }
    });
    
    const tempId = element.getAttribute('data-temp-id');
    console.log(`[SmartUIDetector] Enhanced content check for ${tempId}: hasRealContent=${hasRealContent}`);
    
    return hasRealContent;
  }

  /**
   * Trigger immediate cleanup of loader cards for a specific tempId
   */
  private triggerImmediateCleanup(tempId: string) {
    console.log(`[SmartUIDetector] Triggering immediate cleanup for: ${tempId}`);
    
    // Force immediate cleanup in processing state manager
    processingStateManager.forceImmediateCleanup(tempId);
    
    // Dispatch immediate cleanup event
    window.dispatchEvent(new CustomEvent('smartUICleanup', {
      detail: { 
        tempId,
        trigger: 'processed-card-detected',
        timestamp: Date.now()
      }
    }));
    
    // Also hide any visible loading cards with this tempId
    this.hideLoadingCardsForTempId(tempId);
  }

  /**
   * Enhanced loading card hiding with smooth transitions
   */
  private hideLoadingCardsForTempId(tempId: string) {
    const loadingCards = document.querySelectorAll(`[data-temp-id="${tempId}"][data-loading-skeleton], [data-temp-id="${tempId}"].loading-entry, [data-temp-id="${tempId}"].processing-card`);
    
    loadingCards.forEach(card => {
      if (card instanceof HTMLElement) {
        console.log(`[SmartUIDetector] Hiding loading card with smooth transition: ${tempId}`);
        
        // Add smooth fade-out transition
        card.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        
        // Hide after transition
        setTimeout(() => {
          card.style.display = 'none';
          card.classList.add('hidden');
        }, 200);
        
        // Dispatch hide event immediately
        window.dispatchEvent(new CustomEvent('processingEntryHidden', {
          detail: { tempId, trigger: 'smart-ui-cleanup', timestamp: Date.now() }
        }));
      }
    });
  }

  /**
   * Check current state
   */
  isWatching(): boolean {
    return this.isObserving;
  }
}

// Export singleton instance
export const smartUIDetector = new SmartUIDetector();

// Auto-start watching when module loads (if DOM is ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    smartUIDetector.startWatching();
  });
} else {
  // DOM already loaded
  smartUIDetector.startWatching();
}