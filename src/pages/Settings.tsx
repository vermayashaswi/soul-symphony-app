
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { EmbeddingGenerationSection } from '@/components/settings/EmbeddingGenerationSection';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';

const Settings = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('[Settings] Error getting user:', userError);
          setError('Failed to load user data');
          return;
        }
        
        setUser(user);
      } catch (error) {
        console.error('[Settings] Unexpected error:', error);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    getUser();
  }, []);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Settings] Sign out error:', error);
        toast.error('Failed to sign out. Please try again.');
      } else {
        toast.success('Signed out successfully');
        navigate('/');
      }
    } catch (error) {
      console.error('[Settings] Unexpected sign out error:', error);
      toast.error('An unexpected error occurred while signing out');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SettingsLoadingWrapper isLoading={isLoading} error={error}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Customize your Soulo experience</p>
          </div>

          {/* Settings Grid */}
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {/* Profile Section */}
            <ProfileSection />

            {/* Subscription Management */}
            <SubscriptionManagement />

            {/* Embedding Generation Section */}
            <div className="lg:col-span-2">
              <EmbeddingGenerationSection />
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full py-3 text-white bg-red-500 rounded-md hover:bg-red-600 transition duration-300 disabled:bg-red-300 disabled:cursor-not-allowed"
            >
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>
    </SettingsLoadingWrapper>
  );
};

export default Settings;
