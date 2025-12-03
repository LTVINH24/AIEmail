import React, { createContext, useState, useEffect, useCallback } from 'react';
import { cookieManager } from '../utils/tokenManager';
import { authService } from '../services/authService';
import type {
  AuthState,
  LoginCredentials,
  RegisterCredentials,
} from '../types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  redirectToGoogle: (state?: string) => void;
  handleGoogleCallback: (code: string, state?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setAuthState: (accessToken: string, refreshToken: string, email: string) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  /**
   * Initialize auth state on mount
   * Check if user has a valid refresh token and try to restore session
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const refreshToken = cookieManager.getRefreshToken();
        const accessToken = cookieManager.getAccessToken();
        
        if (!refreshToken && !accessToken) {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
          return;
        }

        if (accessToken) {
          try {
            // For Google auth, we need the email. Try to get it from the token payload
            const user = authService.getUserFromToken(accessToken);
            setState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return;
          } catch (error) {
            console.log('Access token invalid or decode failed:', error);
            // Clear invalid access token
            cookieManager.clearAccessToken();
          }
        }

        if (refreshToken) {
          const response = await authService.refreshToken(refreshToken);
          cookieManager.setTokens(response.accessToken, response.refreshToken);

          const user = authService.getUserFromToken(response.accessToken, response.email);
          
          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        cookieManager.clearAllTokens();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const handleLogoutEvent = () => {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired. Please log in again.',
      });
    };

    window.addEventListener('auth:logout', handleLogoutEvent);
    return () => window.removeEventListener('auth:logout', handleLogoutEvent);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authService.login(credentials);
      cookieManager.setTokens(response.accessToken, response.refreshToken);

      const user = authService.getUserFromToken(response.accessToken, response.email);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authService.register(credentials);
      cookieManager.setTokens(response.accessToken, response.refreshToken);

      const user = authService.getUserFromToken(response.accessToken, response.email);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const redirectToGoogle = useCallback((state?: string) => {
    const authUrl = authService.getGoogleAuthUrl(state);
    window.location.href = authUrl;
  }, []);

  const handleGoogleCallback = useCallback(async (code: string, state?: string) => {
    console.log('AuthContext - handleGoogleCallback started', { code: !!code, state });
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('AuthContext - Calling authService.handleGoogleCallback');
      const response = await authService.handleGoogleCallback(code, state);
      console.log('AuthContext - Got response:', {
        hasAccessToken: !!response.accessToken,
        hasRefreshToken: !!response.refreshToken,
        email: response.email
      });

      console.log('AuthContext - Setting tokens in cookies');
      cookieManager.setTokens(response.accessToken, response.refreshToken);

      console.log('AuthContext - Creating user from token');
      const user = authService.getUserFromToken(response.accessToken, response.email);
      console.log('AuthContext - User created:', user);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      console.log('AuthContext - State updated successfully');
    } catch (error) {
      console.error('AuthContext - handleGoogleCallback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Google login failed';
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    cookieManager.clearAllTokens();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    try {
      const refreshToken = cookieManager.getRefreshToken();
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const accessToken = cookieManager.getAccessToken();
      if (accessToken) {
        // Try to get email from existing user state first, then decode token
        const existingEmail = state.user?.email;
        const user = authService.getUserFromToken(accessToken, existingEmail);
        setState(prev => ({ ...prev, user, isAuthenticated: true }));
      }
    } catch (error) {
      console.error('Failed to refresh auth:', error);
    }
  }, [state.user?.email]);

  const setAuthState = useCallback((accessToken: string, refreshToken: string, email: string) => {
    try {
      cookieManager.setTokens(accessToken, refreshToken);
      const user = authService.getUserFromToken(accessToken, email);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to set auth state:', error);
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to authenticate user',
      });
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    redirectToGoogle,
    handleGoogleCallback,
    logout,
    refreshAuth,
    setAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
