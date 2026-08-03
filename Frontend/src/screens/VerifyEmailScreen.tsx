import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useUserDataStore } from '../store/userData';
import { useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '../utils/apiError';

export default function VerifyEmailScreen() {
  const { t } = useTranslation('auth');
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
        setMessage(response.data.message || t('verifyEmail.success.message'));

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
        setMessage(getApiErrorMessage(error, 'auth.invalidVerificationToken'));
      }
    };

    if (token) {
      verifyEmail();
    } else {
      setStatus('error');
      setMessage(t('verifyEmail.error.invalidLink'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-sm">
        <div className="card-body items-center text-center">
          {status === 'verifying' && (
            <>
              <div className="loading loading-spinner loading-lg text-primary"></div>
              <h2 className="card-title mt-4">
                {t('verifyEmail.verifying.title')}
              </h2>
              <p className="text-base-content/60">
                {t('verifyEmail.verifying.description')}
              </p>
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
              <h2 className="card-title text-success">
                {t('verifyEmail.success.title')}
              </h2>
              <p className="text-base-content/80">{message}</p>
              <p className="text-sm text-base-content/60 mt-2">
                {user
                  ? t('verifyEmail.success.redirectingToSettings')
                  : t('verifyEmail.success.redirectingToLogin')}
              </p>
              <div className="card-actions mt-4">
                <Link
                  to={user ? '/settings' : '/login'}
                  className="btn btn-primary"
                >
                  {user
                    ? t('verifyEmail.actions.settings')
                    : t('verifyEmail.actions.login')}
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
              <h2 className="card-title text-error">
                {t('verifyEmail.error.title')}
              </h2>
              <p className="text-base-content/80">{message}</p>
              <div className="card-actions mt-4 flex-col sm:flex-row gap-2">
                {user ? (
                  <>
                    <Link to="/settings" className="btn btn-primary">
                      {t('verifyEmail.actions.settings')}
                    </Link>
                    <Link to="/" className="btn btn-outline">
                      {t('verifyEmail.actions.home')}
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="btn btn-outline">
                      {t('verifyEmail.actions.register')}
                    </Link>
                    <Link to="/login" className="btn btn-primary">
                      {t('verifyEmail.actions.login')}
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
