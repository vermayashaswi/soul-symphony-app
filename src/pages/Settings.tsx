
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Languages, 
  Moon, 
  Sun, 
  Palette, 
  Crown,
  Star,
  Calendar,
  MapPin,
  Mail,
  Clock,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { useUserProfile } from '@/hooks/useUserProfile';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';
import { useTrialAccess } from '@/hooks/useTrialAccess';
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal';

const Settings = () => {
  console.log("Rendering Settings page");
  
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { translate, currentLanguage } = useTranslation();
  const loadStartTime = useRef(Date.now());
  
  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useUserProfile();
  
  const {
    hasAccess,
    isTrialExpired,
    isLoading: trialLoading,
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal,
    loadTime: trialLoadTime
  } = useTrialAccess();

  const [isInitialized, setIsInitialized] = useState(false);
  const [totalLoadTime, setTotalLoadTime] = useState<number | null>(null);

  // Initialize component and track loading
  useEffect(() => {
    const initializeSettings = async () => {
      console.log('[Settings] Starting initialization');
      
      // Pre-translate common settings strings
      if (translate && currentLanguage !== 'en') {
        try {
          await translate("Settings", "en");
          await translate("Profile", "en");
          await translate("Subscription", "en");
          await translate("Appearance", "en");
          await translate("Language", "en");
          await translate("Theme", "en");
        } catch (e) {
          console.error("Error pre-translating settings strings:", e);
        }
      }
      
      setIsInitialized(true);
      
      const loadTime = Date.now() - loadStartTime.current;
      setTotalLoadTime(loadTime);
      console.log(`[Settings] Initialization completed in ${loadTime}ms`);
    };

    initializeSettings();
  }, [translate, currentLanguage]);

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Palette },
  ];

  const formatJoinDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const getJournalStats = () => {
    return {
      totalEntries: profile?.stats?.totalEntries || 0,
      streak: profile?.stats?.currentStreak || 0
    };
  };

  const stats = getJournalStats();
  const isLoading = profileLoading || trialLoading || !isInitialized;
  const error = profileError;
  const shouldShowPerformanceAlert = totalLoadTime && totalLoadTime > 3000;

  console.log('[Settings] Render state:', {
    isLoading,
    error,
    profileLoading,
    trialLoading,
    isInitialized,
    totalLoadTime,
    trialLoadTime
  });

  return (
    <SettingsLoadingWrapper 
      isLoading={isLoading}
      error={error}
      loadTime={totalLoadTime}
      showPerformanceAlert={shouldShowPerformanceAlert}
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <TranslatableText text="Profile" forceTranslate={true} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                    <div className="h-24 w-24 relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback className="text-2xl">
                          {profile?.displayName?.[0] || profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    
                    <div className="flex-1 space-y-4 text-center sm:text-left">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {profile?.displayName || profile?.full_name || user?.email?.split('@')[0] || 'User'}
                        </h3>
                        <p className="text-muted-foreground">{user?.email}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <BarChart3 className="h-4 w-4" />
                            <TranslatableText text="Entries" forceTranslate={true} />
                          </div>
                          <div className="text-lg font-semibold">{stats.totalEntries}</div>
                        </div>
                        
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <TrendingUp className="h-4 w-4" />
                            <TranslatableText text="Streak" forceTranslate={true} />
                          </div>
                          <div className="text-lg font-semibold">{stats.streak} days</div>
                        </div>
                      </div>
                      
                      {profile?.created_at && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <TranslatableText text="Joined" forceTranslate={true} />
                          {formatJoinDate(profile.created_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                  
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      <TranslatableText text="Theme" forceTranslate={true} />
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {themes.map((themeOption) => {
                        const Icon = themeOption.icon;
                        const isSelected = theme === themeOption.value;
                        
                        return (
                          <button
                            key={themeOption.value}
                            onClick={() => setTheme(themeOption.value as any)}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${
                              isSelected 
                                ? 'border-primary bg-primary/5 text-primary' 
                                : 'border-muted hover:border-primary/50'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs font-medium">
                              <TranslatableText text={themeOption.label} forceTranslate={true} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Performance Info (dev mode) */}
            {process.env.NODE_ENV === 'development' && totalLoadTime && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Settings load time: {totalLoadTime}ms</div>
                      {trialLoadTime && <div>Trial check time: {trialLoadTime}ms</div>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
        
        {showSubscriptionModal && (
          <SubscriptionModal 
            isOpen={showSubscriptionModal}
            onClose={closeSubscriptionModal}
          />
        )}
      </div>
    </SettingsLoadingWrapper>
  );
};

export default Settings;
