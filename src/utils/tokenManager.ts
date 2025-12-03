/**
 * Cookie Manager
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Default expiry time (in days)
const ACCESS_TOKEN_EXPIRY_DAYS = 1; // 1 day
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

interface CookieOptions {
  expires?: number; 
  path?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  const {
    expires = 1,
    path = '/',
    secure = window.location.protocol === 'https:',
    sameSite = 'Lax',
  } = options;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  
  if (expires) {
    const expiryDate = new Date();
    expiryDate.setTime(expiryDate.getTime() + expires * 24 * 60 * 60 * 1000);
    cookieString += `; expires=${expiryDate.toUTCString()}`;
  }
  
  cookieString += `; path=${path}`;
  
  if (secure) {
    cookieString += '; secure';
  }
  
  cookieString += `; SameSite=${sameSite}`;
  
  document.cookie = cookieString;
}

function getCookie(name: string): string | null {
  const nameEQ = encodeURIComponent(name) + '=';
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  
  return null;
}

function deleteCookie(name: string, path: string = '/'): void {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
}

export const cookieManager = {
  setAccessToken(token: string): void {
    try {
      setCookie(ACCESS_TOKEN_KEY, token, {
        expires: ACCESS_TOKEN_EXPIRY_DAYS,
        secure: false, // Set to false for localhost development
        sameSite: 'Lax',
      });
      console.log('Access token set successfully:', `${token.substring(0, 20)}...`);
      
      // Verify token was set
      const verifyToken = this.getAccessToken();
      if (!verifyToken) {
        console.error('Failed to set access token - token not found after setting');
      } else {
        console.log('Access token verified in cookies');
      }
    } catch (error) {
      console.error('Error setting access token:', error);
    }
  },

  getAccessToken(): string | null {
    const token = getCookie(ACCESS_TOKEN_KEY);
    console.log('Getting access token:', token ? `${token.substring(0, 20)}...` : 'null');
    
    // Debug: Decode JWT payload to see what's inside
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('Token payload:', payload);
          console.log('Token exp:', payload.exp ? new Date(payload.exp * 1000) : 'No exp');
          console.log('Token iss:', payload.iss);
          console.log('Token aud:', payload.aud);
        }
      } catch (e) {
        console.log('Failed to decode token:', e);
      }
    }
    
    return token;
  },

  clearAccessToken(): void {
    deleteCookie(ACCESS_TOKEN_KEY);
  },

  setRefreshToken(token: string): void {
    try {
      setCookie(REFRESH_TOKEN_KEY, token, {
        expires: REFRESH_TOKEN_EXPIRY_DAYS,
        secure: false, // Set to false for localhost development
        sameSite: 'Lax',
      });
      console.log('Refresh token set successfully:', `${token.substring(0, 20)}...`);
      
      // Verify token was set
      const verifyToken = this.getRefreshToken();
      if (!verifyToken) {
        console.error('Failed to set refresh token - token not found after setting');
      } else {
        console.log('Refresh token verified in cookies');
      }
    } catch (error) {
      console.error('Error setting refresh token:', error);
    }
  },

  getRefreshToken(): string | null {
    return getCookie(REFRESH_TOKEN_KEY);
  },

  clearRefreshToken(): void {
    deleteCookie(REFRESH_TOKEN_KEY);
  },

  setTokens(accessToken: string, refreshToken: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  },

  clearAllTokens(): void {
    this.clearAccessToken();
    this.clearRefreshToken();
  },

  hasRefreshToken(): boolean {
    return !!this.getRefreshToken();
  },

  hasAccessToken(): boolean {
    return !!this.getAccessToken();
  },
};
