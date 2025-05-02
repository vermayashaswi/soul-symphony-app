import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export interface LanguageSelectorProps {
  variant?: 'default' | 'onboarding';
  onLanguageChange?: (code: string) => void;
  initialLanguage?: string;
  showLabel?: boolean;
  className?: string;
}

export function LanguageSelector({ 
  variant = 'default',
  onLanguageChange,
  initialLanguage,
  showLabel = true,
  className
}: LanguageSelectorProps) {
  const { currentLanguage, setLanguage, isTranslating } = useTranslation();
  
  // Use locally defined languages to avoid circular imports
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

  const effectiveLanguage = initialLanguage || currentLanguage;
  const currentLanguageLabel = languages.find(lang => lang.code === effectiveLanguage)?.label || 'Language';
  
  const handleLanguageChange = (code: string) => {
    console.log(`LanguageSelector: Language selected: ${code}`);
    
    // If external handler provided (for onboarding), call it
    if (onLanguageChange) {
      onLanguageChange(code);
    } else {
      // Otherwise use the context method
      setLanguage(code);
    }
  };

  // For onboarding variant, use a more integrated look
  if (variant === 'onboarding') {
    return (
      <div className={className}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between bg-background/80 border-theme/20 focus:border-theme"
              disabled={isTranslating}
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>{currentLanguageLabel}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-full min-w-[200px] max-h-[200px] overflow-y-auto bg-background border border-border">
            {languages.map((language) => (
              <DropdownMenuItem
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`cursor-pointer ${
                  effectiveLanguage === language.code ? "bg-primary/10 text-primary font-medium" : ""
                }`}
                disabled={isTranslating}
              >
                {language.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Default variant (navbar style)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-2"
          disabled={isTranslating}
        >
          <Globe className={`h-4 w-4 ${isTranslating ? "animate-pulse" : ""}`} />
          {showLabel && <span>{currentLanguageLabel}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border border-border">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer ${
              effectiveLanguage === language.code ? "bg-secondary" : ""
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

export default LanguageSelector;
