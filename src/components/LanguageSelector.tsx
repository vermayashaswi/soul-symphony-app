
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

  // Load Google Translate API script manually if needed
  useEffect(() => {
    // Check if Google Translate script is already loaded
    const scriptExists = document.querySelector('script[src*="translate_a/element.js"]');
    
    if (!scriptExists) {
      console.log('Loading Google Translate script manually');
      const script = document.createElement('script');
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.defer = true;
      
      script.onerror = () => {
        console.error('Failed to load Google Translate script');
        setTranslationState('error');
        toast.error('Translation service failed to load');
      };
      
      document.body.appendChild(script);
    }
    
    // Define the global callback function
    window.googleTranslateElementInit = () => {
      try {
        console.log('Google Translate initialization called');
        if (!document.getElementById('google_translate_element')) {
          const div = document.createElement('div');
          div.id = 'google_translate_element';
          div.style.position = 'absolute';
          div.style.top = '-9999px';
          div.style.left = '-9999px';
          document.body.appendChild(div);
        }
        
        new google.translate.TranslateElement({
          pageLanguage: 'en',
          includedLanguages: 'ar,bn,de,en,es,fr,gu,hi,id,ja,jw,kn,ko,ml,mr,pa,pt,ru,sw,ta,te,tl,tr,ur,vi,zh',
          layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
      } catch (err) {
        console.error('Error in googleTranslateElementInit:', err);
        setTranslationState('error');
        toast.error('Translation service failed to initialize');
      }
    };
    
    const checkGoogleTranslateLoaded = () => {
      return typeof google !== 'undefined' && 
             google.translate && 
             document.querySelector('.goog-te-combo');
    };

    // Initialize translation or set up polling if not ready
    const initializeTranslation = () => {
      // Check if Google Translate is ready
      if (checkGoogleTranslateLoaded()) {
        console.log('Google Translate is ready');
        forceEnglishLanguage();
        setTranslationState('ready');
        return true;
      }
      return false;
    };
    
    // Force English as initial language
    const forceEnglishLanguage = () => {
      try {
        const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
        if (select) {
          console.log('Setting initial language to English');
          select.value = 'en';
          select.dispatchEvent(new Event('change'));
          setSelectedLanguage('en');
        }
      } catch (err) {
        console.error('Error forcing English language:', err);
      }
    };
    
    // Try to initialize immediately
    if (!initializeTranslation()) {
      // If not ready, poll for availability
      console.log('Google Translate not ready yet, will poll');
      const maxAttempts = 20;
      let attempts = 0;
      
      const intervalId = setInterval(() => {
        attempts++;
        if (initializeTranslation() || attempts >= maxAttempts) {
          clearInterval(intervalId);
          if (attempts >= maxAttempts && translationState !== 'ready') {
            console.error('Google Translate failed to load after maximum attempts');
            setTranslationState('error');
            toast.error('Translation service unavailable. Please refresh the page.');
          }
        }
      }, 500);
      
      return () => clearInterval(intervalId);
    }
  }, []);

  const handleLanguageChange = (languageCode: string) => {
    console.log('Language change requested to:', languageCode);
    
    if (translationState !== 'ready') {
      toast.error('Language selector not ready. Please try again in a moment.');
      return;
    }
    
    try {
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (select) {
        // Set the selected language in the Google Translate dropdown
        select.value = languageCode;
        select.dispatchEvent(new Event('change'));
        
        // Update our state to reflect the new language
        setSelectedLanguage(languageCode);
        
        // Provide feedback to the user
        const selectedLang = languages.find(lang => lang.code === languageCode);
        toast.success(`Language changed to ${selectedLang?.label || languageCode}`);
        
        console.log('Language successfully changed to:', languageCode);
      } else {
        console.error('Google Translate widget not found when trying to change language');
        toast.error('Translation service unavailable. Please refresh the page.');
        setTranslationState('error');
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
      <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto z-50">
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
