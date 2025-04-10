
// Define all supported languages
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'hi' | 'pt' | 'ru' | 'ar';

// Define the structure of translations
export interface TranslationKeys {
  // Common
  appName: string;
  tagline: string;
  
  // Navigation
  home: string;
  features: string;
  pricing: string;
  blog: string;
  about: string;
  login: string;
  signup: string;
  tryNow: string;
  
  // Hero Section
  heroTitle: string;
  heroSubtitle: string;
  downloadApp: string;
  exploreBlog: string;
  
  // Feature Section
  featuresTitle: string;
  featuresSubtitle: string;
  voiceJournaling: string;
  voiceJournalingDesc: string;
  aiAnalysis: string;
  aiAnalysisDesc: string;
  emotionalTracking: string;
  emotionalTrackingDesc: string;
  aiAssistant: string;
  aiAssistantDesc: string;
  
  // Process Section
  processTitle: string;
  processSubtitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  
  // Download Section
  downloadTitle: string;
  downloadSubtitle: string;
  appStore: string;
  googlePlay: string;
  
  // Footer
  footerRights: string;
  privacyPolicy: string;
  termsOfService: string;
  contact: string;
}

// Default English translations
export const enTranslations: TranslationKeys = {
  // Common
  appName: 'SOuLO',
  tagline: 'Express. Reflect. Grow.',
  
  // Navigation
  home: 'Home',
  features: 'Features',
  pricing: 'Pricing',
  blog: 'Blog',
  about: 'About',
  login: 'Log In',
  signup: 'Sign Up',
  tryNow: 'Try Now',
  
  // Hero Section
  heroTitle: 'Express. Reflect. Grow.',
  heroSubtitle: 'Discover yourself through voice journaling and AI-powered insights with SOuLO.',
  downloadApp: 'Download App',
  exploreBlog: 'Explore Blog',
  
  // Feature Section
  featuresTitle: 'How SOuLO Works',
  featuresSubtitle: 'Our innovative approach combines voice journaling with AI technology to provide you with meaningful insights about yourself.',
  voiceJournaling: 'Voice Journaling',
  voiceJournalingDesc: 'Record your thoughts with voice and let SOuLO transcribe and analyze them automatically.',
  aiAnalysis: 'AI Analysis',
  aiAnalysisDesc: 'Gain insights into your patterns and emotions through advanced AI analysis.',
  emotionalTracking: 'Emotional Tracking',
  emotionalTrackingDesc: 'Visualize your emotional journey over time with interactive charts.',
  aiAssistant: 'AI Assistant',
  aiAssistantDesc: 'Chat with your journal and get personalized insights from your past entries.',
  
  // Process Section
  processTitle: 'How It Works',
  processSubtitle: 'Start your self-discovery journey in three simple steps',
  step1Title: 'Record Your Thoughts',
  step1Desc: 'Speak freely about your day, feelings, or any thoughts you want to capture. No writing required!',
  step2Title: 'AI Analyzes Your Entry',
  step2Desc: 'Our AI transcribes your voice and analyzes the emotional patterns and key themes in your entry.',
  step3Title: 'Gain Personalized Insights',
  step3Desc: 'Discover patterns, track emotional trends over time, and get personalized insights to support your growth.',
  
  // Download Section
  downloadTitle: 'Download and Start Using SOuLO Today!',
  downloadSubtitle: 'It\'s free to download and easy to use. Begin your journey of self-discovery with SOuLO - your personal companion for emotional wellness.',
  appStore: 'App Store',
  googlePlay: 'Google Play',
  
  // Footer
  footerRights: 'All rights reserved',
  privacyPolicy: 'Privacy Policy',
  termsOfService: 'Terms of Service',
  contact: 'Contact'
};

// Create a translations object with all supported languages
// For now, we're just using English as the default for all languages
// In a real app, you would translate each language properly
export const translations: Record<SupportedLanguage, TranslationKeys> = {
  en: enTranslations,
  // These would all be properly translated in a real implementation
  es: enTranslations,
  fr: enTranslations,
  de: enTranslations,
  zh: enTranslations,
  ja: enTranslations,
  hi: enTranslations,
  pt: enTranslations,
  ru: enTranslations,
  ar: enTranslations
};

// Get the current language from localStorage or default to English
export const getCurrentLanguage = (): SupportedLanguage => {
  if (typeof window === 'undefined') return 'en';
  
  const saved = localStorage.getItem('preferredLanguage') as SupportedLanguage;
  return saved || 'en';
};

// Get translations for the current language
export const getTranslations = (): TranslationKeys => {
  const lang = getCurrentLanguage();
  return translations[lang] || translations.en;
};

// Create a hook to use translations
export const useTranslations = () => {
  return getTranslations();
};

export default translations;
