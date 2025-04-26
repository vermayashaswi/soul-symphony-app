
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export const EmptyState = () => {
  const { t } = useTranslation();

  return (
    <div className={`
      bg-background rounded-xl p-8 text-center border min-h-[400px] flex items-center justify-center
    `}>
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('insights.soulnet.empty.title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('insights.soulnet.empty.description')}
        </p>
        <Button onClick={() => window.location.href = '/journal'}>
          {t('insights.soulnet.empty.button')}
        </Button>
      </div>
    </div>
  );
};
