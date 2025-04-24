
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const languageOptions = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  ja: '日本語',
  ru: 'Русский',
  pt: 'Português',
  ar: 'العربية',
  hi: 'हिन्दी',
  it: 'Italiano',
  ko: '한국어'
};

export function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    const langName = languageOptions[lang as keyof typeof languageOptions];
    toast.success(`Language changed to ${langName}`);
  };

  const currentLanguageName = languageOptions[i18n.language as keyof typeof languageOptions] || 'English';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 h-8 px-3 bg-background/80 backdrop-blur-sm">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLanguageName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border shadow-lg w-48">
        {Object.entries(languageOptions).map(([code, name]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => handleLanguageChange(code)}
            className={`cursor-pointer flex items-center justify-between px-3 py-2 ${i18n.language === code ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
          >
            {name}
            {i18n.language === code && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                ✓
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
