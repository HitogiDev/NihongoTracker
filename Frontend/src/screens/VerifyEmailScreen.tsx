import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useUserDataStore } from '../store/userData';
import { useQueryClient } from '@tanstack/react-query';

export default function VerifyEmailScreen() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const user = useUserDataStore((state) => state.user);
  const setUser = useUserDataStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    'verifying'
  );
  const [message, setMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (hasVerified.current) return; // Prevent duplicate calls
      hasVerified.current = true;

      try {
        const response = await axios.post(`/api/auth/verify-email`, { token });
        setStatus('success');
        setMessage(
          response.data.message || 'Your email has been successfully verified!'
        );

        // If user is logged in, update their state with verified email
        if (user && response.data.user) {
          setUser(response.data.user);
          // Invalidate queries to refresh data
          queryClient.invalidateQueries();
        }

        // Redirect after 3 seconds - to settings if logged in, login if not
        setTimeout(() => {
          navigate(user ? '/settings' : '/login');
        }, 3000);
      } catch (error) {
        setStatus('error');
        setMessage(
          (error as Error & { response?: { data?: { message?: string } } })
            .response?.data?.message ||
            'Verification failed. The link may be invalid or expired.'
        );
      }
    };

    if (token) {
      verifyEmail();
    } else {
      setStatus('error');
      setMessage('Invalid verification link.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          {status === 'verifying' && (
            <>
              <div className="loading loading-spinner loading-lg text-primary"></div>
              <h2 className="card-title mt-4">Verifying your email...</h2>
              <p className="text-base-content/60">Please wait a moment</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="relative w-24 h-24 mb-4">
                <div className="absolute inset-0 bg-success/20 rounded-full"></div>
                <svg
                  className="w-24 h-24 text-success"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="card-title text-success">Email Verified!</h2>
              <p className="text-base-content/80">{message}</p>
              <p className="text-sm text-base-content/60 mt-2">
                {user
                  ? 'Redirecting to settings...'
                  : 'Redirecting to login...'}
              </p>
              <div className="card-actions mt-4">
                <Link
                  to={user ? '/settings' : '/login'}
                  className="btn btn-primary"
                >
                  {user ? 'Go to Settings' : 'Go to Login'}
                </Link>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="relative w-24 h-24 mb-4">
                <div className="absolute inset-0 bg-error/20 rounded-full"></div>
                <svg
                  className="w-24 h-24 text-error"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="card-title text-error">Verification Failed</h2>
              <p className="text-base-content/80">{message}</p>
              <div className="card-actions mt-4 flex-col sm:flex-row gap-2">
                {user ? (
                  <>
                    <Link to="/settings" className="btn btn-primary">
                      Go to Settings
                    </Link>
                    <Link to="/" className="btn btn-outline">
                      Go to Home
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="btn btn-outline">
                      Register Again
                    </Link>
                    <Link to="/login" className="btn btn-primary">
                      Go to Login
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
