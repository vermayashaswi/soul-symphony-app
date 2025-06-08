
import React from 'react';
import { SettingsErrorBoundary } from '@/components/settings/SettingsErrorBoundary';
import { ProgressiveSettingsPage } from '@/components/settings/ProgressiveSettingsPage';

const Settings = () => {
  console.log('[Settings] Rendering Settings page with progressive loading');

  return (
    <SettingsErrorBoundary>
      <ProgressiveSettingsPage />
    </SettingsErrorBoundary>
  );
};

export default Settings;
