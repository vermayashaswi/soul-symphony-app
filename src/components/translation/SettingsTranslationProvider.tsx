import React, { createContext, useContext, ReactNode } from 'react';
import { usePageTranslation } from '@/hooks/use-page-translation';

interface SettingsTranslationContextType {
  isTranslating: boolean;
  progress: number;
  getTranslation: (text: string) => string | null;
  retryTranslation: () => void;
}

const SettingsTranslationContext = createContext<SettingsTranslationContextType | undefined>(undefined);

interface SettingsTranslationProviderProps {
  children: ReactNode;
}

// Common texts used throughout the Settings page
const SETTINGS_PAGE_TEXTS = [
  'Settings',
  'Account',
  'Profile',
  'Privacy',
  'Security',
  'Notifications',
  'Language',
  'Theme',
  'Data',
  'Support',
  'About',
  'General',
  'Preferences',
  'Display name',
  'Email',
  'Phone',
  'Avatar',
  'Change password',
  'Two-factor authentication',
  'Login sessions',
  'Privacy policy',
  'Terms of service',
  'Data export',
  'Data deletion',
  'Account deletion',
  'Push notifications',
  'Email notifications',
  'Sound',
  'Vibration',
  'Dark mode',
  'Light mode',
  'System',
  'Auto',
  'Font size',
  'Small',
  'Medium',
  'Large',
  'Backup',
  'Restore',
  'Sync',
  'Storage',
  'Cache',
  'Clear cache',
  'Help center',
  'Contact support',
  'Send feedback',
  'Report issue',
  'Version',
  'Build',
  'Legal',
  'Licenses',
  'Open source',
  'Credits',
  'Save',
  'Cancel',
  'Reset',
  'Apply',
  'Enabled',
  'Disabled',
  'On',
  'Off',
  'Always',
  'Never',
  'Default',
  'Custom',
  'Advanced',
  'Export data',
  'Import data',
  'Delete account',
  'Sign out',
  'Are you sure?',
  'This cannot be undone',
  'Confirm',
  'Settings saved',
  'Changes applied',
  'Reset to default',
  'Update available',
  'Download update',
  'Install now',
  'Restart required'
];

export const SettingsTranslationProvider: React.FC<SettingsTranslationProviderProps> = ({ children }) => {
  const pageTranslation = usePageTranslation({
    pageTexts: SETTINGS_PAGE_TEXTS,
    route: '/settings',
    enabled: true
  });

  const value: SettingsTranslationContextType = {
    isTranslating: pageTranslation.isTranslating,
    progress: pageTranslation.progress,
    getTranslation: pageTranslation.getTranslation,
    retryTranslation: pageTranslation.retryTranslation
  };

  return (
    <SettingsTranslationContext.Provider value={value}>
      {children}
    </SettingsTranslationContext.Provider>
  );
};

export const useSettingsTranslation = (): SettingsTranslationContextType => {
  const context = useContext(SettingsTranslationContext);
  if (context === undefined) {
    throw new Error('useSettingsTranslation must be used within a SettingsTranslationProvider');
  }
  return context;
};