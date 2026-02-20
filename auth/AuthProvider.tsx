import React, { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { ClerkProvider, useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { clerkPubKey, isClerkAuthEnabled } from './authConfig';
import { trackEvent } from '../utils/analytics';

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

const SIGNUP_FRESHNESS_WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_TRACKED_STORAGE_KEY_PREFIX = 'moodboard_signup_tracked_';

const AuthContextProvider: React.FC<AuthContextProviderProps> = ({ children, onShowSignIn }) => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut, getToken } = useClerkAuth();
  const wasSignedInRef = useRef(false);
  const hasInitializedAuthStateRef = useRef(false);

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

  useEffect(() => {
    if (!isLoaded) return;
    const currentlySignedIn = Boolean(isSignedIn);
    if (!hasInitializedAuthStateRef.current) {
      hasInitializedAuthStateRef.current = true;
      wasSignedInRef.current = currentlySignedIn;
      return;
    }
    const justSignedIn = currentlySignedIn && !wasSignedInRef.current;
    wasSignedInRef.current = currentlySignedIn;
    if (!justSignedIn || !user) return;

    trackEvent('login', { method: 'clerk' });

    const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : NaN;
    if (!Number.isFinite(createdAt)) return;
    if (Math.abs(Date.now() - createdAt) > SIGNUP_FRESHNESS_WINDOW_MS) return;

    let shouldTrackSignUp = true;
    if (typeof window !== 'undefined') {
      const storageKey = `${SIGNUP_TRACKED_STORAGE_KEY_PREFIX}${user.id}`;
      try {
        if (window.localStorage.getItem(storageKey)) {
          shouldTrackSignUp = false;
        } else {
          window.localStorage.setItem(storageKey, '1');
        }
      } catch {
        // Continue without local storage dedupe when storage is unavailable.
      }
    }
    if (shouldTrackSignUp) {
      trackEvent('sign_up', { method: 'clerk' });
    }
  }, [isLoaded, isSignedIn, user]);

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

  if (!isClerkAuthEnabled) {
    // Return children without auth when Clerk is not configured or bypass is enabled
    return (
      <AuthContext.Provider
        value={{
          user: null,
          isAuthenticated: false,
          isLoading: false,
          login: () => console.warn('Authentication unavailable in this environment'),
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
