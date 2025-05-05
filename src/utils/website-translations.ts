
import { staticTranslationService } from '@/services/staticTranslationService';

// This utility helps preload common website translations
export const preloadWebsiteTranslations = async (language: string) => {
  if (language === 'en') return; // Skip for English
  
  console.log(`Preloading website translations for ${language}`);
  
  const commonTexts = [
    // Navigation
    'Home', 'Features', 'Pricing', 'Blog', 'Download', 'Login', 
    
    // Homepage
    'Your Voice, Your Journey', 
    'Discover deeper self-awareness through voice journaling',
    'Start your free trial',
    'No credit card required',
    'Learn more',
    'Download App',
    
    // Features
    'Features', 
    'Why SOuLO?',
    'Voice Journaling',
    'AI Insights',
    'Mood Tracking',
    'Private & Secure',
    
    // Onboarding
    'Welcome to SOuLO',
    'Your Data is Private',
    'Voice Journaling',
    'AI Analysis',
    'Chat with Your Journal',
    'Track Your Emotional Journey',
    'What Should We Call You?',
    'Ready to Start Your Journey?',
    'Preferred Language',
    'Skip',
    'Get Started',
    'Next',
    'Continue',
    'Sign In',
    'Enter your name',
    'This is how SOuLO will address you',
    'Joy', 'Growth', 'Progress', 'Health', 'Focus', 'Connection', 'Creativity',
    'Mood Trends',
    'Jan', 'Mar', 'Now',
    'How have I been feeling lately?',
    "Based on your recent entries, you've been feeling more positive and energetic this week...",
    
    // Footer
    'Download on App Store',
    'Get it on Google Play',
    'Contact us at',
    'Privacy Policy',
    'Terms of Service',
    'FAQ',
    'All rights reserved.'
  ];
  
  try {
    // Batch translate all common texts
    const translations = await staticTranslationService.preTranslate(commonTexts);
    console.log(`Preloaded ${translations.size} website translations`);
    return translations;
  } catch (error) {
    console.error('Failed to preload website translations:', error);
    return new Map();
  }
};

export const translateWebsiteText = async (text: string): Promise<string> => {
  if (!text) return '';
  
  try {
    return await staticTranslationService.translateText(text, 'en');
  } catch (error) {
    console.error(`Failed to translate website text: "${text}"`, error);
    return text;
  }
};

// Singleton for caching on-demand translations
class TranslationCache {
  private cache = new Map<string, Map<string, string>>();
  
  getTranslation(text: string, language: string): string | null {
    if (language === 'en') return text;
    
    const languageCache = this.cache.get(language);
    if (languageCache) {
      return languageCache.get(text) || null;
    }
    return null;
  }
  
  setTranslation(text: string, translatedText: string, language: string): void {
    if (language === 'en' || !text || !translatedText) return;
    
    let languageCache = this.cache.get(language);
    if (!languageCache) {
      languageCache = new Map<string, string>();
      this.cache.set(language, languageCache);
    }
    
    languageCache.set(text, translatedText);
  }
  
  // Clear all translations for a specific language
  clearLanguage(language: string): void {
    this.cache.delete(language);
  }
  
  // Clear all translations
  clearAll(): void {
    this.cache.clear();
  }
}

export const onDemandTranslationCache = new TranslationCache();
