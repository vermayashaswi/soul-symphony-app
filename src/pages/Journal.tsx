
  // Let's modify just the checkUserProfile function in Journal.tsx
  const checkUserProfile = async (userId: string) => {
    try {
      const event = new CustomEvent('journalOperationStart', {
        detail: {
          type: 'loading',
          message: 'Checking user profile'
        }
      });
      const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;
      
      console.log('Checking user profile for ID:', userId);
      
      // Use the ensureProfileExists function from AuthContext instead
      const { ensureProfileExists } = useAuth();
      await ensureProfileExists();
      
      // Still check the profile to get the onboarding status
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, onboarding_completed')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error checking profile:', error);
        if (opId) {
          window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
            detail: {
              id: opId,
              status: 'error',
              details: `Profile error: ${error.message}`
            }
          }));
        }
        throw error;
      }
      
      console.log('Profile exists:', profile.id);
      setIsFirstTimeUser(!profile.onboarding_completed);
      setIsProfileChecked(true);
      
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            status: 'success'
          }
        }));
      }
    } catch (error: any) {
      console.error('Error checking/creating user profile:', error);
      toast.error('Error setting up profile. Please try again.');
    }
  };
