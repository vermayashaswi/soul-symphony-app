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
import { languages, SupportedLanguage } from '@/utils/language-utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { useIsMobile } from '@/utils/use-is-mobile';

// Debug event logger interface for consistent event logging
interface DebugLogger {
  log: (type: string, target: string, details?: any) => any;
}

const LanguageSelectorRefactored: React.FC = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const isMobile = useIsMobile();

  // Get window.debugEvents if available
  const debugEvents = React.useMemo<DebugLogger | undefined>(
    () => typeof window !== 'undefined' ? window.debugEvents : undefined,
    []
  );

  React.useEffect(() => {
    debugEvents?.log('mount', 'LanguageSelectorRefactored', {
      currentLanguage: i18n.language,
      timestamp: Date.now()
    });
  }, [i18n.language, debugEvents]);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    const previousLang = i18n.language;
    
    debugEvents?.log('languageChange', 'LanguageSelectorRefactored', {
      previousLang,
      newLang,
      timestamp: Date.now()
    });

    i18n.changeLanguage(newLang);
    toast.success(`Language changed to ${languages[newLang]}`);
    setOpen(false);
    setDialogOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    debugEvents?.log('dropdownStateChange', 'LanguageSelectorRefactored', {
      isOpen: open,
      currentLanguage: i18n.language,
      timestamp: Date.now()
    });
    setOpen(open);
  };

  // For mobile devices, use a dialog instead of dropdown
  if (isMobile.isMobile) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="rounded-full bg-background hover:bg-accent focus:outline-none"
            aria-label="Change language"
          >
            <Globe className="h-5 w-5" />
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
                  onClick={() => handleLanguageChange(code as SupportedLanguage)}
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

  // Desktop dropdown implementation
  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost" 
          size="icon"
          aria-label="Change language"
          className="rounded-full bg-background hover:bg-accent focus:outline-none"
        >
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end"
        sideOffset={4}
        className="bg-popover border-muted"
      >
        {Object.entries(languages).map(([code, name]) => {
          const isActive = i18n.language === code;
          return (
            <DropdownMenuItem 
              key={code} 
              onClick={() => handleLanguageChange(code as SupportedLanguage)}
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

export default LanguageSelectorRefactored;
