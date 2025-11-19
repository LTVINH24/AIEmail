import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Mail, Lock, Loader2, UserPlus } from 'lucide-react';
import type { RegisterCredentials } from '../../types/auth';

interface RegisterFormData extends RegisterCredentials {
  confirmPassword: string;
}

interface RegisterFormProps {
  onSubmit: (data: RegisterCredentials) => Promise<void>;
  isLoading?: boolean;
}

/**
 * RegisterForm Component
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    mode: 'onBlur',
  });

  const isFormDisabled = isSubmitting || isLoading;

  const handleFormSubmit = async (data: RegisterFormData) => {
    const { email, password } = data;
    await onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Email Field */}
      <div>
        <Label htmlFor="email">Email</Label>
        <div className="relative mt-1">
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email address',
              },
            })}
            className={errors.email ? 'border-red-500' : ''}
            disabled={isFormDisabled}
            autoComplete="email"
          />
          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <Label htmlFor="password">Password</Label>
        <div className="relative mt-1">
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters',
              },
            })}
            className={errors.password ? 'border-red-500' : ''}
            disabled={isFormDisabled}
            autoComplete="new-password"
          />
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm Password Field */}
      <div>
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative mt-1">
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) =>
                value === getValues('password') || 'Passwords do not match',
            })}
            className={errors.confirmPassword ? 'border-red-500' : ''}
            disabled={isFormDisabled}
            autoComplete="new-password"
          />
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-600">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isFormDisabled}>
        {isSubmitting || isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Account...
          </>
        ) : (
          <>
            <UserPlus className="mr-2 h-4 w-4" />
            Create Account
          </>
        )}
      </Button>
    </form>
  );
};
