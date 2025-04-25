
import React, { useEffect } from 'react';
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
  const [open, setOpen] = React.useState(false);

  // Add debug event for component mounting
  React.useEffect(() => {
    console.log("LanguageSelector mounted with current language:", i18n.language);
    
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
    setOpen(false); // Close dropdown after selection
  };

  const handleGlobeClick = (event: React.MouseEvent) => {
    // Log detailed debug event when globe is clicked
    console.log("Globe button clicked:", event);
    
    if (window.debugEvents) {
      window.debugEvents.log('globeClick', 'LanguageSelectorButton', {
        elementType: 'Button',
        currentLanguage: i18n.language,
        eventTarget: event.target.toString(),
        eventCurrentTarget: event.currentTarget.toString(),
        timestamp: Date.now()
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    // Log debug event when dropdown state changes
    console.log("Dropdown state changing to:", open);
    
    if (window.debugEvents) {
      window.debugEvents.log('dropdownStateChange', 'LanguageSelector', {
        isOpen: open,
        currentLanguage: i18n.language,
        timestamp: Date.now()
      });
    }
    setOpen(open);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger 
        onClick={handleGlobeClick} 
        aria-label="Change language"
        className="cursor-pointer focus:outline-none"
      >
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 focus:outline-none cursor-pointer"
          data-testid="language-selector-button"
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
              onClick={(e) => {
                e.preventDefault();
                // Log debug event
                if (window.debugEvents) {
                  window.debugEvents.log('menuItemClick', 'LanguageMenuItem', {
                    code,
                    name,
                    isActive,
                    timestamp: Date.now()
                  });
                }
                handleLanguageChange(code);
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
