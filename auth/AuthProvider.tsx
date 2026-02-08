import React, { createContext, useContext, ReactNode } from 'react';
import { ClerkProvider, useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { clerkPubKey } from './authConfig';

export interface AuthContextType {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    imageUrl: string | null;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthContextProviderProps {
  children: ReactNode;
  onShowSignIn: () => void;
}

const AuthContextProvider: React.FC<AuthContextProviderProps> = ({ children, onShowSignIn }) => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut, getToken } = useClerkAuth();

  const authUser = user ? {
    id: user.id,
    name: user.fullName || user.firstName || null,
    email: user.primaryEmailAddress?.emailAddress || null,
    imageUrl: user.imageUrl || null,
  } : null;

  const login = () => {
    onShowSignIn();
  };

  const logout = async () => {
    await signOut();
  };

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const token = await getToken();
      return token;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        isAuthenticated: isSignedIn || false,
        isLoading: !isLoaded,
        login,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

interface AuthProviderProps {
  children: ReactNode;
  onShowSignIn?: () => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onShowSignIn }) => {
  const defaultShowSignIn = () => {
    console.warn('Sign in requested but no handler provided');
  };

  if (!clerkPubKey) {
    // Return children without auth if no key configured
    return (
      <AuthContext.Provider
        value={{
          user: null,
          isAuthenticated: false,
          isLoading: false,
          login: () => console.warn('Clerk not configured - add VITE_CLERK_PUBLISHABLE_KEY to .env.local'),
          logout: async () => {},
          getAccessToken: async () => null,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <AuthContextProvider onShowSignIn={onShowSignIn || defaultShowSignIn}>
        {children}
      </AuthContextProvider>
    </ClerkProvider>
  );
};

export default AuthProvider;
