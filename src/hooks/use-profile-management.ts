
import { useState, useRef } from 'react';

interface UseProfileManagementProps {
  userId?: string;
  ensureProfileExists: () => Promise<boolean>;
}

export function useProfileManagement({ userId, ensureProfileExists }: UseProfileManagementProps) {
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [profileCreationAttempts, setProfileCreationAttempts] = useState(0);
  const [lastProfileErrorTime, setLastProfileErrorTime] = useState(0);
  const profileCheckedOnceRef = useRef(false);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxProfileAttempts = 3;

  const checkUserProfile = async (userId: string) => {
    try {
      setIsCheckingProfile(true);
      setShowRetryButton(false);
      
      const profileCreated = await ensureProfileExists();
      profileCheckedOnceRef.current = true;
      
      if (!profileCreated) {
        if (profileCreationAttempts < maxProfileAttempts) {
          setProfileCreationAttempts(prev => prev + 1);
          const retryDelay = 1000 * Math.pow(1.5, profileCreationAttempts);
          
          if (autoRetryTimeoutRef.current) {
            clearTimeout(autoRetryTimeoutRef.current);
          }
          
          autoRetryTimeoutRef.current = setTimeout(() => {
            if (profileCreationAttempts >= maxProfileAttempts - 1) {
              setShowRetryButton(true);
            }
            checkUserProfile(userId);
          }, retryDelay);
        } else {
          setShowRetryButton(true);
        }
      } else {
        setProfileCreationAttempts(0);
      }
      
      setIsProfileChecked(true);
    } catch (error: any) {
      const now = Date.now();
      if (now - lastProfileErrorTime > 60000) {
        setLastProfileErrorTime(now);
      }
      
      handleProfileError(userId);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleProfileError = (userId: string) => {
    if (profileCreationAttempts < maxProfileAttempts) {
      setProfileCreationAttempts(prev => prev + 1);
      const retryDelay = 1000 * Math.pow(1.5, profileCreationAttempts);
      
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
      
      autoRetryTimeoutRef.current = setTimeout(() => {
        if (profileCreationAttempts >= maxProfileAttempts - 1) {
          setShowRetryButton(true);
        }
        checkUserProfile(userId);
      }, retryDelay);
    } else {
      setShowRetryButton(true);
    }
    
    setIsProfileChecked(true);
  };

  const handleRetryProfileCreation = () => {
    if (!userId) return;
    
    setProfileCreationAttempts(0);
    profileCheckedOnceRef.current = false;
    setIsProfileChecked(false);
    checkUserProfile(userId);
  };

  return {
    isProfileChecked,
    isCheckingProfile,
    showRetryButton,
    checkUserProfile,
    handleRetryProfileCreation
  };
}
