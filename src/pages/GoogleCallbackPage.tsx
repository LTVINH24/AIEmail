import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/card';
import { Loader2, Mail } from 'lucide-react';
import { getErrorMessage } from '../utils/errorHandler';

export const GoogleCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleGoogleCallback, isAuthenticated } = useAuth();

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      console.log('GoogleCallback - Processing callback:', { code: !!code, state, error });

      // Handle OAuth errors
      if (error) {
        toast.error(`Google authentication failed: ${error}`);
        navigate('/login', { replace: true });
        return;
      }

      // Handle missing authorization code
      if (!code) {
        toast.error('No authorization code received from Google');
        navigate('/login', { replace: true });
        return;
      }

      try {
        console.log('GoogleCallback - Calling handleGoogleCallback');
        // Process the Google OAuth callback
        await handleGoogleCallback(code, state || undefined);
        console.log('GoogleCallback - handleGoogleCallback successful');
        
        // Add a small delay to ensure auth state is fully updated
        await new Promise(resolve => setTimeout(resolve, 200));
        
        toast.success('Google sign-in successful!');
        
        console.log('GoogleCallback - Navigating to inbox');
        navigate('/inbox', { replace: true });
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        toast.error(getErrorMessage(error));
        navigate('/login', { replace: true });
      }
    };

    processCallback();
  }, [searchParams, handleGoogleCallback, navigate]);



  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Completing Google Sign-in...
          </h1>
          <p className="text-gray-600">
            Please wait while we complete your authentication with Google.
          </p>
        </div>
      </Card>
    </div>
  );
};