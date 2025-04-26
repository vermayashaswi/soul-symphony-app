
import React from 'react';
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
  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' }
  ];

  const handleLanguageChange = (languageCode: string) => {
    try {
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (select) {
        select.value = languageCode;
        select.dispatchEvent(new Event('change'));
        toast.success(`Language changed to ${languages.find(lang => lang.code === languageCode)?.label || languageCode}`);
      } else {
        console.error('Google Translate widget not found');
        toast.error('Language selector not ready. Please try again in a moment.');
      }
    } catch (err) {
      console.error('Error changing language:', err);
      toast.error('Error changing language');
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
          >
            {language.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
