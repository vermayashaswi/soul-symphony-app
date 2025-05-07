
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Settings = () => {
  const { user, updateUserProfile } = useAuth();
  const { colorTheme, setColorTheme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

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
            <CardContent>
              <div className="space-y-2">
                <Label>
                  <TranslatableText text="Theme" />
                </Label>
                <RadioGroup
                  value={colorTheme}
                  onValueChange={setColorTheme}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light">
                      <TranslatableText text="Light" />
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark">
                      <TranslatableText text="Dark" />
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system">
                      <TranslatableText text="System" />
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
