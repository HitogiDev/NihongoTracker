import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordFn } from '../api/trackerApi';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';

function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState({ email: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate email when touched
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (touched.email) {
      if (!email) {
        newErrors.email = 'Email is required';
      } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
  }, [email, touched]);

  const isFormValid = email.trim().length > 0 && !errors.email;

  const handleFieldChange = (value: string) => {
    setTouched((prev) => ({ ...prev, email: true }));
    setEmail(value);
  };

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: forgotPasswordFn,
    onSuccess: () => {
      toast.success('Password reset instructions sent to your email');
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ message: string }>;
      toast.error(
        axiosError.response?.data?.message || 'Failed to send reset email'
      );
    },
  });

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormValid) {
      mutate(email);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="text-6xl mb-4">📧</div>
            <h2 className="card-title justify-center text-2xl mb-4">
              Check Your Email
            </h2>
            <p className="text-base-content/70 mb-6">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
            <p className="text-sm text-base-content/60 mb-6">
              If you don't see the email, check your spam folder or try again.
            </p>
            <div className="card-actions justify-center">
              <Link to="/login" className="btn btn-primary">
                Back to Login
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
            Forgot Password
          </h2>
          <p className="text-base-content/70 mb-6 text-center">
            Enter your email address and we'll send you instructions to reset
            your password.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-control w-full mb-4">
              <label className="label justify-center">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                className={`input input-bordered w-full ${
                  errors.email ? 'input-error' : ''
                }`}
                value={email}
                onChange={(e) => handleFieldChange(e.target.value)}
                disabled={isPending}
              />
              {errors.email && (
                <label className="label justify-center">
                  <span className="label-text-alt text-error">
                    {errors.email}
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
                  'Send Reset Instructions'
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

export default ForgotPasswordScreen;
