
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

const Profile = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('Profile')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t('Manage your profile settings here.')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
