
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';

// Common country codes with flags and names
const COUNTRIES = [
  { code: '1', name: 'United States', flag: '🇺🇸', format: '+1 (XXX) XXX-XXXX' },
  { code: '1', name: 'Canada', flag: '🇨🇦', format: '+1 (XXX) XXX-XXXX' },
  { code: '44', name: 'United Kingdom', flag: '🇬🇧', format: '+44 XXXX XXXXXX' },
  { code: '33', name: 'France', flag: '🇫🇷', format: '+33 X XX XX XX XX' },
  { code: '49', name: 'Germany', flag: '🇩🇪', format: '+49 XXX XXXXXXX' },
  { code: '39', name: 'Italy', flag: '🇮🇹', format: '+39 XXX XXX XXXX' },
  { code: '34', name: 'Spain', flag: '🇪🇸', format: '+34 XXX XXX XXX' },
  { code: '91', name: 'India', flag: '🇮🇳', format: '+91 XXXXX XXXXX' },
  { code: '86', name: 'China', flag: '🇨🇳', format: '+86 XXX XXXX XXXX' },
  { code: '81', name: 'Japan', flag: '🇯🇵', format: '+81 XX XXXX XXXX' },
  { code: '82', name: 'South Korea', flag: '🇰🇷', format: '+82 XX XXXX XXXX' },
  { code: '61', name: 'Australia', flag: '🇦🇺', format: '+61 XXX XXX XXX' },
  { code: '55', name: 'Brazil', flag: '🇧🇷', format: '+55 XX XXXXX XXXX' },
  { code: '52', name: 'Mexico', flag: '🇲🇽', format: '+52 XXX XXX XXXX' },
  { code: '7', name: 'Russia', flag: '🇷🇺', format: '+7 XXX XXX XX XX' },
  { code: '27', name: 'South Africa', flag: '🇿🇦', format: '+27 XX XXX XXXX' },
  { code: '20', name: 'Egypt', flag: '🇪🇬', format: '+20 XX XXXX XXXX' },
  { code: '234', name: 'Nigeria', flag: '🇳🇬', format: '+234 XXX XXX XXXX' },
  { code: '65', name: 'Singapore', flag: '🇸🇬', format: '+65 XXXX XXXX' },
  { code: '60', name: 'Malaysia', flag: '🇲🇾', format: '+60 XX XXX XXXX' },
];

interface CountryCodeSelectorProps {
  selectedCountry: string;
  onCountryChange: (countryCode: string, countryName: string) => void;
  className?: string;
}

export const CountryCodeSelector: React.FC<CountryCodeSelectorProps> = ({
  selectedCountry,
  onCountryChange,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const filteredCountries = useMemo(() => {
    if (!searchValue) return COUNTRIES;
    
    return COUNTRIES.filter(country =>
      country.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      country.code.includes(searchValue)
    );
  }, [searchValue]);

  const selectedCountryData = COUNTRIES.find(country => country.code === selectedCountry);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[200px] justify-between", className)}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedCountryData?.flag || '🌍'}</span>
            <span className="font-mono text-sm">+{selectedCountry}</span>
            <span className="text-xs text-muted-foreground truncate">
              {selectedCountryData?.name || 'Select Country'}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search countries..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <CommandEmpty>
            <TranslatableText text="No country found." />
          </CommandEmpty>
          <CommandGroup className="max-h-[200px] overflow-auto">
            {filteredCountries.map((country) => (
              <CommandItem
                key={`${country.code}-${country.name}`}
                value={`${country.name} ${country.code}`}
                onSelect={() => {
                  onCountryChange(country.code, country.name);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{country.flag}</span>
                    <div className="flex flex-col">
                      <span className="font-medium">{country.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {country.format}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">+{country.code}</span>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedCountry === country.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
