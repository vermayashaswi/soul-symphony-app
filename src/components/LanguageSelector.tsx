
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { toast } from 'sonner';

// Language options
const languageOptions = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'it', name: 'Italiano' },
  { code: 'ko', name: '한국어' },
  // Indian languages
  { code: 'bn', name: 'বাংলা' },        // Bengali
  { code: 'ta', name: 'தமிழ்' },        // Tamil
  { code: 'te', name: 'తెలుగు' },       // Telugu
  { code: 'mr', name: 'मराठी' },        // Marathi
  { code: 'gu', name: 'ગુજરાતી' },      // Gujarati
  { code: 'kn', name: 'ಕನ್ನಡ' },        // Kannada
  { code: 'ml', name: 'മലയാളം' },      // Malayalam
  { code: 'pa', name: 'ਪੰਜਾਬੀ' },       // Punjabi
  { code: 'or', name: 'ଓଡ଼ିଆ' }         // Odia
];

const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('');
  const { addEvent } = useDebugLog();

  // Initialize language state from i18n
  useEffect(() => {
    // Log component mount
    addEvent('i18n', 'LanguageSelector mounted', 'info', {
      initialLanguage: i18n.language,
      localStorage: localStorage.getItem('i18nextLng')
    });
    
    // Set the initial language state from i18n
    setCurrentLang(i18n.language);
    
    // Ensure document language matches i18n language
    document.documentElement.lang = i18n.language;
    
    // Return cleanup function
    return () => {
      addEvent('i18n', 'LanguageSelector unmounted', 'info');
    };
  }, [i18n, addEvent]);

  const currentLanguage = languageOptions.find(lang => lang.code === currentLang) || languageOptions[0];

  const changeLanguage = (code: string) => {
    if (code === currentLang) {
      setOpen(false);
      return; // Don't reload if the language is the same
    }
    
    addEvent('i18n', 'Language change requested', 'info', {
      from: currentLang,
      to: code,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Update document lang attribute immediately
      document.documentElement.lang = code;
      
      // Update language in i18next
      i18n.changeLanguage(code);
      
      // Update component state
      setCurrentLang(code);
      setOpen(false);
      
      // Save language preference
      localStorage.setItem('i18nextLng', code);
      
      addEvent('i18n', 'Language changed successfully', 'success', {
        newLang: code,
        localStorage: localStorage.getItem('i18nextLng'),
        documentLang: document.documentElement.lang
      });
      
      // Show a toast notification
      toast.success(`Language changed to ${languageOptions.find(lang => lang.code === code)?.name || code}`);
      
      // Force reload only if absolutely necessary (usually not needed)
      // window.location.reload();
    } catch (error) {
      console.error('Error changing language:', error);
      addEvent('i18n', 'Error changing language', 'error', { error, code });
      toast.error('Failed to change language');
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Select language">
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languageOptions.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={currentLang === language.code ? 'bg-muted font-medium' : ''}
          >
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
