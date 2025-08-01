
// Tutorial highlighting manager with DOM readiness checks and retry mechanism

import { navigationManager } from './navigation-state-manager';

interface HighlightingState {
  currentStep: number;
  retryCount: number;
  maxRetries: number;
  retryDelay: number;
  isHighlighting: boolean;
}

class TutorialHighlightingManager {
  private state: HighlightingState = {
    currentStep: 0,
    retryCount: 0,
    maxRetries: 5,
    retryDelay: 200,
    isHighlighting: false
  };

  // ENHANCED: DOM readiness check with multiple criteria
  private async waitForDOMReady(): Promise<boolean> {
    return new Promise((resolve) => {
      const checkReady = () => {
        const isDocumentReady = document.readyState === 'complete';
        const hasBody = !!document.body;
        const hasElements = document.querySelectorAll('*').length > 10;
        
        console.log('[HighlightingManager] DOM readiness check:', {
          documentReady: isDocumentReady,
          hasBody,
          hasElements,
          elementCount: document.querySelectorAll('*').length
        });
        
        if (isDocumentReady && hasBody && hasElements) {
          resolve(true);
        } else {
          setTimeout(checkReady, 50);
        }
      };
      
      checkReady();
      
      // Timeout after 2 seconds
      setTimeout(() => resolve(false), 2000);
    });
  }

