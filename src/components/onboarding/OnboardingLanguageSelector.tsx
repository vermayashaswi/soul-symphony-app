
import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LANGUAGES = [
  { code: 'en', label: 'English', region: 'European' },
  { code: 'es', label: 'Español', region: 'European' },
  { code: 'fr', label: 'Français', region: 'European' },
  { code: 'de', label: 'Deutsch', region: 'European' },
  { code: 'hi', label: 'हिन्दी', region: 'Indian' },
  { code: 'zh', label: '中文', region: 'Asian' },
  { code: 'ja', label: '日本語', region: 'Asian' },
  { code: 'ru', label: 'Русский', region: 'European' },
  { code: 'ar', label: 'العربية', region: 'Middle Eastern' },
  { code: 'pt', label: 'Português', region: 'European' },
  { code: 'bn', label: 'বাংলা', region: 'Indian' },
  { code: 'ta', label: 'தமிழ்', region: 'Indian' },
  { code: 'te', label: 'తెలుగు', region: 'Indian' },
  { code: 'mr', label: 'मराठी', region: 'Indian' },
  { code: 'gu', label: 'ગુજરાતી', region: 'Indian' },
  { code: 'kn', label: 'ಕನ್ನಡ', region: 'Indian' },
  { code: 'ml', label: 'മലയാളം', region: 'Indian' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', region: 'Indian' },
  { code: 'it', label: 'Italiano', region: 'European' },
  { code: 'ko', label: '한국어', region: 'Asian' },
  { code: 'tr', label: 'Türkçe', region: 'European' },
  { code: 'nl', label: 'Nederlands', region: 'European' },
  { code: 'pl', label: 'Polski', region: 'European' },
  { code: 'sv', label: 'Svenska', region: 'European' },
  { code: 'th', label: 'ไทย', region: 'Asian' },
  { code: 'vi', label: 'Tiếng Việt', region: 'Asian' },
  { code: 'id', label: 'Bahasa Indonesia', region: 'Asian' },
];

export const OnboardingLanguageSelector: React.FC = () => {
  const { currentLanguage, setLanguage } = useTranslation();

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    
    // Store recently used language
    try {
      const recentLangs = localStorage.getItem('recentLanguages') || '[]';
      const parsed = JSON.parse(recentLangs);
      const updated = [
        value,
        ...parsed.filter((code: string) => code !== value)
      ].slice(0, 3);
      localStorage.setItem('recentLanguages', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to store recent language:', err);
    }
  };

  // Group languages by region
  const languagesByRegion = () => {
    const regions: { [key: string]: typeof LANGUAGES } = {};
    
    LANGUAGES.forEach(lang => {
      if (!regions[lang.region]) {
        regions[lang.region] = [];
      }
      regions[lang.region].push(lang);
    });
    
    return regions;
  };

  const grouped = languagesByRegion();
  const regions = Object.keys(grouped);

  // Find the current language label
  const currentLanguageLabel = LANGUAGES.find(lang => lang.code === currentLanguage)?.label || 'Select a language';

  return (
    <div className="w-full">
      <Select value={currentLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-full bg-background/80 border-theme/20 text-foreground">
          <SelectValue placeholder="Select a language">
            {currentLanguageLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px] bg-background/90 border-theme/30">
          {regions.map(region => (
            <React.Fragment key={region}>
              <SelectItem value={`group_${region}`} disabled className="font-semibold text-muted-foreground">
                {region}
              </SelectItem>
              {grouped[region].map(language => (
                <SelectItem 
                  key={language.code} 
                  value={language.code} 
                  className="pl-6 hover:bg-theme/20 data-[state=checked]:bg-theme/40 data-[state=checked]:text-white"
                >
                  {language.label}
                </SelectItem>
              ))}
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
