
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import { useTranslation } from 'react-i18next';

const AudioRecorder = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('Voice Journal')}
          </h1>
          <p className="text-gray-600">
            {t('Record your thoughts and feelings')}
          </p>
        </div>

        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="p-8">
            <VoiceRecorder />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AudioRecorder;
