
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
import { toast } from 'sonner';

const LanguageSelector = () => {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' }
  ];

  // Debug effect to check if translations are loaded
  React.useEffect(() => {
    console.log(`Current language: ${i18n.language}`);
    console.log(`Loaded namespaces: ${i18n.reportNamespaces.getUsedNamespaces()}`);
    console.log(`Available languages: ${i18n.languages.join(', ')}`);
  }, [i18n.language]);

  const handleLanguageChange = async (languageCode: string) => {
    console.log(`Changing UI language to: ${languageCode}`);
    
    try {
      await i18n.changeLanguage(languageCode);
      console.log(`UI language changed to ${languageCode}`);
      toast.success(`Language changed to ${languages.find(lang => lang.code === languageCode)?.label || languageCode}`);
    } catch (err) {
      console.error('Error changing UI language:', err);
      toast.error('Error changing UI language');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Select language">
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={i18n.language === language.code ? "bg-accent" : ""}
          >
            {language.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
