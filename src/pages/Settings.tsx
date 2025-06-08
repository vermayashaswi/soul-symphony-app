
import React from 'react';
import { SettingsErrorBoundary } from '@/components/settings/SettingsErrorBoundary';
import { SimpleSettingsPage } from '@/components/settings/SimpleSettingsPage';

const Settings = () => {
  console.log('[Settings] 🏗️ Settings page component mounting');
  console.log('[Settings] Current URL:', window.location.href);
  console.log('[Settings] Current pathname:', window.location.pathname);

  const handleErrorBoundaryReset = () => {
    console.log('[Settings] 🔄 Error boundary reset triggered');
  };

  return (
    <SettingsErrorBoundary onReset={handleErrorBoundaryReset}>
      <SimpleSettingsPage />
    </SettingsErrorBoundary>
  );
};

export default Settings;
