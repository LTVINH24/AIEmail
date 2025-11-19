import { apiClient } from '../api/apiClient';
import type {
  LoginCredentials,
  RegisterCredentials,
  GoogleAuthCredentials,
  AuthResponse,
  RefreshTokenResponse,
  User,
} from '../types/auth';

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', credentials, { skipAuth: true });
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', credentials, { skipAuth: true });
  }

  async loginWithGoogle(credentials: GoogleAuthCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/google', credentials, { skipAuth: true });
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    return apiClient.post<RefreshTokenResponse>('/auth/refresh', { refreshToken }, { skipAuth: true });
  }

  async logout(refreshToken: string): Promise<void> {
    return apiClient.post<void>('/auth/logout', { refreshToken }, { skipAuth: true });
  }

  getUserFromToken(token: string, email?: string): User {
    try {
      // Decode JWT token (simple decode without verification - verification happens on backend)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      const payload = JSON.parse(jsonPayload);
      
      const userEmail = email || payload.sub || payload.email || 'unknown@example.com';
      
      return {
        id: payload.sub || payload.userId || 'unknown',
        email: userEmail,
        name: userEmail.split('@')[0],
        provider: (payload.provider as 'email' | 'google') || 'email',
      };
    } catch (error) {
      console.error('Failed to decode token:', error);
      throw new Error('Invalid token');
    }
  }
}

export const authService = new AuthService();
