
import { useContext } from 'react';
import { AuthContext } from './auth-context';
import { AuthProvider } from './auth-provider';
import { AuthContextProps } from './types';

// Custom hook to use the auth context
export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthProvider, AuthContext };
export type { AuthContextProps };
