
import React from 'react';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslation } from '@/contexts/TranslationContext';
import { createDebugger } from '@/utils/debug/debugUtils';

const debug = createDebugger('languageSelector');

// Local definition of languages instead of importing from context
const languages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt', label: 'Português' },
];

const LanguageSelector = () => {
  let translationContext;
  
  try {
    translationContext = useTranslation();
  } catch (error) {
    console.error("LanguageSelector: Failed to access translation context", error);
    // Return null or a fallback UI when the translation context isn't available
    return null;
  }
  
  const { currentLanguage, setLanguage, isTranslating } = translationContext;

  const handleLanguageChange = async (languageCode: string) => {
    debug.info('Language change requested:', languageCode);
    await setLanguage(languageCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Select language"
          title="Select language"
          disabled={isTranslating}
        >
          <Globe className={`h-5 w-5 ${isTranslating ? 'animate-pulse' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto bg-background border border-border">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer ${
              currentLanguage === language.code 
                ? "bg-primary/10 text-primary font-medium"
                : ""
            }`}
            disabled={isTranslating}
          >
            {language.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
