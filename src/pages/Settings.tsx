
// Import React and other necessary components
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { supabase } from '@/integrations/supabase/client';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { toast as shadcnToast } from '@/hooks/use-toast';
import { TranslatableText } from '@/components/translation/TranslatableText';
import RestartTutorialButton from '@/components/tutorial/RestartTutorialButton';

const Settings = () => {
  const { theme: colorTheme, setTheme: updateTheme, systemTheme: themeMode, setTheme: setThemeMode } = useTheme();
  const { user, signOut } = useAuth();
  const { currentLanguage, setLanguage, languages } = useTranslation();
  const [username, setUsername] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(themeMode === 'dark');
  const [isLoading, setIsLoading] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  
  useScrollRestoration();
  
  // Effect to handle dark mode toggle
  useEffect(() => {
    setThemeMode(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode, setThemeMode]);
  
  // Effect to load user profile data
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }
        
        if (data) {
          // Safely access properties using optional chaining
          setUsername(data.display_name || data.full_name || '');
          setProfileImageUrl(data.avatar_url || null);
          
          // We need to use type assertion here since we know the database structure
          // might include settings even if TypeScript doesn't know about it
          const profileData = data as any;
          
          if (profileData.settings && typeof profileData.settings === 'object') {
            setBatchSize(profileData.settings.batch_size || 10);
          }
        }
      } catch (error) {
        console.error('Error in profile fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user]);
  
  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };
  
  const saveSettings = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      // First check if 'settings' column exists in profiles table
      const { data: columnCheck, error: columnError } = await supabase
        .rpc('check_table_columns', { table_name: 'profiles' });
      
      if (columnError) {
        console.error('Error checking columns:', columnError);
        throw columnError;
      }
      
      // Find if settings column exists
      const hasSettingsColumn = columnCheck.some(col => col.column_name === 'settings');
      
      let updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      
      // Only include settings if the column exists
      if (hasSettingsColumn) {
        updateData.settings = { batch_size: batchSize };
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);
        
      if (error) throw error;
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveProfile = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: username,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
        
      if (error) throw error;
      
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <div className="flex flex-col space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          <TranslatableText text="Settings" />
        </h1>
        
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">
              <TranslatableText text="Account" />
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <TranslatableText text="Appearance" />
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <TranslatableText text="Preferences" />
            </TabsTrigger>
            <TabsTrigger value="help">
              <TranslatableText text="Help" />
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle><TranslatableText text="Profile" /></CardTitle>
                <CardDescription>
                  <TranslatableText text="Manage your account profile and preferences" />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div id="language-selector" data-tutorial="language-selector">
                    <Label htmlFor="language">
                      <TranslatableText text="Language" />
                    </Label>
                    <Select
                      value={currentLanguage}
                      onValueChange={(value) => setLanguage(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="username">
                      <TranslatableText text="Display Name" />
                    </Label>
                    <input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full p-2 border rounded mt-1 bg-background text-foreground"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="profile-picture">
                      <TranslatableText text="Profile Picture" />
                    </Label>
                    <ProfilePictureUpload
                      userId={user?.id}
                      currentImageUrl={profileImageUrl}
                      onImageUploaded={(url) => setProfileImageUrl(url)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="destructive"
                  onClick={() => signOut()}
                >
                  <TranslatableText text="Sign Out" />
                </Button>
                <Button 
                  onClick={() => saveProfile()}
                  disabled={isLoading}
                >
                  <TranslatableText text="Save Profile" />
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle><TranslatableText text="Theme" /></CardTitle>
                <CardDescription>
                  <TranslatableText text="Customize how the app looks and feels" />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={setIsDarkMode}
                    id="dark-mode"
                  />
                  <Label htmlFor="dark-mode">
                    <TranslatableText text="Dark Mode" />
                  </Label>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label>
                    <TranslatableText text="Color Theme" />
                  </Label>
                  <ColorPicker
                    selectedTheme={colorTheme}
                    onChange={updateTheme}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle><TranslatableText text="Application Preferences" /></CardTitle>
                <CardDescription>
                  <TranslatableText text="Configure your journal and insights settings" />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batch-size">
                    <TranslatableText text="Journal Batch Size" />
                  </Label>
                  <Select
                    value={batchSize.toString()}
                    onValueChange={(value) => setBatchSize(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Number of journal entries to load at once" />
                  </p>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label><TranslatableText text="App Tutorial" /></Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    <TranslatableText text="Restart the guided tutorial to learn how to use the app" />
                  </p>
                  <RestartTutorialButton />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={saveSettings}
                  disabled={isLoading}
                >
                  <TranslatableText text="Save Preferences" />
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="help" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle><TranslatableText text="Help & Resources" /></CardTitle>
                <CardDescription>
                  <TranslatableText text="Get help and learn more about SOULo" />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">
                    <TranslatableText text="App Tutorial" />
                  </h3>
                  <p className="text-muted-foreground">
                    <TranslatableText text="Take the tutorial to learn how to use SOULo" />
                  </p>
                  <RestartTutorialButton className="mt-2" />
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">
                    <TranslatableText text="Feedback" />
                  </h3>
                  <p className="text-muted-foreground">
                    <TranslatableText text="We'd love to hear your suggestions and comments" />
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.open('mailto:feedback@soulo.online', '_blank')}
                  >
                    <TranslatableText text="Send Feedback" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
