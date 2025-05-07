
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslationProvider, useTranslation } from '@/contexts/TranslationContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Circle, CheckCircle, Palette } from 'lucide-react';
import { useUserColorThemeHex } from '@/components/insights/soulnet/useUserColorThemeHex';

const Settings = () => {
  const { user, updateUserProfile } = useAuth();
  const { colorTheme, setColorTheme, customColor, setCustomColor, theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const themeColor = useUserColorThemeHex();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, timezone')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching profile:', error);
          } else if (data) {
            setDisplayName(data.display_name || '');
            setTimezone(data.timezone || 'Not set');
          }
        } catch (error) {
          console.error('Exception fetching profile:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(`Error updating profile: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };
  
  const getColorForTheme = (themeName: string): string => {
    switch (themeName) {
      case 'Default':
        return '#3b82f6';
      case 'Calm':
        return '#8b5cf6';
      case 'Soothing':
        return '#FFDEE2';
      case 'Energy':
        return '#f59e0b';
      case 'Focus':
        return '#10b981';
      case 'Custom':
        return customColor;
      default:
        return '#3b82f6';
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">
        <TranslatableText text="Settings" />
      </h1>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="profile">
            <TranslatableText text="Profile" />
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <TranslatableText text="Appearance" />
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>
                <TranslatableText text="Profile Information" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  <TranslatableText text="Display Name" />
                </Label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={handleDisplayNameChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Your display name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>
                  <TranslatableText text="Timezone" />
                </Label>
                <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center">
                  {timezone || "Not set"}
                </div>
                <div className="text-xs text-muted-foreground">
                  <TranslatableText text="Your timezone is automatically detected and used for scheduling and notifications." />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>
                  <TranslatableText text="Profile Picture" />
                </Label>
                <ProfilePictureUpload />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpdateProfile} disabled={isLoading}>
                <TranslatableText text={isLoading ? "Saving..." : "Save Changes"} />
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>
                <TranslatableText text="Appearance" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base">
                  <TranslatableText text="Display Mode" />
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {['light', 'dark', 'system'].map((mode) => (
                    <div
                      key={mode}
                      onClick={() => setTheme(mode as 'light' | 'dark' | 'system')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${
                        theme === mode 
                          ? 'border-theme bg-theme-lighter shadow-md' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                        mode === 'light' ? 'bg-white border' : 
                        mode === 'dark' ? 'bg-gray-900 text-white' : 'bg-gradient-to-r from-white to-gray-900'
                      }`}>
                        {theme === mode && (
                          <CheckCircle className="w-5 h-5" />
                        )}
                      </div>
                      <span className="text-sm capitalize">
                        <TranslatableText text={mode} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base">
                  <TranslatableText text="Color Theme" />
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {['Default', 'Calm', 'Soothing', 'Energy', 'Focus', 'Custom'].map((themeOption) => (
                    <div
                      key={themeOption}
                      onClick={() => setColorTheme(themeOption as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${
                        colorTheme === themeOption 
                          ? 'border-theme bg-theme-lighter shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                        style={{ backgroundColor: getColorForTheme(themeOption) }}
                      >
                        {colorTheme === themeOption && (
                          <CheckCircle className="w-5 h-5 text-white drop-shadow-md" />
                        )}
                        {themeOption === 'Custom' && colorTheme !== 'Custom' && (
                          <Palette className="w-5 h-5 text-white drop-shadow-md" />
                        )}
                      </div>
                      <span className="text-sm">
                        <TranslatableText text={themeOption} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {colorTheme === 'Custom' && (
                <div className="pt-4 border-t">
                  <Label className="text-base mb-4 block">
                    <TranslatableText text="Custom Color" />
                  </Label>
                  <ColorPicker 
                    value={customColor}
                    onChange={setCustomColor}
                    applyImmediately
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
