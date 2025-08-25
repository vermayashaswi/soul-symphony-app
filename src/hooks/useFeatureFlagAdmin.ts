
import { useState } from 'react';
import { db } from '@/utils/supabaseClient';
import { AppFeatureFlag } from '@/types/featureFlags';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useFeatureFlagAdmin = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const setUserFeatureFlag = async (flagName: AppFeatureFlag, enabled: boolean) => {
    if (!user) {
      toast.error('Authentication required');
      return false;
    }

    try {
      setLoading(true);

      // First, get the feature flag ID
      const { data: flagData, error: flagError } = await db.featureFlags.selectByName(flagName);

      if (flagError || !flagData) {
        toast.error('Feature flag not found');
        return false;
      }

      // Upsert user feature flag override
      const { error: upsertError } = await db.userFeatureFlags.upsert({
        user_id: user.id,
        feature_flag_id: flagData?.id || '',
        is_enabled: enabled,
      }, {
        onConflict: 'user_id,feature_flag_id'
      });

      if (upsertError) {
        console.error('Error setting user feature flag:', upsertError);
        toast.error('Failed to update feature flag');
        return false;
      }

      toast.success(`Feature flag ${flagName} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Unexpected error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeUserFeatureFlag = async (flagName: AppFeatureFlag) => {
    if (!user) {
      toast.error('Authentication required');
      return false;
    }

    try {
      setLoading(true);

      // Get the feature flag ID
      const { data: flagData, error: flagError } = await db.featureFlags.selectByName(flagName);

      if (flagError || !flagData) {
        toast.error('Feature flag not found');
        return false;
      }

      // Remove user override
      const { error: deleteError } = await db.userFeatureFlags.delete(user.id, flagData?.id || '');

      if (deleteError) {
        console.error('Error removing user feature flag:', deleteError);
        toast.error('Failed to remove feature flag override');
        return false;
      }

      toast.success(`Feature flag ${flagName} override removed`);
      return true;
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Unexpected error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    setUserFeatureFlag,
    removeUserFeatureFlag,
    loading,
  };
};
