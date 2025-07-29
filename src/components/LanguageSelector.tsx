
import React, { useState, useCallback } from 'react';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { createDebugger } from '@/utils/debug/debugUtils';

const debug = createDebugger('languageSelector');

// Language groups for better organization
const LANGUAGE_GROUPS = {
  popular: ['en', 'es', 'fr', 'de', 'zh', 'hi', 'ar', 'ru', 'pt', 'ja'],
  indian: ['hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'as', 'or', 'ur', 'sd', 'ks', 'kok', 'mai'],
  european: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'uk', 'el', 'ro', 'hu', 'cs', 'ru'],
  asian: ['zh', 'ja', 'ko', 'th', 'vi', 'id', 'hi', 'bn', 'ta', 'te']
};

const languages = [
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
  { code: 'as', label: 'অসমীয়া', region: 'Indian' },
  { code: 'or', label: 'ଓଡ଼ିଆ', region: 'Indian' },
  { code: 'ur', label: 'اردو', region: 'Indian' },
  { code: 'sd', label: 'سنڌي', region: 'Indian' },
  { code: 'ks', label: 'कॉशुर', region: 'Indian' },
  { code: 'kok', label: 'कोंकणी', region: 'Indian' },
  { code: 'mai', label: 'मैथिली', region: 'Indian' },
  { code: 'it', label: 'Italiano', region: 'European' },
  { code: 'ko', label: '한국어', region: 'Asian' },
  { code: 'tr', label: 'Türkçe', region: 'European' },
  { code: 'nl', label: 'Nederlands', region: 'European' },
  { code: 'pl', label: 'Polski', region: 'European' },
  { code: 'sv', label: 'Svenska', region: 'European' },
  { code: 'th', label: 'ไทย', region: 'Asian' },
  { code: 'vi', label: 'Tiếng Việt', region: 'Asian' },
  { code: 'id', label: 'Bahasa Indonesia', region: 'Asian' },
  { code: 'uk', label: 'Українська', region: 'European' },
  { code: 'el', label: 'Ελληνικά', region: 'European' },
  { code: 'ro', label: 'Română', region: 'European' },
  { code: 'hu', label: 'Magyar', region: 'European' },
  { code: 'cs', label: 'Čeština', region: 'European' },
  { code: 'he', label: 'עברית', region: 'Middle Eastern' },
];

const LanguageSelector = () => {
  const { currentLanguage, setLanguage, isTranslating } = useTranslation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = async (languageCode: string) => {
    console.log('🌍 LanguageSelector: LANGUAGE CHANGE REQUESTED:', { 
      from: currentLanguage, 
      to: languageCode,
      timestamp: Date.now()
    });
    
    // First change the language which will clear caches and set loading states
    try {
      await setLanguage(languageCode);
      console.log('🌍 LanguageSelector: ✅ Language change completed:', languageCode);
    } catch (error) {
      console.error('🌍 LanguageSelector: ❌ Language change failed:', error);
      return;
    }
    
    
    setIsOpen(false);
    
    // Store recently used language
    try {
      const recentLangs = localStorage.getItem('recentLanguages') || '[]';
      const parsed = JSON.parse(recentLangs);
      const updated = [
        languageCode,
        ...parsed.filter((code: string) => code !== languageCode)
      ].slice(0, 3);
      localStorage.setItem('recentLanguages', JSON.stringify(updated));
      console.log('🌍 LanguageSelector: 💾 Stored recent language:', languageCode);
    } catch (err) {
      console.error('🌍 LanguageSelector: ❌ Failed to store recent language:', err);
    }
  };

  // Get recent languages
  const getRecentLanguages = () => {
    try {
      const recentLangs = localStorage.getItem('recentLanguages');
      return recentLangs ? JSON.parse(recentLangs) : [];
    } catch {
      return [];
    }
  };

  const recentLanguages = getRecentLanguages().slice(0, 3)
    .map(code => languages.find(lang => lang.code === code))
    .filter(Boolean);

  const groupedLanguages = () => {
    const groups = {};
    
    languages.forEach(lang => {
      if (!groups[lang.region]) {
        groups[lang.region] = [];
      }
      groups[lang.region].push(lang);
    });
    
    return groups;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Select language"
          title="Select language"
          disabled={isTranslating}
        >
          <Globe className={`h-5 w-5 ${isTranslating ? 'animate-pulse' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="max-h-[400px] overflow-y-auto bg-background border border-border w-64"
      >
        {/* Recently used languages */}
        {recentLanguages.length > 0 && (
          <>
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {recentLanguages.map((language) => (
              <DropdownMenuItem
                key={`recent-${language.code}`}
                onClick={() => handleLanguageChange(language.code)}
                className={`cursor-pointer ${
                  currentLanguage === language.code ? "bg-primary/10 text-primary font-medium" : ""
                }`}
                disabled={isTranslating}
              >
                {language.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Group languages by region */}
        {Object.entries(groupedLanguages()).map(([region, langs]) => (
          <DropdownMenuGroup key={region}>
            <DropdownMenuLabel>{region}</DropdownMenuLabel>
            {(langs as any[]).map((language) => (
              <DropdownMenuItem
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`cursor-pointer ${
                  currentLanguage === language.code ? "bg-primary/10 text-primary font-medium" : ""
                }`}
                disabled={isTranslating}
              >
                {language.label}
              </DropdownMenuItem>
            ))}
            {region !== Object.keys(groupedLanguages()).slice(-1)[0] && <DropdownMenuSeparator />}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
