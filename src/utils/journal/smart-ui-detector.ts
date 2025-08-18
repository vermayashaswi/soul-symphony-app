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
    
    // Watch for child additions in the entire container tree
    this.observer.observe(this.containerElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-temp-id', 'data-processing']
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
   * Handle DOM mutations - debounced to avoid excessive processing
   */
  private handleMutations = debounce((mutations: MutationRecord[]) => {
    console.log('[SmartUIDetector] Processing DOM mutations:', mutations.length);
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check for newly added nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.checkForProcessedEntryCard(node as Element);
          }
        });
      } else if (mutation.type === 'attributes') {
        // Check for attribute changes that might indicate a processed entry
        if (mutation.target.nodeType === Node.ELEMENT_NODE) {
          this.checkForProcessedEntryCard(mutation.target as Element);
        }
      }
    }
  }, 50);

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
   * Check if an element has real content (not just skeleton/loading elements)
   */
  private hasRealContent(element: Element): boolean {
    // Look for indicators of real content vs loading skeleton
    const hasTitle = element.querySelector('[data-entry-title]');
    const hasContent = element.querySelector('[data-entry-content]');
    const hasDate = element.querySelector('[data-entry-date]');
    const hasActions = element.querySelector('[data-entry-actions]');
    
    // Check for text content that's not just loading placeholders
    const textContent = element.textContent?.trim() || '';
    const hasSubstantialText = textContent.length > 20; // More than just "Processing..." etc.
    
    // Avoid skeleton/loading indicators
    const isLoadingSkeleton = element.classList.contains('animate-pulse') ||
                             element.querySelector('.animate-pulse') ||
                             element.querySelector('[data-loading-skeleton]');
    
    const hasRealContent = (hasTitle || hasContent || hasDate || hasActions || hasSubstantialText) && !isLoadingSkeleton;
    
    console.log(`[SmartUIDetector] Content check for ${element.getAttribute('data-temp-id')}: hasRealContent=${hasRealContent}, isLoadingSkeleton=${isLoadingSkeleton}`);
    
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
   * Immediately hide loading cards with matching tempId
   */
  private hideLoadingCardsForTempId(tempId: string) {
    const loadingCards = document.querySelectorAll(`[data-temp-id="${tempId}"][data-loading-skeleton]`);
    
    loadingCards.forEach(card => {
      if (card instanceof HTMLElement) {
        console.log(`[SmartUIDetector] Immediately hiding loading card: ${tempId}`);
        card.style.display = 'none';
        card.classList.add('hidden');
        
        // Dispatch hide event
        window.dispatchEvent(new CustomEvent('processingEntryHidden', {
          detail: { tempId, trigger: 'smart-ui-cleanup' }
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