import React, { useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { EmbeddingGenerationSection } from '@/components/settings/EmbeddingGenerationSection';

const Settings = () => {
  const user = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error('Failed to sign out. Please try again.');
    } else {
      router.push('/');
    }

    setIsLoading(false);
  };

  return (
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
            disabled={isLoading}
            className="w-full py-3 text-white bg-red-500 rounded-md hover:bg-red-600 transition duration-300 disabled:bg-red-300"
          >
            {isLoading ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
