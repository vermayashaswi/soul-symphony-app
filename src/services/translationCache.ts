
import { openDB, IDBPDatabase } from 'idb';

interface TranslationRecord {
  originalText: string;
  translatedText: string;
  language: string;
  timestamp: number;
  version: number;
}

interface LanguageMetadata {
  lastUpdated: number;
  version: number;
  available: boolean;
  completionPercentage: number;
}

class TranslationCache {
  private db: IDBPDatabase | null = null;
  private readonly DB_NAME = 'translations_db';
  private readonly DB_VERSION = 1;
  private initPromise: Promise<IDBPDatabase> | null = null;

  async initialize() {
    if (this.initPromise) return this.initPromise;
    
    console.log('Initializing translation cache database');
    
    this.initPromise = openDB(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        console.log('Upgrading translation cache database');
        if (!db.objectStoreNames.contains('translations')) {
          db.createObjectStore('translations');
        }
        if (!db.objectStoreNames.contains('languageMetadata')) {
          db.createObjectStore('languageMetadata');
        }
      },
    });
    
    try {
      this.db = await this.initPromise;
      console.log('Translation cache database initialized successfully');
      return this.db;
    } catch (error) {
      console.error('Failed to initialize translation cache:', error);
      this.initPromise = null;
      throw error;
    }
  }

  async getTranslation(originalText: string, language: string): Promise<TranslationRecord | null> {
    try {
      if (!this.db) await this.initialize();
      const key = `${originalText}_${language}`;
      return this.db!.get('translations', key);
    } catch (error) {
      console.error('Error getting translation from cache:', error);
      return null;
    }
  }

  async setTranslation(record: TranslationRecord): Promise<void> {
    try {
      if (!this.db) await this.initialize();
      const key = `${record.originalText}_${record.language}`;
      await this.db!.put('translations', record, key);
    } catch (error) {
      console.error('Error setting translation in cache:', error);
    }
  }

  async clearCache(): Promise<void> {
    try {
      if (!this.db) await this.initialize();
      await this.db!.clear('translations');
    } catch (error) {
      console.error('Error clearing translation cache:', error);
    }
  }

  async getLanguageMetadata(language: string): Promise<LanguageMetadata | null> {
    try {
      if (!this.db) await this.initialize();
      return this.db!.get('languageMetadata', language);
    } catch (error) {
      console.error('Error getting language metadata from cache:', error);
      return null;
    }
  }

  async setLanguageMetadata(language: string, metadata: LanguageMetadata): Promise<void> {
    try {
      if (!this.db) await this.initialize();
      await this.db!.put('languageMetadata', metadata, language);
    } catch (error) {
      console.error('Error setting language metadata in cache:', error);
    }
  }
}

export const translationCache = new TranslationCache();
