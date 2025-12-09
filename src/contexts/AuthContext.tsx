import React, { createContext, useState, useEffect, useCallback } from 'react';
import { cookieManager } from '../utils/tokenManager';
import { authService } from '../services/authService';
import type {
  AuthState,
  LoginCredentials,
  RegisterCredentials,
  GoogleAuthCredentials,
} from '../types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  loginWithGoogle: (credentials: GoogleAuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
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
        
        if (!refreshToken) {
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Try to refresh access token
        const response = await authService.refreshToken(refreshToken);
        cookieManager.setTokens(response.accessToken, response.refreshToken);

        const user = authService.getUserFromToken(response.accessToken, response.email);
        
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
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

  const loginWithGoogle = useCallback(async (credentials: GoogleAuthCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authService.loginWithGoogle(credentials);
      cookieManager.setTokens(response.accessToken, response.refreshToken);

      const user = authService.getUserFromToken(response.accessToken, response.email);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
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
        const user = authService.getUserFromToken(accessToken);
        setState(prev => ({ ...prev, user }));
      }
    } catch (error) {
      console.error('Failed to refresh auth:', error);
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    loginWithGoogle,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
