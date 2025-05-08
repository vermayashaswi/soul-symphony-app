
import React, { useState, useCallback } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Language groups for better organization
const LANGUAGE_GROUPS = {
  popular: ['en', 'es', 'fr', 'de', 'zh', 'hi', 'ar', 'ru', 'pt', 'ja'],
  indian: ['hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'as', 'or', 'ur', 'sd', 'ks', 'kok', 'mai'],
  european: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'uk', 'el', 'ro', 'hu', 'cs', 'ru'],
  asian: ['zh', 'ja', 'ko', 'th', 'vi', 'id', 'hi', 'bn', 'ta', 'te']
};

export function LanguageSelector() {
  const { currentLanguage, setLanguage, isTranslating } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Use locally defined languages to avoid circular imports
  const languages = [
    // Currently implemented languages
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

    // Additional Indian regional languages
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

    // Other major global languages
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

  const currentLanguageLabel = languages.find(lang => lang.code === currentLanguage)?.label || 'Language';
  
  const handleLanguageChange = (code: string) => {
    console.log(`LanguageSelector: Language selected: ${code}`);
    setLanguage(code);
    setIsOpen(false);

    // Store recently used language
    try {
      const recentLangs = localStorage.getItem('recentLanguages');
      const parsed = recentLangs ? JSON.parse(recentLangs) : [];
      const updated = [code, ...parsed.filter(c => c !== code)].slice(0, 3);
      localStorage.setItem('recentLanguages', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to store recent language:', err);
    }
  };

  // Filter languages based on search query
  const filteredLanguages = useCallback(() => {
    if (!searchQuery) return languages;
    
    return languages.filter(lang => 
      lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.region.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, languages]);

  // Get the recently used languages from localStorage (if any)
  const getRecentLanguages = () => {
    try {
      const recentLangs = localStorage.getItem('recentLanguages');
      return recentLangs ? JSON.parse(recentLangs) : [];
    } catch {
      return [];
    }
  };

  // Recently used languages (limit to 3)
  const recentLanguages = getRecentLanguages().slice(0, 3)
    .map(code => languages.find(lang => lang.code === code))
    .filter(Boolean);

  // Group languages by region for organized display
  const groupedLanguages = () => {
    const groups = {};
    const filtered = filteredLanguages();
    
    filtered.forEach(lang => {
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
          size="sm" 
          className="flex items-center gap-2"
          disabled={isTranslating}
        >
          <Globe className={`h-4 w-4 ${isTranslating ? "animate-pulse" : ""}`} />
          <span className="text-foreground">{currentLanguageLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-background border border-border w-64 max-h-[400px] overflow-y-auto"
      >
        {/* Search input */}
        <div className="p-2 sticky top-0 bg-background z-10 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Find language..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
              autoComplete="off"
            />
            {searchQuery && (
              <X 
                className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => setSearchQuery('')}
              />
            )}
          </div>
        </div>
        
        {/* Recently used languages */}
        {recentLanguages.length > 0 && !searchQuery && (
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
        {searchQuery ? (
          // When searching, show flat list
          filteredLanguages().map((language) => (
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
          ))
        ) : (
          // When not searching, show grouped languages
          Object.entries(groupedLanguages()).map(([region, langs]) => (
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
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
