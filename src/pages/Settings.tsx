
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Button } from '@/components/ui/button';
import LanguageSelector from '@/components/LanguageSelector';
import { toast } from 'sonner';
import ColorPicker from '@/components/settings/ColorPicker';
import ProfilePictureUpload from '@/components/settings/ProfilePictureUpload';
import { ResetTutorialButton } from '@/components/tutorial/ResetTutorialButton';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { setColorTheme, theme, colorTheme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  // Handle theme toggle
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Error logging out');
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto p-4 mb-16">
      <h1 className="text-2xl font-bold mb-6">
        <TranslatableText text="Settings" />
      </h1>
      
      {user && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            <TranslatableText text="Profile" />
          </h2>
          <div className="space-y-4">
            <ProfilePictureUpload />
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                <TranslatableText text="Email" />
              </p>
              <p className="font-medium">{user.email}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">
          <TranslatableText text="Appearance" />
        </h2>
        
        <div className="grid gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              <TranslatableText text="Theme" />
            </p>
            <div className="flex space-x-2">
              <Button 
                variant={theme === 'light' ? "default" : "outline"}
                className="w-full"
                onClick={() => setTheme('light')}
              >
                <TranslatableText text="Light" />
              </Button>
              <Button 
                variant={theme === 'dark' ? "default" : "outline"}
                className="w-full"
                onClick={() => setTheme('dark')}
              >
                <TranslatableText text="Dark" />
              </Button>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              <TranslatableText text="Accent Color" />
            </p>
            <ColorPicker 
              currentColor={colorTheme} 
              onColorChange={setColorTheme}
            />
          </div>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">
          <TranslatableText text="Language" />
        </h2>
        <LanguageSelector />
      </div>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">
          <TranslatableText text="Tutorial" />
        </h2>
        <ResetTutorialButton />
      </div>
      
      {user && (
        <div className="pt-4">
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={handleLogout}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                <TranslatableText text="Logging Out..." />
              </div>
            ) : (
              <TranslatableText text="Logout" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Settings;
