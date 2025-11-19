import React, { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { RegisterForm } from '../components/auth/RegisterForm';
import { Card } from '../components/ui/card';
import { UserPlus } from 'lucide-react';
import { getErrorMessage } from '../utils/errorHandler';
import type { RegisterCredentials } from '../types/auth';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register: registerUser, isAuthenticated, error: authError } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/inbox';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleRegister = async (data: RegisterCredentials) => {
    try {
      await registerUser(data);
      toast.success('Account created successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <UserPlus className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Account</h1>
          <p className="text-gray-600 mt-2">Sign up to start using AIEmail</p>
        </div>

        {/* Registration Form Component */}
        <RegisterForm 
          onSubmit={handleRegister}
        />

        {/* Link to Login Page */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500 hover:underline"
            >
              Sign in now
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};
