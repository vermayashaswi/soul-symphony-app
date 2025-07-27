/**
 * Secure session storage utility
 * Addresses client-side session storage vulnerabilities by providing
 * encrypted storage for sensitive data like session tokens
 */

interface SecureStorageData {
  value: string;
  timestamp: number;
  encrypted?: boolean;
}

class SecureSessionStorage {
  private static instance: SecureSessionStorage;
  private readonly keyPrefix = 'soulo_secure_';
  
  static getInstance(): SecureSessionStorage {
    if (!SecureSessionStorage.instance) {
      SecureSessionStorage.instance = new SecureSessionStorage();
    }
    return SecureSessionStorage.instance;
  }

  /**
   * Simple encryption using Base64 encoding with rotation
   * Note: This is basic obfuscation, not cryptographic security
   * For production apps, consider using Web Crypto API
   */
  private encrypt(value: string): string {
    try {
      const rotated = value.split('').map(char => 
        String.fromCharCode((char.charCodeAt(0) + 13) % 65536)
      ).join('');
      return btoa(rotated);
    } catch {
      return value; // Fallback to plain text if encryption fails
    }
  }

  private decrypt(encrypted: string): string {
    try {
      const decoded = atob(encrypted);
      return decoded.split('').map(char => 
        String.fromCharCode((char.charCodeAt(0) - 13 + 65536) % 65536)
      ).join('');
    } catch {
      return encrypted; // Fallback to returning as-is if decryption fails
    }
  }

  /**
   * Store sensitive data with encryption and timestamp
   */
  setSecureItem(key: string, value: string, encrypt: boolean = true): void {
    try {
      const data: SecureStorageData = {
        value: encrypt ? this.encrypt(value) : value,
        timestamp: Date.now(),
        encrypted: encrypt
      };
      
      sessionStorage.setItem(
        this.keyPrefix + key, 
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn('Failed to store secure session data:', error);
    }
  }

  /**
   * Retrieve and decrypt sensitive data
   */
  getSecureItem(key: string): string | null {
    try {
      const stored = sessionStorage.getItem(this.keyPrefix + key);
      if (!stored) return null;

      const data: SecureStorageData = JSON.parse(stored);
      
      // Check if data is too old (24 hours)
      if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        this.removeSecureItem(key);
        return null;
      }

      return data.encrypted ? this.decrypt(data.value) : data.value;
    } catch (error) {
      console.warn('Failed to retrieve secure session data:', error);
      return null;
    }
  }

  /**
   * Remove sensitive data
   */
  removeSecureItem(key: string): void {
    try {
      sessionStorage.removeItem(this.keyPrefix + key);
    } catch (error) {
      console.warn('Failed to remove secure session data:', error);
    }
  }

  /**
   * Clear all secure storage items
   */
  clearAllSecureItems(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.keyPrefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear secure session storage:', error);
    }
  }

  /**
   * Store authentication tokens securely
   */
  setAuthTokens(accessToken: string, refreshToken?: string): void {
    this.setSecureItem('access_token', accessToken, true);
    if (refreshToken) {
      this.setSecureItem('refresh_token', refreshToken, true);
    }
  }

  /**
   * Retrieve authentication tokens
   */
  getAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
    return {
      accessToken: this.getSecureItem('access_token'),
      refreshToken: this.getSecureItem('refresh_token')
    };
  }

  /**
   * Clear authentication tokens
   */
  clearAuthTokens(): void {
    this.removeSecureItem('access_token');
    this.removeSecureItem('refresh_token');
  }
}

export const secureSessionStorage = SecureSessionStorage.getInstance();