
interface KeyboardState {
  isVisible: boolean;
  height: number;
  timestamp: number;
}

interface KeyboardListener {
  id: string;
  callback: (state: KeyboardState) => void;
}

class KeyboardDetectionService {
  private static instance: KeyboardDetectionService;
  private listeners: KeyboardListener[] = [];
  private currentState: KeyboardState = {
    isVisible: false,
    height: 0,
    timestamp: Date.now()
  };
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 100;

  static getInstance(): KeyboardDetectionService {
    if (!KeyboardDetectionService.instance) {
      KeyboardDetectionService.instance = new KeyboardDetectionService();
    }
    return KeyboardDetectionService.instance;
  }

  private constructor() {
    this.initializeKeyboardDetection();
  }

  private initializeKeyboardDetection(): void {
    console.log('[KeyboardDetection] Initializing keyboard detection service');

    // Primary detection via Visual Viewport API
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.handleViewportChange.bind(this));
      console.log('[KeyboardDetection] Visual Viewport API listener attached');
    }

    // Fallback detection via window resize
    window.addEventListener('resize', this.handleWindowResize.bind(this));

    // Capacitor keyboard plugin detection
    if ((window as any).Capacitor?.Plugins?.Keyboard) {
      const { Keyboard } = (window as any).Capacitor.Plugins;
      
      Keyboard.addListener('keyboardWillShow', (info: any) => {
        console.log('[KeyboardDetection] Capacitor: Keyboard will show', info);
        this.updateKeyboardState(true, info.keyboardHeight || 0);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        console.log('[KeyboardDetection] Capacitor: Keyboard will hide');
        this.updateKeyboardState(false, 0);
      });

      console.log('[KeyboardDetection] Capacitor keyboard listeners attached');
    }

    // Initial state check
    this.checkInitialState();
  }

  private handleViewportChange(): void {
    if (!window.visualViewport) return;

    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    const heightDifference = windowHeight - viewportHeight;
    
    // More sensitive detection threshold for Android
    const isKeyboardVisible = heightDifference > 150;
    
    console.log('[KeyboardDetection] Viewport change:', {
      viewportHeight,
      windowHeight,
      heightDifference,
      isKeyboardVisible,
      currentState: this.currentState.isVisible
    });

    this.updateKeyboardState(isKeyboardVisible, heightDifference);
  }

  private handleWindowResize(): void {
    // Only use as fallback if Visual Viewport is not available
    if (window.visualViewport) return;

    const currentHeight = window.innerHeight;
    const screenHeight = window.screen.height;
    const heightDifference = screenHeight - currentHeight;
    
    const isKeyboardVisible = heightDifference > 200;
    
    console.log('[KeyboardDetection] Window resize fallback:', {
      currentHeight,
      screenHeight,
      heightDifference,
      isKeyboardVisible
    });

    this.updateKeyboardState(isKeyboardVisible, heightDifference);
  }

  private checkInitialState(): void {
    if (window.visualViewport) {
      const heightDifference = window.innerHeight - window.visualViewport.height;
      const isKeyboardVisible = heightDifference > 150;
      
      console.log('[KeyboardDetection] Initial state check:', {
        isKeyboardVisible,
        heightDifference
      });

      this.updateKeyboardState(isKeyboardVisible, heightDifference);
    }
  }

  private updateKeyboardState(isVisible: boolean, height: number): void {
    // Debounce rapid state changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const previousState = this.currentState.isVisible;
      
      this.currentState = {
        isVisible,
        height: Math.max(0, height),
        timestamp: Date.now()
      };

      // Only notify if state actually changed
      if (previousState !== isVisible) {
        console.log('[KeyboardDetection] State changed:', this.currentState);
        this.notifyListeners();
        
        // Dispatch global events for backward compatibility
        const eventName = isVisible ? 'keyboardOpen' : 'keyboardClose';
        window.dispatchEvent(new CustomEvent(eventName, { 
          detail: this.currentState 
        }));

        // Update body classes
        if (isVisible) {
          document.body.classList.add('keyboard-visible');
        } else {
          document.body.classList.remove('keyboard-visible');
        }
      }
    }, this.DEBOUNCE_DELAY);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener.callback(this.currentState);
      } catch (error) {
        console.error(`[KeyboardDetection] Error in listener ${listener.id}:`, error);
      }
    });
  }

  public addListener(id: string, callback: (state: KeyboardState) => void): void {
    this.listeners.push({ id, callback });
    
    // Immediately call with current state
    callback(this.currentState);
    
    console.log(`[KeyboardDetection] Listener added: ${id}`);
  }

  public removeListener(id: string): void {
    this.listeners = this.listeners.filter(listener => listener.id !== id);
    console.log(`[KeyboardDetection] Listener removed: ${id}`);
  }

  public getCurrentState(): KeyboardState {
    return { ...this.currentState };
  }

  public isKeyboardVisible(): boolean {
    return this.currentState.isVisible;
  }

  public getKeyboardHeight(): number {
    return this.currentState.height;
  }
}

export const keyboardDetectionService = KeyboardDetectionService.getInstance();
export type { KeyboardState };
