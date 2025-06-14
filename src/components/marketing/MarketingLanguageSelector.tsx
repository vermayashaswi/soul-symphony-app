
import React, { useState } from 'react';
import { useMarketingTranslation } from '@/contexts/MarketingTranslationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

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

export function MarketingLanguageSelector() {
  const { currentLanguage, setLanguage, isTranslating } = useMarketingTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguageLabel = languages.find(lang => lang.code === currentLanguage)?.label || 'Language';
  
  const handleLanguageChange = (code: string) => {
    console.log(`[MarketingLanguageSelector] Language selected: ${code}`);
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-2"
          disabled={isTranslating}
        >
          <Globe className={`h-4 w-4 ${isTranslating ? "animate-pulse" : ""}`} />
          <span className="text-foreground">{currentLanguageLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-background border border-border w-48"
      >
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer ${
              currentLanguage === language.code ? "bg-primary/10 text-primary font-medium" : ""
            }`}
            disabled={isTranslating}
          >
            {language.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MarketingLanguageSelector;
