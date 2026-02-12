import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPasswordFn } from '../api/trackerApi';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { Eye, EyeOff } from 'lucide-react';

function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [touched, setTouched] = useState({
    password: false,
    passwordConfirmation: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Validate fields when touched
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (touched.password) {
      if (!password) {
        newErrors.password = 'Password is required';
      } else if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
    }

    if (touched.passwordConfirmation) {
      if (!passwordConfirmation) {
        newErrors.passwordConfirmation = 'Password confirmation is required';
      } else if (password !== passwordConfirmation) {
        newErrors.passwordConfirmation = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
  }, [password, passwordConfirmation, touched]);

  const isFormValid =
    password.length >= 8 &&
    passwordConfirmation.length > 0 &&
    password === passwordConfirmation &&
    Object.keys(errors).length === 0;

  const handleFieldChange = (
    field: 'password' | 'passwordConfirmation',
    value: string
  ) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field === 'password') setPassword(value);
    if (field === 'passwordConfirmation') setPasswordConfirmation(value);
  };

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: ({
      token,
      password,
      passwordConfirmation,
    }: {
      token: string;
      password: string;
      passwordConfirmation: string;
    }) => resetPasswordFn(token, password, passwordConfirmation),
    onSuccess: () => {
      toast.success('Password reset successfully');
      setTimeout(() => navigate('/login'), 2000);
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ message: string }>;
      toast.error(
        axiosError.response?.data?.message || 'Failed to reset password'
      );
    },
  });

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormValid && token) {
      mutate({ token, password, passwordConfirmation });
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="card-title justify-center text-2xl mb-4">
              Invalid Reset Link
            </h2>
            <p className="text-base-content/70 mb-6">
              This password reset link is invalid or has expired.
            </p>
            <div className="card-actions justify-center">
              <Link to="/forgot-password" className="btn btn-primary">
                Request New Reset Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="card-title justify-center text-2xl mb-4">
              Password Reset Successfully
            </h2>
            <p className="text-base-content/70 mb-6">
              Your password has been updated. You will be redirected to the
              login page.
            </p>
            <div className="card-actions justify-center">
              <Link to="/login" className="btn btn-primary">
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title justify-center text-2xl mb-6">
            Reset Password
          </h2>
          <p className="text-base-content/70 mb-6 text-center">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">New Password</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  className={`input input-bordered w-full pr-12 ${
                    errors.password ? 'input-error' : ''
                  }`}
                  value={password}
                  onChange={(e) =>
                    handleFieldChange('password', e.target.value)
                  }
                  disabled={isPending}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/60 hover:text-base-content"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isPending}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.password}
                  </span>
                </label>
              )}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Confirm New Password</span>
              </label>
              <div className="relative">
                <input
                  type={showPasswordConfirmation ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  className={`input input-bordered w-full pr-12 ${
                    errors.passwordConfirmation ? 'input-error' : ''
                  }`}
                  value={passwordConfirmation}
                  onChange={(e) =>
                    handleFieldChange('passwordConfirmation', e.target.value)
                  }
                  disabled={isPending}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/60 hover:text-base-content"
                  onClick={() =>
                    setShowPasswordConfirmation(!showPasswordConfirmation)
                  }
                  disabled={isPending}
                >
                  {showPasswordConfirmation ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.passwordConfirmation && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.passwordConfirmation}
                  </span>
                </label>
              )}
            </div>

            <div className="form-control mt-6 items-center">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!isFormValid || isPending}
              >
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Reset Password'
                )}
              </button>
            </div>
          </form>

          <div className="divider">OR</div>

          <div className="text-center">
            <span className="text-base-content/70">
              Remember your password?{' '}
            </span>
            <Link to="/login" className="link link-primary">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordScreen;
