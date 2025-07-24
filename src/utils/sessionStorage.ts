/**
 * Session Storage Utilities for Dynamic Key Detection
 * Fixes hardcoded session storage key issues in native apps
 */

export class SessionStorageManager {
  private static instance: SessionStorageManager;
  private sessionKey: string | null = null;
  private readonly keyPattern = /^sb-[a-z0-9]+-auth-token$/;

  private constructor() {}

  static getInstance(): SessionStorageManager {
    if (!SessionStorageManager.instance) {
      SessionStorageManager.instance = new SessionStorageManager();
    }
    return SessionStorageManager.instance;
  }

  /**
   * Dynamically detect the Supabase session storage key
   */
  detectSessionKey(): string | null {
    if (this.sessionKey) {
      return this.sessionKey;
    }

    try {
      // Search localStorage for Supabase auth token key
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && this.keyPattern.test(key)) {
          console.log('[SessionStorage] Detected session key:', key);
          this.sessionKey = key;
          return key;
        }
      }

      // Fallback to known project key if nothing found
      const fallbackKey = 'sb-kwnwhgucnzqxndzjayyq-auth-token';
      console.warn('[SessionStorage] No dynamic key found, using fallback:', fallbackKey);
      this.sessionKey = fallbackKey;
      return fallbackKey;
    } catch (error) {
      console.error('[SessionStorage] Error detecting session key:', error);
      return null;
    }
  }

  /**
   * Get stored session data with dynamic key detection
   */
  getStoredSession(): any | null {
    const key = this.detectSessionKey();
    if (!key) return null;

    try {
      const storedData = localStorage.getItem(key);
      if (!storedData) return null;

      const sessionData = JSON.parse(storedData);
      return sessionData;
    } catch (error) {
      console.error('[SessionStorage] Error parsing stored session:', error);
      return null;
    }
  }

  /**
   * Validate session structure and expiry
   */
  validateSession(session: any): boolean {
    if (!session) return false;

    // Check required fields
    if (!session.access_token || !session.expires_at) {
      console.warn('[SessionStorage] Session missing required fields');
      return false;
    }

    // Check expiry
    const now = Date.now() / 1000;
    if (session.expires_at <= now) {
      console.warn('[SessionStorage] Session expired');
      return false;
    }

    return true;
  }

  /**
   * Clear session data
   */
  clearSession(): void {
    const key = this.detectSessionKey();
    if (key) {
      localStorage.removeItem(key);
      console.log('[SessionStorage] Session cleared');
    }
    this.sessionKey = null;
  }
}

export const sessionStorageManager = SessionStorageManager.getInstance();