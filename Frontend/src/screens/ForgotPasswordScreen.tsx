import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordFn } from '../api/trackerApi';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import type { ValidationKey } from '../utils/validation';
import { useValidationText } from '../hooks/useValidationText';
import { getApiErrorMessage } from '../utils/apiError';

function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const vt = useValidationText();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState({ email: false });
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});

  // Validate email when touched
  useEffect(() => {
    const newErrors: Record<string, ValidationKey> = {};

    if (touched.email) {
      if (!email) {
        newErrors.email = 'email.required';
      } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        newErrors.email = 'email.invalid';
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
      toast.success(t('forgotPassword.toast.success'));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
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
        <div className="card w-full max-w-md bg-base-100 shadow-sm">
          <div className="card-body text-center">
            <div className="text-6xl mb-4">📧</div>
            <h2 className="card-title justify-center text-2xl mb-4">
              {t('forgotPassword.sent.title')}
            </h2>
            <p className="text-base-content/70 mb-6">
              <Trans
                t={t}
                i18nKey="forgotPassword.sent.description"
                values={{ email }}
                components={{ strong: <strong /> }}
              />
            </p>
            <p className="text-sm text-base-content/60 mb-6">
              {t('forgotPassword.sent.spamHint')}
            </p>
            <div className="card-actions justify-center">
              <Link to="/login" className="btn btn-primary">
                {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title justify-center text-2xl mb-6">
            {t('forgotPassword.title')}
          </h2>
          <p className="text-base-content/70 mb-6 text-center">
            {t('forgotPassword.description')}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-control w-full mb-4">
              <label className="label justify-center">
                <span className="label-text">
                  {t('forgotPassword.email.label')}
                </span>
              </label>
              <input
                type="email"
                placeholder={t('forgotPassword.email.placeholder')}
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
                    {vt(errors.email)}
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
                  t('forgotPassword.submit')
                )}
              </button>
            </div>
          </form>

          <div className="divider">{t('forgotPassword.or')}</div>

          <div className="text-center">
            <span className="text-base-content/70">
              {t('forgotPassword.rememberPassword')}{' '}
            </span>
            <Link to="/login" className="link link-primary">
              {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordScreen;
