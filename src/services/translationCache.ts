
import { openDB, IDBPDatabase } from 'idb';

interface TranslationEntry {
  originalText: string;
  translatedText: string;
  language: string;
  timestamp: number;
  version: number;
}

class TranslationCache {
  private dbPromise: Promise<IDBPDatabase>;
  private readonly DB_NAME = 'translation-cache';
  private readonly STORE_NAME = 'translations';
  private readonly DB_VERSION = 1;

  constructor() {
    this.dbPromise = this.initDatabase();
  }

  private async initDatabase(): Promise<IDBPDatabase> {
    return openDB(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains('translations')) {
          const store = db.createObjectStore('translations', { keyPath: 'id' });
          store.createIndex('language', 'language', { unique: false });
          console.log('TranslationCache: Created translations store');
        }
      },
    });
  }

  // Generate a consistent ID for caching
  private generateId(text: string, language: string): string {
    return `${language}-${text.substring(0, 50)}`;
  }

  async getTranslation(originalText: string, targetLanguage: string): Promise<TranslationEntry | undefined> {
    try {
      const db = await this.dbPromise;
      const id = this.generateId(originalText, targetLanguage);
      return db.get(this.STORE_NAME, id);
    } catch (error) {
      console.error('TranslationCache: Error getting translation:', error);
      return undefined;
    }
  }

  async setTranslation(entry: TranslationEntry): Promise<void> {
    try {
      const db = await this.dbPromise;
      const id = this.generateId(entry.originalText, entry.language);
      await db.put(this.STORE_NAME, {
        ...entry,
        id,
      });
    } catch (error) {
      console.error('TranslationCache: Error setting translation:', error);
    }
  }

  // Clear all cached translations for a specific language
  async clearCache(language: string): Promise<void> {
    try {
      console.log(`TranslationCache: Clearing cache for language ${language}`);
      const db = await this.dbPromise;
      
      // Get all keys from the object store
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const index = store.index('language');
      let cursor = await index.openCursor(language);
      
      // Delete each entry for the specified language
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      
      await tx.done;
      console.log(`TranslationCache: Successfully cleared cache for ${language}`);
    } catch (error) {
      console.error(`TranslationCache: Error clearing cache for ${language}:`, error);
    }
  }

  // For debugging - get all translations
  async getAllTranslations(): Promise<TranslationEntry[]> {
    try {
      const db = await this.dbPromise;
      return db.getAll(this.STORE_NAME);
    } catch (error) {
      console.error('TranslationCache: Error getting all translations:', error);
      return [];
    }
  }
}

export const translationCache = new TranslationCache();
