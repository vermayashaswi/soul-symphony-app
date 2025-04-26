
import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { createDebugger } from '@/utils/debug/debugUtils';

const debug = createDebugger('languageSelector');

// Explicitly declare google types to ensure TypeScript recognizes them
declare global {
  interface Window {
    google: typeof google;
    googleTranslateElementInit: () => void;
  }
}

const LanguageSelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [translationState, setTranslationState] = useState<'loading' | 'ready' | 'error'>('loading');

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },        // Mandarin
    { code: 'hi', label: 'हिंदी' },       // Hindi
    { code: 'es', label: 'Español' },     // Spanish
    { code: 'ar', label: 'العربية' },     // Arabic
    { code: 'fr', label: 'Français' },    // French
    { code: 'bn', label: 'বাংলা' },       // Bengali
    { code: 'pt', label: 'Português' },   // Portuguese
    { code: 'ru', label: 'Русский' },     // Russian
    { code: 'ur', label: 'اردو' },        // Urdu
    { code: 'id', label: 'Indonesia' },   // Indonesian
    { code: 'de', label: 'Deutsch' },     // German
    { code: 'ja', label: '日本語' },      // Japanese
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },      // Punjabi
    { code: 'te', label: 'తెలుగు' },      // Telugu
    { code: 'mr', label: 'मराठी' },       // Marathi
    { code: 'tr', label: 'Türkçe' },     // Turkish
    { code: 'ta', label: 'தமிழ்' },       // Tamil
    { code: 'vi', label: 'Tiếng Việt' }, // Vietnamese
    { code: 'ko', label: '한국어' },      // Korean
    { code: 'jw', label: 'Basa Jawa' },  // Javanese
    { code: 'gu', label: 'ગુજરાતી' },     // Gujarati
    { code: 'kn', label: 'ಕನ್ನಡ' },       // Kannada
    { code: 'ml', label: 'മലയാളം' },     // Malayalam
    { code: 'tl', label: 'Filipino' },    // Tagalog
    { code: 'sw', label: 'Kiswahili' }   // Swahili
  ];

  useEffect(() => {
    let initAttempts = 0;
    const maxAttempts = 10;
    const initInterval = 500;

    const initializeTranslation = () => {
      try {
        if (!document.getElementById('google_translate_element')) {
          const div = document.createElement('div');
          div.id = 'google_translate_element';
          div.style.position = 'absolute';
          div.style.top = '-9999px';
          div.style.left = '-9999px';
          document.body.appendChild(div);
        }

        // Type guard to check if Google Translate is available
        if (typeof window.google === 'undefined' || 
            !window.google.translate) {
          if (initAttempts < maxAttempts) {
            initAttempts++;
            setTimeout(initializeTranslation, initInterval);
          } else {
            setTranslationState('error');
            toast.error('Translation service failed to load');
          }
          return;
        }

        window.googleTranslateElementInit = () => {
          try {
            // Check if Google Translate API is available
            if (window.google && 
                window.google.translate && 
                window.google.translate.TranslateElement) {
              
              new window.google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: languages.map(lang => lang.code).join(','),
                layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
                autoDisplay: false
              }, 'google_translate_element');
              
              setTranslationState('ready');
            } else {
              throw new Error('Google Translate API not available');
            }
          } catch (err) {
            console.error('Error in translation initialization:', err);
            setTranslationState('error');
            toast.error('Translation service failed to initialize');
          }
        };

        // Force trigger initialization if needed
        if (window.google && 
            window.google.translate && 
            window.google.translate.TranslateElement) {
          window.googleTranslateElementInit();
        }

        setTranslationState('ready');
      } catch (error) {
        console.error('Error setting up translation:', error);
        setTranslationState('error');
        toast.error('Error setting up translation service');
      }
    };

    initializeTranslation();

    return () => {
      initAttempts = maxAttempts; // Stop any pending initialization attempts
    };
  }, []);

  const handleLanguageChange = (languageCode: string) => {
    debug.info('Language change requested:', languageCode);
    
    if (translationState !== 'ready') {
      toast.error('Language selector not ready. Please try again in a moment.');
      return;
    }
    
    try {
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (select) {
        select.value = languageCode;
        select.dispatchEvent(new Event('change'));
        setSelectedLanguage(languageCode);
        
        const selectedLang = languages.find(lang => lang.code === languageCode);
        toast.success(`Language changed to ${selectedLang?.label || languageCode}`);
      } else {
        console.error('Google Translate widget not found');
        setTranslationState('error');
        toast.error('Translation service unavailable. Please refresh the page.');
      }
    } catch (err) {
      console.error('Error changing language:', err);
      toast.error('Error changing language. Please try again.');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Select language"
          title={translationState === 'ready' ? "Select language" : 
                 translationState === 'loading' ? "Language selector loading..." : 
                 "Translation service unavailable"}
          className={translationState === 'error' ? "bg-red-100/10" : ""}
        >
          <Globe className={`h-5 w-5 ${translationState !== 'ready' ? 'opacity-50' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto">
        {translationState === 'error' && (
          <div className="px-2 py-1.5 text-sm text-red-500">
            Translation service unavailable
          </div>
        )}
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer ${
              selectedLanguage === language.code 
                ? "bg-primary/10 text-primary font-medium"
                : ""
            }`}
            disabled={translationState !== 'ready'}
          >
            {language.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
