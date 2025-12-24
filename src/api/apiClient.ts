import { cookieManager } from '../utils/tokenManager';
import type { ApiError } from '../types/auth';

interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
  isRetry?: boolean;
}

class ApiClient {
  private baseURL: string;
  private refreshPromise: Promise<string> | null = null;

  constructor(baseURL: string = import.meta.env.VITE_API_BASE_URL|| 'https://aimail-be-3.onrender.com') {
    this.baseURL = baseURL;
  }

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
        console.log('API Request - Authorization header set with token from:', accessToken.substring(0, 30) + '...');
      } else {
        console.log('API Request - No access token found');
      }
    }

    if (fetchConfig.headers) {
      Object.assign(headers, fetchConfig.headers);
    }

    try {
      console.log(`API Request - ${fetchConfig.method || 'GET'} ${url}`);
      console.log('API Request - Headers:', headers);
      if (fetchConfig.body) {
        console.log('API Request - Body:', fetchConfig.body);
      }
      
      const response = await fetch(url, {
        ...fetchConfig,
        headers,
      });

      console.log(`API Response - Status: ${response.status}`);
      console.log('API Response - Headers:', Object.fromEntries(response.headers.entries()));
      console.log('API Response - URL after redirects:', response.url);

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
        console.error(`API Response Error - Status: ${response.status}`);
        try {
          const errorBody = await response.text();
          console.error('API Response Error Body:', errorBody);
        } catch (e) {
          console.error('Could not read error response body');
        }
        
        const error: ApiError = await response.json().catch(() => ({
          message: `HTTP error! status: ${response.status}`,
        }));
        throw new Error(error.message || 'Request failed');
      }

      if (response.status === 204) {
        return {} as T;
      }

      const contentType = response.headers.get('content-type');
      console.log('API Response - Content-Type:', contentType);
      
      if (response.status === 204) {
        return {} as T;
      }
      
      if (contentType && contentType.includes('application/json')) {
        const jsonResponse = await response.json();
        console.log('API Response - JSON Body:', jsonResponse);
        return jsonResponse;
      } else {
        const text = await response.text();
        console.log('API Response - Text Body:', text);
        
        // Try to parse as JSON even if content-type is not set correctly
        try {
          const jsonResponse = JSON.parse(text);
          console.log('API Response - Parsed JSON from text:', jsonResponse);
          return jsonResponse;
        } catch (e) {
          console.log('API Response - Could not parse as JSON, returning as text');
          return (text || {}) as T;
        }
      }
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = cookieManager.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

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
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private handleAuthFailure(): void {
    cookieManager.clearAllTokens();
    
    window.dispatchEvent(new CustomEvent('auth:logout'));
    
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

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
