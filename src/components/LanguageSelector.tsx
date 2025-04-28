
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

// We'll reuse the languages from the context
import { languages } from '@/contexts/TranslationContext';

const LanguageSelector = () => {
  const { currentLanguage, setLanguage, isTranslating } = useTranslation();

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
