
// This file is kept for backward compatibility
// It imports from the refactored auth context modules
import { AuthProvider, useAuth, AuthContext, AuthContextProps } from './auth';

export { AuthProvider, useAuth, AuthContext };
export type { AuthContextProps };

export default { AuthProvider, useAuth };