  // ENHANCED: Element existence validation with detailed logging
  private validateElementExists(selectors: string[], stepId: number): HTMLElement | null {
    console.log(`[HighlightingManager] Validating element existence for step ${stepId}:`, selectors);
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element instanceof HTMLElement) {
          const elementText = element.textContent?.toLowerCase().trim() || '';
          const isVisible = element.offsetParent !== null;
          const hasSize = element.offsetWidth > 0 && element.offsetHeight > 0;
          
          console.log(`[HighlightingManager] Found element with selector "${selector}":`, {
            element,
            text: elementText,
            isVisible,
            hasSize,
            classes: Array.from(element.classList),
            style: element.style.cssText
          });
          
          // Additional validation based on step
          if (stepId === 3 && !elementText.includes('new') && !elementText.includes('record') && !elementText.includes('entry')) {
            console.warn(`[HighlightingManager] Step 3 element doesn't contain expected keywords: "${elementText}"`);
            continue;
          }
          
          if (stepId === 4 && !elementText.includes('past') && !elementText.includes('entries') && !elementText.includes('history')) {
            console.warn(`[HighlightingManager] Step 4 element doesn't contain expected keywords: "${elementText}"`);
            continue;
          }
          
          return element;
        }
      } catch (error) {
        console.warn(`[HighlightingManager] Error checking selector "${selector}":`, error);
      }
    }
    
    console.warn(`[HighlightingManager] No valid element found for step ${stepId} with selectors:`, selectors);
    return null;
  }

  // ENHANCED: CSS class persistence check
  private validateClassPersistence(element: HTMLElement, expectedClasses: string[], stepId: number): boolean {
    const currentClasses = Array.from(element.classList);
    const hasAllClasses = expectedClasses.every(cls => currentClasses.includes(cls));
    
    console.log(`[HighlightingManager] Class persistence check for step ${stepId}:`, {
      element: element.tagName,
      expectedClasses,
      currentClasses,
      hasAllClasses
    });
    
    if (!hasAllClasses) {
      console.warn(`[HighlightingManager] Missing classes detected for step ${stepId}. Re-applying...`);
      expectedClasses.forEach(cls => {
        if (!element.classList.contains(cls)) {
          element.classList.add(cls);
          console.log(`[HighlightingManager] Re-added class "${cls}" to element`);
        }
      });
    }
    
    return hasAllClasses;
  }

  // ENHANCED: Forced visibility for tab buttons with comprehensive styling
  private applyForcedVisibility(element: HTMLElement, stepId: number): void {
    console.log(`[HighlightingManager] Applying forced visibility for step ${stepId}`);
    
    // Base styles for all tutorial elements
    const baseStyles = {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      pointerEvents: 'auto',
      position: 'relative',
      zIndex: '30000'
    };
    
    // Step-specific enhanced styles
    if (stepId === 3 || stepId === 4) {
      const tabStyles = {
        ...baseStyles,
        boxShadow: '0 0 50px 30px var(--color-theme)',
        animation: 'ultra-bright-pulse 1.5s infinite alternate',
        outline: '3px solid white',
        transform: 'translateZ(0) scale(1.05)',
        border: '3px solid white',
        backgroundColor: 'rgba(26, 31, 44, 0.98)',
        backdropFilter: 'brightness(1.3)',
        borderRadius: '8px',
        color: 'white',
        textShadow: '0 0 4px rgba(0,0,0,0.8)'
      };
      
      Object.entries(tabStyles).forEach(([prop, value]) => {
        try {
          element.style[prop as any] = value;
        } catch (error) {
          console.warn(`[HighlightingManager] Could not set style ${prop}:`, error);
        }
      });
      
      // Also apply styles to child elements
      const children = element.querySelectorAll('*');
      children.forEach(child => {
        if (child instanceof HTMLElement) {
          child.style.color = 'white';
          child.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';
        }
      });
    } else {
      // Apply base styles for other steps
      Object.entries(baseStyles).forEach(([prop, value]) => {
        try {
          element.style[prop as any] = value;
        } catch (error) {
          console.warn(`[HighlightingManager] Could not set style ${prop}:`, error);
        }
      });
    }
  }

  // ENHANCED: Staggered highlighting with retry mechanism
  async applyStaggeredHighlighting(
    selectors: string[],
    classesToApply: string[],
    stepId: number
  ): Promise<boolean> {
    if (this.state.isHighlighting) {
      console.log('[HighlightingManager] Already highlighting, skipping duplicate request');
      return false;
    }
    
    this.state.isHighlighting = true;
    this.state.currentStep = stepId;
    this.state.retryCount = 0;
    
    try {
      console.log(`[HighlightingManager] Starting staggered highlighting for step ${stepId}`);
      
      // Wait for DOM to be ready
      const domReady = await this.waitForDOMReady();
      if (!domReady) {
        console.warn('[HighlightingManager] DOM not ready after timeout, proceeding anyway');
      }
      
      // Retry mechanism
      while (this.state.retryCount < this.state.maxRetries) {
        console.log(`[HighlightingManager] Highlighting attempt ${this.state.retryCount + 1}/${this.state.maxRetries} for step ${stepId}`);
        
        // Check if transition protection is still active
        if (!navigationManager.isStepTransitionProtected() && stepId === navigationManager.getState().currentStep) {
          console.log('[HighlightingManager] Transition protection cleared, restarting protection');
          navigationManager.startStepTransition(stepId);
        }
        
        const element = this.validateElementExists(selectors, stepId);
        
        if (element) {
          // Remove competing classes first
          this.removeCompetingClasses(element, stepId);
          
          // Apply classes with delay between each
          for (let i = 0; i < classesToApply.length; i++) {
            const className = classesToApply[i];
            element.classList.add(className);
            console.log(`[HighlightingManager] Applied class "${className}" to step ${stepId} element`);
            
            if (i < classesToApply.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
          
          // Apply forced visibility
          this.applyForcedVisibility(element, stepId);
          
          // Validate persistence after a short delay
          setTimeout(() => {
            if (this.state.currentStep === stepId) {
              this.validateClassPersistence(element, classesToApply, stepId);
            }
          }, 300);
          
          console.log(`[HighlightingManager] Successfully highlighted element for step ${stepId}`);
          this.state.isHighlighting = false;
          return true;
        }
        
        this.state.retryCount++;
        
        if (this.state.retryCount < this.state.maxRetries) {
          console.log(`[HighlightingManager] Element not found, retrying in ${this.state.retryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, this.state.retryDelay));
        }
      }
      
      console.error(`[HighlightingManager] Failed to highlight element for step ${stepId} after ${this.state.maxRetries} attempts`);
      this.state.isHighlighting = false;
      return false;
      
    } catch (error) {
      console.error(`[HighlightingManager] Error in staggered highlighting for step ${stepId}:`, error);
      this.state.isHighlighting = false;
      return false;
    }
  }

  // ENHANCED: Remove competing classes to prevent conflicts
  private removeCompetingClasses(element: HTMLElement, stepId: number): void {
    const allTutorialClasses = [
      'tutorial-target',
      'tutorial-button-highlight',
      'record-entry-tab',
      'entries-tab',
      'chat-question-highlight',
      'insights-header-highlight',
      'emotion-chart-highlight',
      'mood-calendar-highlight',
      
      'empty-chat-suggestion',
      'tutorial-record-entry-button'
    ];
    
    console.log(`[HighlightingManager] Removing competing classes for step ${stepId}`);
    
    // Remove all tutorial classes first
    allTutorialClasses.forEach(className => {
      if (element.classList.contains(className)) {
        element.classList.remove(className);
        console.log(`[HighlightingManager] Removed competing class "${className}"`);
      }
    });
    
    // Reset critical styles
    const stylesToReset = ['boxShadow', 'animation', 'border', 'transform', 'outline'];
    stylesToReset.forEach(style => {
      try {
        element.style[style as any] = '';
      } catch (error) {
        console.warn(`[HighlightingManager] Could not reset style ${style}:`, error);
      }
    });
  }

  // Reset highlighting state
  reset(): void {
    console.log('[HighlightingManager] Resetting highlighting state');
    this.state = {
      currentStep: 0,
      retryCount: 0,
      maxRetries: 5,
      retryDelay: 200,
      isHighlighting: false
    };
  }

  // Get current state
  getState(): Readonly<HighlightingState> {
    return { ...this.state };
  }
}

// Export singleton instance
export const highlightingManager = new TutorialHighlightingManager();
