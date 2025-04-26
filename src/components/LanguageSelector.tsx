
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

        if (fetchError) {
          console.error('Error fetching entries:', fetchError);
          toast.error('Error fetching entries for translation');
          return;
        }
        
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

        console.log(`Found ${validEntries.length} entries to translate`);
        
        let successCount = 0;
        let errorCount = 0;

        // Translate each valid entry
        for (const entry of validEntries) {
          try {
            console.log(`Translating entry ${entry.id}`);
            const response = await supabase.functions.invoke('translate-text', {
              body: {
                text: entry["refined text"],
                entryId: entry.id,
                sourceLanguage: 'en',
                targetLanguage: 'hi'
              }
            });

            if (response.error) {
              console.error(`Translation error for entry ${entry.id}:`, response.error);
              errorCount++;
            } else {
              console.log(`Successfully translated entry ${entry.id}`);
              successCount++;
            }
          } catch (err) {
            console.error(`Translation invoke error for entry ${entry.id}:`, err);
            errorCount++;
          }
        }

        // Show appropriate toast message based on results
        if (successCount > 0) {
          toast.success(`Successfully translated ${successCount} entries to Hindi`);
        }
        
        if (errorCount > 0) {
          toast.error(`Error translating ${errorCount} entries`);
        }
        
        if (validEntries.length === 0) {
          toast.info('No entries found that need translation');
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
