
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

  // Check if Google Translate is initialized
  useEffect(() => {
    const checkGoogleTranslate = () => {
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (select) {
        setIsTranslateReady(true);
        console.log('Google Translate widget found and ready');
      } else {
        console.log('Google Translate widget not ready yet, will retry');
        setTimeout(checkGoogleTranslate, 1000);
      }
    };
    
    // Start checking for Google Translate after a short delay to allow page to load
    const timer = setTimeout(checkGoogleTranslate, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  const handleLanguageChange = (languageCode: string) => {
    try {
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (select) {
        select.value = languageCode;
        select.dispatchEvent(new Event('change'));
        setSelectedLanguage(languageCode);
        toast.success(`Language changed to ${languages.find(lang => lang.code === languageCode)?.label || languageCode}`);
      } else {
        console.error('Google Translate widget not found');
        toast.error('Language selector not ready. Please try again in a moment.');
        
        // Retry initializing Google Translate
        if (window.googleTranslateElementInit) {
          window.googleTranslateElementInit();
          setTimeout(() => {
            const retrySelect = document.querySelector('.goog-te-combo') as HTMLSelectElement;
            if (retrySelect) {
              retrySelect.value = languageCode;
              retrySelect.dispatchEvent(new Event('change'));
              setSelectedLanguage(languageCode);
              toast.success(`Language changed to ${languages.find(lang => lang.code === languageCode)?.label || languageCode}`);
            }
          }, 1000);
        }
      }
    } catch (err) {
      console.error('Error changing language:', err);
      toast.error('Error changing language');
    }
  };

  // Get current language label
  const getCurrentLanguageLabel = () => {
    return languages.find(lang => lang.code === selectedLanguage)?.label || 'English';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Select language"
          disabled={!isTranslateReady}
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
            className={`${
              selectedLanguage === language.code 
                ? "bg-primary/10 text-primary font-medium"
                : ""
            }`}
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
