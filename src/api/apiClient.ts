import { cookieManager } from '../utils/tokenManager';
import { toast } from 'sonner';
import type { ApiError } from '../types/auth';

interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
  isRetry?: boolean;
}

class ApiClient {
  private baseURL: string;
  private refreshPromise: Promise<string> | null = null;

  constructor(baseURL: string = import.meta.env.VITE_API_BASE_URL|| 'http://localhost:8080') {
    this.baseURL = baseURL;
  }

  /**
   * Main request method with automatic token injection and refresh
   */
  async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { skipAuth = false, isRetry = false, ...fetchConfig } = config;

    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!skipAuth) {
      const accessToken = cookieManager.getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    if (fetchConfig.headers) {
      Object.assign(headers, fetchConfig.headers);
    }

    try {
      const response = await fetch(url, {
        ...fetchConfig,
        headers,
      });

      // Handle 401 Unauthorized - Token expired
      if (response.status === 401 && !skipAuth && !isRetry) {
        const newAccessToken = await this.refreshAccessToken();
        
        if (newAccessToken) {
          cookieManager.setAccessToken(newAccessToken);
          return this.request<T>(endpoint, { ...config, isRetry: true });
        } else {
          this.handleAuthFailure();
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          message: `HTTP error! status: ${response.status}`,
        }));
        throw new Error(error.message || 'Request failed');
      }

      if (response.status === 204) {
        return {} as T;
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * Handles concurrent refresh requests (only one refresh at a time)
   */
  private async refreshAccessToken(): Promise<string | null> {
    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = cookieManager.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    // Create a new refresh promise
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseURL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        return data.accessToken;
      } catch (error) {
        console.error('Token refresh error:', error);
        return null;
      } finally {
        // Clear the refresh promise
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Handle authentication failure by clearing tokens and redirecting
   */
  private handleAuthFailure(): void {
    cookieManager.clearAllTokens();
    
    window.dispatchEvent(new CustomEvent('auth:logout'));
    
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  // Convenience methods
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
