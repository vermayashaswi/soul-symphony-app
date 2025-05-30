
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { 
  User, 
  Palette
} from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { ThemeSection } from '@/components/settings/ThemeSection';

const Settings = () => {
  console.log("Rendering Settings page");
  
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadTime, setLoadTime] = useState<number | null>(null);

  // Simple initialization without complex dependencies
  useEffect(() => {
    const initializeSettings = async () => {
      const startTime = Date.now();
      console.log('[Settings] Starting initialization');
      
      try {
        // Simple delay to simulate initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setLoadTime(Date.now() - startTime);
        console.log(`[Settings] Initialization completed in ${Date.now() - startTime}ms`);
      } catch (err) {
        console.error('[Settings] Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize settings');
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, []);

  return (
    <SettingsLoadingWrapper 
      isLoading={isLoading}
      error={error}
      loadTime={loadTime}
      showPerformanceAlert={loadTime ? loadTime > 3000 : false}
    >
      <div className="min-h-screen pb-20">
        <div className="max-w-3xl mx-auto px-4 pt-2">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">
              <TranslatableText text="Settings" forceTranslate={true} />
            </h1>
            <p className="text-muted-foreground">
              <TranslatableText text="Manage your account and app preferences" forceTranslate={true} />
            </p>
          </div>
          
          <div className="space-y-6">
            {/* Profile Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ProfileSection />
            </motion.div>

            {/* Subscription Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <SubscriptionManagement />
            </motion.div>

            {/* Appearance Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    <TranslatableText text="Appearance" forceTranslate={true} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium">
                      <TranslatableText text="Language" forceTranslate={true} />
                    </Label>
                    <div className="mt-2">
                      <LanguageSelector />
                    </div>
                  </div>
                  
                  <ThemeSection />
                </CardContent>
              </Card>
            </motion.div>

            {/* Performance Info (dev mode) */}
            {process.env.NODE_ENV === 'development' && loadTime && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Settings load time: {loadTime}ms</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </SettingsLoadingWrapper>
  );
};

export default Settings;
