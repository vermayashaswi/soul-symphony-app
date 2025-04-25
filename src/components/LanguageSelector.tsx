
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

// Add this type declaration to enable debugging globally
declare global {
  interface Window {
    debugEvents?: {
      log: (type: string, target: string, details?: any) => any;
      clear: () => void;
      events: () => any[];
    };
  }
}

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

  // Add debug event for component mounting
  React.useEffect(() => {
    if (window.debugEvents) {
      window.debugEvents.log('mount', 'LanguageSelector', {
        currentLanguage: i18n.language
      });
    }
  }, [i18n.language]);

  const handleLanguageChange = (newLang: string) => {
    // Log debug event
    if (window.debugEvents) {
      window.debugEvents.log('languageChange', 'LanguageSelector', {
        previousLang: i18n.language,
        newLang
      });
    }

    i18n.changeLanguage(newLang);
    toast.success(`Language changed to ${languages[newLang as keyof typeof languages]}`);
  };

  const handleButtonClick = () => {
    // Log debug event when button is clicked
    if (window.debugEvents) {
      window.debugEvents.log('buttonClick', 'LanguageSelectorButton', {
        elementType: 'Button',
        currentLanguage: i18n.language
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    // Log debug event when dropdown state changes
    if (window.debugEvents) {
      window.debugEvents.log('dropdownStateChange', 'LanguageSelector', {
        isOpen: open,
        currentLanguage: i18n.language
      });
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger onClick={handleButtonClick} aria-label="Change language">
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 focus:outline-none cursor-pointer"
        >
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end"
        sideOffset={4}
        className="bg-popover/95 backdrop-blur-sm border-muted z-50 min-w-[150px]"
      >
        {Object.entries(languages).map(([code, name]) => {
          const isActive = i18n.language === code;
          return (
            <DropdownMenuItem 
              key={code} 
              onClick={() => handleLanguageChange(code)}
              onSelect={(event) => {
                // This prevents the dropdown from closing automatically
                // so we can handle it manually after the language change
                event.preventDefault();
                
                // Log debug event
                if (window.debugEvents) {
                  window.debugEvents.log('itemSelect', 'LanguageMenuItem', {
                    code,
                    name,
                    isActive
                  });
                }
              }}
              className={`cursor-pointer hover:bg-accent focus:bg-accent ${isActive ? "bg-accent/70" : ""}`}
            >
              {name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
