
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { toast } from 'sonner';

interface UseAuthGuardOptions {
  redirectTo?: string;
  showToast?: boolean;
  feature?: string;
}

export const useAuthGuard = (options: UseAuthGuardOptions = {}) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  
  const {
    redirectTo = '/app/auth',
    showToast = true,
    feature = 'this feature'
  } = options;

  const requireAuth = () => {
    if (isLoading) return false;
    
    if (!user) {
      if (showToast) {
        toast.error(`Please sign in to use ${feature}`, {
          action: {
            label: 'Sign In',
            onClick: () => navigate(redirectTo)
          }
        });
      }
      return false;
    }
    
    return true;
  };

  const redirectIfNotAuthenticated = () => {
    if (!isLoading && !user) {
      navigate(redirectTo);
    }
  };

  return {
    isAuthenticated: !!user && !isLoading,
    isLoading,
    user,
    requireAuth,
    redirectIfNotAuthenticated
  };
};
