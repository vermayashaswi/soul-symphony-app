
import React from 'react';
import { SettingsErrorBoundary } from '@/components/settings/SettingsErrorBoundary';
import { ProgressiveSettingsPage } from '@/components/settings/ProgressiveSettingsPage';

const Settings = () => {
  console.log('[Settings] 🏗️ Settings page component mounting');
  console.log('[Settings] Current URL:', window.location.href);
  console.log('[Settings] Current pathname:', window.location.pathname);

  const handleErrorBoundaryReset = () => {
    console.log('[Settings] 🔄 Error boundary reset triggered');
  };

  return (
    <SettingsErrorBoundary onReset={handleErrorBoundaryReset}>
      <ProgressiveSettingsPage />
    </SettingsErrorBoundary>
  );
};

export default Settings;
