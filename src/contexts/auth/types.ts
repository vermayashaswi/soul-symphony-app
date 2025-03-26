
import { User, Session } from '@supabase/supabase-js';

export interface AuthContextProps {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata?: { [key: string]: any }) => Promise<{ error: any, data: any }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

export interface AuthContextProviderProps {
  children: React.ReactNode;
}
