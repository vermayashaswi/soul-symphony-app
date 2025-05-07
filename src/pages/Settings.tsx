
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/contexts/TranslationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { ColorPicker } from '@/components/settings/ColorPicker';
import RestartTutorialButton from '@/components/tutorial/RestartTutorialButton';
import { TranslatableText } from '@/components/translation/TranslatableText';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { setTheme, theme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [initialName, setInitialName] = useState('');
  const { currentLanguage } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        if (data?.display_name) {
          setDisplayName(data.display_name);
          setInitialName(data.display_name);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [user]);

  const handleUpdateDisplayName = async () => {
    if (!user || displayName === initialName) return;
    
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast.success('Display name updated successfully');
      setInitialName(displayName);
    } catch (error) {
      console.error('Error updating display name:', error);
      toast.error('Failed to update display name');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Before signing out, update the tutorial_completed status to "NO" in the database
      if (user) {
        await supabase
          .from('profiles')
          .update({ tutorial_completed: 'NO' })
          .eq('id', user.id);
      }
      
      await signOut();
      toast.success('Successfully signed out');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="container max-w-md mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">
        <TranslatableText text="Settings" />
      </h1>
      
      <div className="space-y-6">
        {/* Profile Section */}
        <section className="bg-card rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-4">
            <TranslatableText text="Profile" />
          </h2>
          
          <div className="flex flex-col items-center mb-4">
            <ProfilePictureUpload />
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                <TranslatableText text="Display Name" />
              </label>
              <div className="flex">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleUpdateDisplayName}
                  disabled={isLoading || displayName === initialName}
                  className="ml-2"
                  size="sm"
                >
                  <TranslatableText text="Save" />
                </Button>
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                <TranslatableText text="Email" />
              </label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </section>
        
        {/* Appearance Section */}
        <section className="bg-card rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-4">
            <TranslatableText text="Appearance" />
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <TranslatableText text="Theme" />
              </label>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme('light')}
                >
                  <TranslatableText text="Light" />
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme('dark')}
                >
                  <TranslatableText text="Dark" />
                </Button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                <TranslatableText text="Accent Color" />
              </label>
              <ColorPicker 
                value={""} 
                onChange={() => {}}
                applyImmediately={true}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                <TranslatableText text="Tutorial" />
              </label>
              <RestartTutorialButton />
            </div>
          </div>
        </section>
        
        {/* Account Section */}
        <section className="bg-card rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-4">
            <TranslatableText text="Account" />
          </h2>
          
          <Button 
            variant="destructive" 
            onClick={handleSignOut}
            className="w-full"
          >
            <TranslatableText text="Sign Out" />
          </Button>
        </section>
      </div>
    </div>
  );
};

export default Settings;
