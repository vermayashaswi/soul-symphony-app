
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

const LanguageSelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isTranslateReady, setIsTranslateReady] = useState(false);

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

  // Check if Google Translate is initialized and force English as initial language
  useEffect(() => {
    // Force set to English on initial load to override any cached language
    const initialLanguage = 'en';
    
    const initializeTranslation = () => {
      try {
        const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
        if (select) {
          console.log('Google Translate found, initializing...');
          
          // First, force English (regardless of the browser/localStorage language)
          select.value = initialLanguage;
          select.dispatchEvent(new Event('change'));
          setSelectedLanguage(initialLanguage);
          
          // Mark as ready so UI can enable clicks
          setIsTranslateReady(true);
          console.log('Google Translate initialized with language:', initialLanguage);
          
          // Clear any previous translations that might be applied
          if (document.body.classList.contains('translated-rtl')) {
            document.body.classList.remove('translated-rtl');
          }
          
          // Clear Google Translate cookie to ensure fresh start
          document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error initializing Google Translate:', err);
        return false;
      }
    };
    
    // Try to initialize immediately
    if (!initializeTranslation()) {
      console.log('Google Translate not ready yet, will retry');
      
      // If not successful, check every second until it's available (max 10 attempts)
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkInterval = setInterval(() => {
        attempts++;
        if (initializeTranslation() || attempts >= maxAttempts) {
          clearInterval(checkInterval);
          if (attempts >= maxAttempts && !isTranslateReady) {
            console.warn('Failed to initialize Google Translate after maximum attempts');
            toast.error('Translation service unavailable. Please refresh the page.');
          }
        }
      }, 1000);
      
      return () => clearInterval(checkInterval);
    }
  }, []);

  const handleLanguageChange = (languageCode: string) => {
    console.log('Language change requested to:', languageCode);
    
    if (!isTranslateReady) {
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
          title={isTranslateReady ? "Select language" : "Language selector loading..."}
        >
          <Globe className={`h-5 w-5 ${!isTranslateReady ? 'opacity-50' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer ${
              selectedLanguage === language.code 
                ? "bg-primary/10 text-primary font-medium"
                : ""
            } ${!isTranslateReady ? "opacity-50" : ""}`}
            disabled={!isTranslateReady}
          >
            {language.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
