
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Language options
const languageOptions = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'it', name: 'Italiano' },
  { code: 'ko', name: '한국어' },
  // Indian languages
  { code: 'bn', name: 'বাংলা' },        // Bengali
  { code: 'ta', name: 'தமிழ்' },        // Tamil
  { code: 'te', name: 'తెలుగు' },       // Telugu
  { code: 'mr', name: 'मराठी' },        // Marathi
  { code: 'gu', name: 'ગુજરાતી' },      // Gujarati
  { code: 'kn', name: 'ಕನ್ನಡ' },        // Kannada
  { code: 'ml', name: 'മലയാളം' },      // Malayalam
  { code: 'pa', name: 'ਪੰਜਾਬੀ' },       // Punjabi
  { code: 'or', name: 'ଓଡ଼ିଆ' }         // Odia
];

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  
  const currentLanguage = languageOptions.find(lang => lang.code === i18n.language) || languageOptions[0];
  
  const changeLanguage = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setOpen(false);
  };
  
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-1">
          <Globe className="h-4 w-4" />
          <span className="hidden md:inline">{currentLanguage.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background max-h-80 overflow-y-auto">
        {languageOptions.map((language) => (
          <DropdownMenuItem 
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={i18n.language === language.code ? 'bg-muted' : ''}
          >
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
