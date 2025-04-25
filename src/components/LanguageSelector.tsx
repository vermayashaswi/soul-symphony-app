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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    console.log("LanguageSelector mounted with current language:", i18n.language);
    
    if (window.debugEvents) {
      window.debugEvents.log('mount', 'LanguageSelector', {
        currentLanguage: i18n.language
      });
    }
  }, [i18n.language]);

  const handleLanguageChange = (newLang: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (window.debugEvents) {
      window.debugEvents.log('languageChange', 'LanguageSelector', {
        previousLang: i18n.language,
        newLang,
        defaultPrevented: event?.defaultPrevented || true,
        propagationStopped: true
      });
    }

    i18n.changeLanguage(newLang);
    toast.success(`Language changed to ${languages[newLang as keyof typeof languages]}`);
    setOpen(false);
    setDialogOpen(false);
  };

  const handleGlobeClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (window.debugEvents) {
      window.debugEvents.log('globeClick', 'LanguageSelectorButton', {
        elementType: 'Button',
        currentLanguage: i18n.language,
        defaultPrevented: event.defaultPrevented,
        propagationStopped: true,
        timestamp: Date.now()
      });
    }
    
    setOpen(!open);
  };

  const handleOpenChange = (open: boolean) => {
    if (window.debugEvents) {
      window.debugEvents.log('dropdownStateChange', 'LanguageSelector', {
        isOpen: open,
        currentLanguage: i18n.language,
        timestamp: Date.now()
      });
    }
    setOpen(open);
  };

  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobileView) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            type="button"
            variant="ghost" 
            size="icon"
            className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 focus:outline-none"
            data-testid="language-selector-button-mobile"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (window.debugEvents) {
                window.debugEvents.log('mobileGlobeClick', 'MobileLanguageSelector', {
                  timestamp: Date.now(),
                  defaultPrevented: e.defaultPrevented,
                  propagationStopped: true
                });
              }
              setDialogOpen(true);
            }}
          >
            <Globe className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Language</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {Object.entries(languages).map(([code, name]) => {
              const isActive = i18n.language === code;
              return (
                <Button
                  key={code}
                  variant={isActive ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLanguageChange(code, e);
                  }}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger 
        aria-label="Change language"
        className="cursor-pointer focus:outline-none"
        id="language-selector-trigger"
      >
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 focus:outline-none cursor-pointer"
          data-testid="language-selector-button"
          onClick={handleGlobeClick}
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
                e.stopPropagation();
                if (window.debugEvents) {
                  window.debugEvents.log('menuItemClick', 'LanguageMenuItem', {
                    code,
                    name,
                    isActive,
                    timestamp: Date.now(),
                    defaultPrevented: e.defaultPrevented
                  });
                }
                handleLanguageChange(code, e);
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
