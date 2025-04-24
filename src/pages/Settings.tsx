import React from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';

const Settings = () => {
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
          <div>
            <h3 className="text-lg font-medium">Language</h3>
            <p className="text-sm text-muted-foreground">
              Choose your preferred language
            </p>
          </div>
          <LanguageSelector />
        </div>
        
      </div>
    </div>
  );
};

export default Settings;
