
import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// List of supported languages
const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

interface LanguageSelectorProps {
  variant?: 'default' | 'minimal';
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  variant = 'default',
  className = ''
}) => {
  // Get browser language or stored preference
  const getBrowserLanguage = () => {
    const storedLanguage = localStorage.getItem('preferredLanguage');
    if (storedLanguage) {
      return storedLanguage;
    }
    
    const browserLang = navigator.language.split('-')[0];
    return languages.some(lang => lang.code === browserLang) ? browserLang : 'en';
  };

  const [currentLanguage, setCurrentLanguage] = useState(getBrowserLanguage());

  // Find the current language object
  const selectedLanguage = languages.find(lang => lang.code === currentLanguage) || languages[0];

  const handleLanguageChange = (langCode: string) => {
    setCurrentLanguage(langCode);
    localStorage.setItem('preferredLanguage', langCode);
    
    // In a real implementation, this would trigger translation of the entire app
    document.documentElement.lang = langCode;
    
    // This is where you would dispatch an event or call a function to update translations
    window.dispatchEvent(new CustomEvent('language-changed', { detail: { language: langCode } }));
  };

  // Set initial language on mount
  useEffect(() => {
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  // Minimal variant just shows the language code/flag
  if (variant === 'minimal') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={className}>
            <span>{selectedLanguage.flag}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {languages.map((language) => (
            <DropdownMenuItem
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span>{language.flag}</span>
              <span>{language.name}</span>
              {language.code === currentLanguage && (
                <Check className="h-4 w-4 ml-auto" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default variant with more details
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`flex items-center gap-2 ${className}`}>
          <Globe className="h-4 w-4" />
          <span>
            {selectedLanguage.flag} {selectedLanguage.name}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span>{language.flag}</span>
            <span>{language.name}</span>
            {language.code === currentLanguage && (
              <Check className="h-4 w-4 ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
