
import React from 'react';
import { Globe } from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useLanguage, SUPPORTED_LANGUAGES, LanguageCode } from '@/contexts/LanguageContext';

interface LanguageSelectorProps {
  variant?: 'default' | 'minimal';
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'default' }) => {
  const { language, setLanguage } = useLanguage();

  if (variant === 'minimal') {
    return (
      <div className="relative">
        <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
          <SelectTrigger className="w-[65px] h-9 px-2 bg-background/95 backdrop-blur-sm">
            <SelectValue>
              <div className="flex items-center">
                <Globe className="h-4 w-4 mr-1" />
                <span className="uppercase text-xs">{language}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, { name }]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="relative">
      <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
        <SelectTrigger className="w-[140px] bg-background/95 backdrop-blur-sm">
          <SelectValue>
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2" />
              {SUPPORTED_LANGUAGES[language as LanguageCode].name}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, { name }]) => (
              <SelectItem key={code} value={code}>
                {name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
