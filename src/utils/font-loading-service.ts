
/**
 * Enhanced Font Loading Service
 * Provides robust font loading with error recovery and caching
 */

interface FontLoadingOptions {
  timeout?: number;
  retries?: number;
  fallbackFonts?: string[];
}

interface FontLoadingResult {
  success: boolean;
  font: string;
  loadTime: number;
  error?: string;
}

class FontLoadingService {
  private loadedFonts = new Set<string>();
  private loadingPromises = new Map<string, Promise<FontLoadingResult>>();
  private fontCache = new Map<string, FontFace>();

  /**
   * Load a single font with retry logic and timeout
   */
  async loadFont(
    fontFamily: string, 
    options: FontLoadingOptions = {}
  ): Promise<FontLoadingResult> {
    const {
      timeout = 5000,
      retries = 2,
      fallbackFonts = ['Arial', 'sans-serif']
    } = options;

    // Check if already loaded
    if (this.loadedFonts.has(fontFamily)) {
      return {
        success: true,
        font: fontFamily,
        loadTime: 0
      };
    }

    // Check if loading is in progress
    if (this.loadingPromises.has(fontFamily)) {
      return this.loadingPromises.get(fontFamily)!;
    }

    const loadingPromise = this.performFontLoad(fontFamily, timeout, retries, fallbackFonts);
    this.loadingPromises.set(fontFamily, loadingPromise);

    try {
      const result = await loadingPromise;
      if (result.success) {
        this.loadedFonts.add(fontFamily);
      }
      return result;
    } finally {
      this.loadingPromises.delete(fontFamily);
    }
  }

  /**
   * Perform the actual font loading with retries
   */
  private async performFontLoad(
    fontFamily: string,
    timeout: number,
    retries: number,
    fallbackFonts: string[]
  ): Promise<FontLoadingResult> {
    const startTime = Date.now();

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Check if font is already available
        if (document.fonts?.check?.(`12px "${fontFamily}"`)) {
          return {
            success: true,
            font: fontFamily,
            loadTime: Date.now() - startTime
          };
        }

        // Try to load the font
        const fontFace = new FontFace(fontFamily, `local("${fontFamily}")`);
        
        const loadResult = await Promise.race([
          fontFace.load(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Font loading timeout')), timeout)
          )
        ]);

        // Add to document fonts if successful
        if (document.fonts) {
          document.fonts.add(fontFace);
        }

        this.fontCache.set(fontFamily, fontFace);

        return {
          success: true,
          font: fontFamily,
          loadTime: Date.now() - startTime
        };

      } catch (error) {
        console.warn(`Font loading attempt ${attempt + 1} failed for ${fontFamily}:`, error);
        
        if (attempt < retries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
        }
      }
    }

    // All attempts failed, try fallback fonts
    for (const fallbackFont of fallbackFonts) {
      try {
        if (document.fonts?.check?.(`12px "${fallbackFont}"`)) {
          console.log(`Using fallback font: ${fallbackFont} for ${fontFamily}`);
          return {
            success: true,
            font: fallbackFont,
            loadTime: Date.now() - startTime
          };
        }
      } catch (error) {
        console.warn(`Fallback font check failed for ${fallbackFont}:`, error);
      }
    }

    return {
      success: false,
      font: fontFamily,
      loadTime: Date.now() - startTime,
      error: `Failed to load ${fontFamily} after ${retries + 1} attempts`
    };
  }

  /**
   * Load multiple fonts in parallel
   */
  async loadFonts(fonts: string[], options: FontLoadingOptions = {}): Promise<FontLoadingResult[]> {
    const loadPromises = fonts.map(font => this.loadFont(font, options));
    return Promise.all(loadPromises);
  }

  /**
   * Preload critical fonts for better performance
   */
  async preloadCriticalFonts(): Promise<void> {
    const criticalFonts = [
      'Inter',
      'Noto Sans',
      'Arial',
      'Helvetica',
      'system-ui'
    ];

    try {
      const results = await this.loadFonts(criticalFonts, { timeout: 3000, retries: 1 });
      const loadedCount = results.filter(r => r.success).length;
      console.log(`FontLoadingService: Preloaded ${loadedCount}/${criticalFonts.length} critical fonts`);
    } catch (error) {
      console.error('FontLoadingService: Critical font preloading failed:', error);
    }
  }

  /**
   * Check if a font is loaded
   */
  isFontLoaded(fontFamily: string): boolean {
    return this.loadedFonts.has(fontFamily);
  }

  /**
   * Get loading statistics
   */
  getLoadingStats() {
    return {
      loadedFonts: Array.from(this.loadedFonts),
      loadedCount: this.loadedFonts.size,
      pendingLoads: this.loadingPromises.size
    };
  }

  /**
   * Clear font cache
   */
  clearCache(): void {
    this.loadedFonts.clear();
    this.loadingPromises.clear();
    this.fontCache.clear();
  }
}

// Export singleton instance
export const fontLoadingService = new FontLoadingService();

// Initialize critical fonts on module load
if (typeof window !== 'undefined') {
  fontLoadingService.preloadCriticalFonts().catch(console.error);
}
