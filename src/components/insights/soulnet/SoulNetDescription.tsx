
import React from 'react';
import { useTranslation } from 'react-i18next';

export const SoulNetDescription: React.FC = () => {
  const { t } = useTranslation();
  console.log("Rendering SoulNetDescription component");
  
  return (
    <div className="mb-4 p-4 md:mb-6">
      <h2 className="text-lg font-semibold mb-2">{t('insights.soulnet.title')}</h2>
      <p className="text-muted-foreground text-sm">
        {t('insights.soulnet.description')}
      </p>
    </div>
  );
};

export default SoulNetDescription;
