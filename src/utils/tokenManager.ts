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
    setCookie(ACCESS_TOKEN_KEY, token, {
      expires: ACCESS_TOKEN_EXPIRY_DAYS,
      secure: true,
      sameSite: 'Lax',
    });
  },

  getAccessToken(): string | null {
    return getCookie(ACCESS_TOKEN_KEY);
  },

  clearAccessToken(): void {
    deleteCookie(ACCESS_TOKEN_KEY);
  },

  setRefreshToken(token: string): void {
    setCookie(REFRESH_TOKEN_KEY, token, {
      expires: REFRESH_TOKEN_EXPIRY_DAYS,
      secure: true,
      sameSite: 'Lax',
    });
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
