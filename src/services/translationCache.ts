
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

  async initialize() {
    this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('translations')) {
          db.createObjectStore('translations');
        }
        if (!db.objectStoreNames.contains('languageMetadata')) {
          db.createObjectStore('languageMetadata');
        }
      },
    });
  }

  async getTranslation(originalText: string, language: string): Promise<TranslationRecord | null> {
    if (!this.db) await this.initialize();
    const key = `${originalText}_${language}`;
    return this.db!.get('translations', key);
  }

  async setTranslation(record: TranslationRecord): Promise<void> {
    if (!this.db) await this.initialize();
    const key = `${record.originalText}_${record.language}`;
    await this.db!.put('translations', record, key);
  }

  async clearCache(): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.clear('translations');
  }

  async getLanguageMetadata(language: string): Promise<LanguageMetadata | null> {
    if (!this.db) await this.initialize();
    return this.db!.get('languageMetadata', language);
  }

  async setLanguageMetadata(language: string, metadata: LanguageMetadata): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.put('languageMetadata', metadata, language);
  }
}

export const translationCache = new TranslationCache();
