import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const languages = {
  en: 'English',
  hi: 'हिंदी',
  zh: '中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  pt: 'Português',
  ar: 'العربية',
  it: 'Italiano',
  ko: '한국어'
};

const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (newLang: string) => {
    i18n.changeLanguage(newLang);
    toast.success(`Language changed to ${languages[newLang as keyof typeof languages]}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button 
          variant="ghost" 
          size="icon"
          className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 focus:outline-none cursor-pointer"
          aria-label="Change language"
        >
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end"
        sideOffset={4}
        className="bg-popover/95 backdrop-blur-sm border-muted z-50 min-w-[150px]"
      >
        {Object.entries(languages).map(([code, name]) => (
          <DropdownMenuItem 
            key={code} 
            onClick={() => handleLanguageChange(code)}
            className={`cursor-pointer hover:bg-accent focus:bg-accent ${i18n.language === code ? "bg-accent/70" : ""}`}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
