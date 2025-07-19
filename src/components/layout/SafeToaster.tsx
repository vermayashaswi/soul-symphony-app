import React from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/hooks/use-theme';

export function SafeToaster() {
  try {
    // This will throw an error if not within ThemeProvider
    const theme = useTheme();
    return <Toaster />;
  } catch (error) {
    // If theme context is not available, don't render the toaster
    console.warn('[SafeToaster] Theme context not available, skipping toaster render');
    return null;
  }
}