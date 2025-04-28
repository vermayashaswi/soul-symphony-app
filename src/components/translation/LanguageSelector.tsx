
import React from 'react';
import { useTranslation, languages } from '@/contexts/TranslationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

export function LanguageSelector() {
  const { currentLanguage, setLanguage, isTranslating } = useTranslation();

  const currentLanguageLabel = languages.find(lang => lang.code === currentLanguage)?.label || 'Language';
  
  const handleLanguageChange = (code: string) => {
    console.log(`LanguageSelector: Language selected: ${code}`);
    setLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-2"
          disabled={isTranslating}
          title="Change language"
        >
          <Globe className={`h-4 w-4 ${isTranslating ? "animate-pulse" : ""}`} />
          <span>{currentLanguageLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border border-border">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          <TranslatableText text="Select Language" />
        </div>
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer ${
              currentLanguage === language.code ? "bg-secondary" : ""
            }`}
            disabled={isTranslating}
          >
            {language.label}
          </DropdownMenuItem>
        ))}
        {isTranslating && (
          <div className="px-2 py-1.5 text-xs italic text-muted-foreground">
            <TranslatableText text="Changing language..." />
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
