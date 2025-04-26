
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { JournalEntry } from '@/types/journal'; 

const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' }
  ];

  const handleLanguageChange = async (languageCode: string) => {
    i18n.changeLanguage(languageCode);

    // Only trigger translation if user is logged in and switching to Hindi
    if (user && languageCode === 'hi') {
      try {
        // Get the latest journal entries that need translation
        const { data, error: fetchError } = await supabase
          .from('Journal Entries')
          .select('id, "refined text", translation_status')
          .eq('user_id', user.id)
          .eq('translation_status', 'pending')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        
        // Make sure data is valid and is an array
        if (!data || !Array.isArray(data)) {
          console.log('No entries to translate or invalid data format');
          return;
        }

        // Filter valid entries
        const validEntries = data.filter(entry => 
          entry && 
          typeof entry.id === 'number' && 
          entry["refined text"]
        );

        // Translate each valid entry
        for (const entry of validEntries) {
          try {
            const response = await supabase.functions.invoke('translate-text', {
              body: {
                text: entry["refined text"],
                entryId: entry.id,
                sourceLanguage: 'en',
                targetLanguage: 'hi'
              }
            });

            if (response.error) {
              console.error('Translation error:', response.error);
              toast.error('Error translating some entries');
            }
          } catch (err) {
            console.error('Translation invoke error:', err);
            toast.error('Error connecting to translation service');
          }
        }

        if (validEntries.length) {
          toast.success(`Translating ${validEntries.length} entries to Hindi`);
        }
      } catch (error) {
        console.error('Error in translation process:', error);
        toast.error('Failed to process translations');
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
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
