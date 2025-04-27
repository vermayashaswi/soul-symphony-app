
import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { createDebugger } from '@/utils/debug/debugUtils';

const debug = createDebugger('languageSelector');

export const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'es', label: 'Español' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ur', label: 'اردو' },
  { code: 'id', label: 'Indonesia' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'mr', label: 'मराठी' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ko', label: '한국어' },
];

const LanguageSelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const handleLanguageChange = (languageCode: string) => {
    debug.info('Language change requested:', languageCode);
    setSelectedLanguage(languageCode);
    
    // Dispatch a custom event for components to listen to
    window.dispatchEvent(new CustomEvent('languageChange', { 
      detail: { language: languageCode } 
    }));
    
    const selectedLang = languages.find(lang => lang.code === languageCode);
    toast.success(`Language changed to ${selectedLang?.label || languageCode}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Select language"
          title="Select language"
        >
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer ${
              selectedLanguage === language.code 
                ? "bg-primary/10 text-primary font-medium"
                : ""
            }`}
          >
            {language.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
