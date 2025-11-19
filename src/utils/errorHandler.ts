
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid credentials')) {
      return 'Invalid email or password';
    }
    if (message.includes('email already in use')) {
      return 'This email is already registered';
    }
    if (message.includes('invalid google token')) {
      return 'Google sign-in failed';
    }
    if (message.includes('session expired')) {
      return 'Session expired. Please sign in again';
    }
    if (message.includes('invalid refresh token')) {
      return 'Invalid session';
    }
    
    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Cannot connect to server. Please check your internet connection';
    }
    
    return error.message;
  }
  
  return 'An unknown error occurred';
};
