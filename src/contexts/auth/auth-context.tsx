
import { createContext } from 'react';
import { AuthContextProps } from './types';

// Create the auth context with default values
export const AuthContext = createContext<AuthContextProps | undefined>(undefined);
