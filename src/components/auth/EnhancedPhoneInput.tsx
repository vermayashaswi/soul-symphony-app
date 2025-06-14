
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CountryCodeSelector } from './CountryCodeSelector';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { cn } from '@/lib/utils';

interface EnhancedPhoneInputProps {
  value: string;
  onChange: (value: string, countryCode: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export const EnhancedPhoneInput: React.FC<EnhancedPhoneInputProps> = ({
  value,
  onChange,
  onValidityChange,
  className = '',
  disabled = false,
  placeholder = ''
}) => {
  const [countryCode, setCountryCode] = useState('1'); // Default to US
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Auto-detect country based on user's locale
  useEffect(() => {
    try {
      const locale = navigator.language || 'en-US';
      const region = locale.split('-')[1];
      
      // Simple mapping for common regions
      const countryCodeMap: { [key: string]: string } = {
        'US': '1', 'CA': '1', 'GB': '44', 'FR': '33', 'DE': '49',
        'IT': '39', 'ES': '34', 'IN': '91', 'CN': '86', 'JP': '81',
        'KR': '82', 'AU': '61', 'BR': '55', 'MX': '52', 'RU': '7'
      };
      
      if (region && countryCodeMap[region]) {
        setCountryCode(countryCodeMap[region]);
      }
    } catch (error) {
      console.log('Could not detect country from locale');
    }
  }, []);

  // Parse existing value if provided
  useEffect(() => {
    if (value && value.startsWith('+')) {
      // Extract country code and phone number
      const match = value.match(/^\+(\d{1,4})(.*)$/);
      if (match) {
        setCountryCode(match[1]);
        setPhoneNumber(match[2]);
      }
    }
  }, [value]);

  const formatPhoneNumber = (input: string, countryCode: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');
    
    // Apply formatting based on country code
    if (countryCode === '1') {
      // US/Canada format: (XXX) XXX-XXXX
      if (digits.length >= 6) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
      } else if (digits.length >= 3) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      }
      return digits;
    } else if (countryCode === '44') {
      // UK format: XXXX XXXXXX
      if (digits.length >= 4) {
        return `${digits.slice(0, 4)} ${digits.slice(4)}`;
      }
      return digits;
    }
    
    // Default formatting: add spaces every 3-4 digits
    return digits.replace(/(\d{3,4})(?=\d)/g, '$1 ');
  };

  const validatePhoneNumber = (phone: string, country: string) => {
    const digits = phone.replace(/\D/g, '');
    
    // Basic validation based on country
    if (country === '1') {
      return digits.length === 10; // US/Canada
    } else if (country === '44') {
      return digits.length >= 10 && digits.length <= 11; // UK
    } else if (country === '33' || country === '49') {
      return digits.length >= 9 && digits.length <= 10; // France/Germany
    } else if (country === '91') {
      return digits.length === 10; // India
    }
    
    // Default: between 7 and 15 digits
    return digits.length >= 7 && digits.length <= 15;
  };

  const handlePhoneChange = (input: string) => {
    const formatted = formatPhoneNumber(input, countryCode);
    setPhoneNumber(formatted);
    
    const isValidNumber = validatePhoneNumber(formatted, countryCode);
    setIsValid(isValidNumber);
    onValidityChange?.(isValidNumber);
    
    // Create full international number
    const digits = formatted.replace(/\D/g, '');
    const fullNumber = `+${countryCode}${digits}`;
    onChange(fullNumber, countryCode);
  };

  const handleCountryChange = (newCountryCode: string, countryName: string) => {
    setCountryCode(newCountryCode);
    
    // Reformat phone number for new country
    if (phoneNumber) {
      const digits = phoneNumber.replace(/\D/g, '');
      const formatted = formatPhoneNumber(digits, newCountryCode);
      setPhoneNumber(formatted);
      
      const isValidNumber = validatePhoneNumber(formatted, newCountryCode);
      setIsValid(isValidNumber);
      onValidityChange?.(isValidNumber);
      
      const fullNumber = `+${newCountryCode}${digits}`;
      onChange(fullNumber, newCountryCode);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        <TranslatableText text="Phone Number" />
      </Label>
      
      <div className="flex gap-2">
        <CountryCodeSelector
          selectedCountry={countryCode}
          onCountryChange={handleCountryChange}
          className="shrink-0"
        />
        
        <div className="flex-1 relative">
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder={placeholder || "Enter phone number"}
            disabled={disabled}
            className={cn(
              "transition-colors",
              phoneNumber && !isValid && "border-red-500 focus-visible:ring-red-500",
              phoneNumber && isValid && "border-green-500 focus-visible:ring-green-500"
            )}
          />
          
          {phoneNumber && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isValid ? (
                <span className="text-green-500 text-xs">✓</span>
              ) : (
                <span className="text-red-500 text-xs">✗</span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {phoneNumber && !isValid && (
        <p className="text-xs text-red-500">
          <TranslatableText text="Please enter a valid phone number" />
        </p>
      )}
      
      <p className="text-xs text-muted-foreground">
        <TranslatableText text="We'll send you a verification code via SMS" />
      </p>
    </div>
  );
};
