/**
 * Secure authentication token storage utility
 * Replaces direct localStorage usage for session tokens with encrypted storage
 */

import { secureSessionStorage } from './secureSessionStorage';

const AUTH_TOKEN_KEY = 'sb-kwnwhgucnzqxndzjayyq-auth-token';

export class AuthTokenStorage {
  private static instance: AuthTokenStorage;
  
  static getInstance(): AuthTokenStorage {
    if (!AuthTokenStorage.instance) {
      AuthTokenStorage.instance = new AuthTokenStorage();
    }
    return AuthTokenStorage.instance;
  }

  /**
   * Store authentication token securely
   */
  setAuthToken(token: string): void {
    try {
      // Use secure storage instead of plain localStorage
      secureSessionStorage.setSecureItem('auth_token', token, true);
      
      // Also maintain the original key for compatibility
      secureSessionStorage.setSecureItem(AUTH_TOKEN_KEY, token, true);
      
      console.log('[AuthTokenStorage] Token stored securely');
    } catch (error) {
      console.error('[AuthTokenStorage] Failed to store token:', error);
      // Fallback to sessionStorage (encrypted) if localStorage fails
      try {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch (fallbackError) {
        console.error('[AuthTokenStorage] Fallback storage also failed:', fallbackError);
      }
    }
  }

  /**
   * Retrieve authentication token securely
   */
  getAuthToken(): string | null {
    try {
      // Try to get from secure storage first
      let token = secureSessionStorage.getSecureItem('auth_token');
      
      if (!token) {
        // Fallback to the original key
        token = secureSessionStorage.getSecureItem(AUTH_TOKEN_KEY);
      }
      
      if (!token) {
        // Migration: Check if token exists in plain localStorage and migrate it
        const plainToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (plainToken) {
          console.log('[AuthTokenStorage] Migrating token from localStorage to secure storage');
          this.setAuthToken(plainToken);
          // Remove from localStorage after migration
          localStorage.removeItem(AUTH_TOKEN_KEY);
          return plainToken;
        }
        
        // Last resort: check sessionStorage
        token = sessionStorage.getItem(AUTH_TOKEN_KEY);
      }
      
      return token;
    } catch (error) {
      console.error('[AuthTokenStorage] Failed to retrieve token:', error);
      // Fallback to sessionStorage
      try {
        return sessionStorage.getItem(AUTH_TOKEN_KEY);
      } catch (fallbackError) {
        console.error('[AuthTokenStorage] Fallback retrieval also failed:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Remove authentication token
   */
  removeAuthToken(): void {
    try {
      secureSessionStorage.removeSecureItem('auth_token');
      secureSessionStorage.removeSecureItem(AUTH_TOKEN_KEY);
      
      // Also remove from localStorage and sessionStorage for cleanup
      localStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      
      console.log('[AuthTokenStorage] Token removed from all storage');
    } catch (error) {
      console.error('[AuthTokenStorage] Failed to remove token:', error);
    }
  }

  /**
   * Check if auth token exists
   */
  hasAuthToken(): boolean {
    return this.getAuthToken() !== null;
  }
}

export const authTokenStorage = AuthTokenStorage.getInstance();