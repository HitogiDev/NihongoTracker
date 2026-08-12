import React, { useEffect, useState } from 'react';
import Field from '../components/ui/Field';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPasswordFn } from '../api/trackerApi';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, TriangleAlert, CircleCheck } from 'lucide-react';
import type { ValidationKey } from '../utils/validation';
import { useValidationText } from '../hooks/useValidationText';
import { getApiErrorMessage } from '../utils/apiError';

function ResetPasswordScreen() {
  const { t } = useTranslation('auth');
  const vt = useValidationText();
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [touched, setTouched] = useState({
    password: false,
    passwordConfirmation: false,
  });
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Validate fields when touched
  useEffect(() => {
    const newErrors: Record<string, ValidationKey> = {};

    if (touched.password) {
      if (!password) {
        newErrors.password = 'password.required';
      } else if (password.length < 8) {
        newErrors.password = 'password.minLength';
      }
    }

    if (touched.passwordConfirmation) {
      if (!passwordConfirmation) {
        newErrors.passwordConfirmation = 'password.confirmRequired';
      } else if (password !== passwordConfirmation) {
        newErrors.passwordConfirmation = 'password.mismatch';
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
      toast.success(t('resetPassword.toast.success'));
      setTimeout(() => navigate('/login'), 2000);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
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
        <div className="card w-full max-w-md surface">
          <div className="card-body text-center">
            <TriangleAlert className="w-16 h-16 mx-auto mb-4 text-warning" />
            <h2 className="card-title justify-center text-2xl mb-4">
              {t('resetPassword.invalidToken.title')}
            </h2>
            <p className="text-base-content/70 mb-6">
              {t('resetPassword.invalidToken.description')}
            </p>
            <div className="card-actions justify-center">
              <Link to="/forgot-password" className="btn btn-primary">
                {t('resetPassword.invalidToken.action')}
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
        <div className="card w-full max-w-md surface">
          <div className="card-body text-center">
            <CircleCheck className="w-16 h-16 mx-auto mb-4 text-success" />
            <h2 className="card-title justify-center text-2xl mb-4">
              {t('resetPassword.success.title')}
            </h2>
            <p className="text-base-content/70 mb-6">
              {t('resetPassword.success.description')}
            </p>
            <div className="card-actions justify-center">
              <Link to="/login" className="btn btn-primary">
                {t('resetPassword.success.action')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="card w-full max-w-md surface">
        <div className="card-body">
          <h2 className="card-title justify-center text-2xl mb-6">
            {t('resetPassword.title')}
          </h2>
          <p className="text-base-content/70 mb-6 text-center">
            {t('resetPassword.description')}
          </p>

          <form onSubmit={handleSubmit}>
            <Field
              label={t('resetPassword.password.label')}
              className="w-full mb-4"
            >
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('resetPassword.password.placeholder')}
                  className={`input w-full pr-12 ${
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
                  <span className="text-error">{vt(errors.password)}</span>
                </label>
              )}
            </Field>

            <Field
              label={t('resetPassword.passwordConfirmation.label')}
              className="w-full mb-4"
            >
              <div className="relative">
                <input
                  type={showPasswordConfirmation ? 'text' : 'password'}
                  placeholder={t(
                    'resetPassword.passwordConfirmation.placeholder'
                  )}
                  className={`input w-full pr-12 ${
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
                  <span className="text-error">
                    {vt(errors.passwordConfirmation)}
                  </span>
                </label>
              )}
            </Field>

            <div className="mt-6 items-center">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!isFormValid || isPending}
              >
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  t('resetPassword.submit')
                )}
              </button>
            </div>
          </form>

          <div className="divider">{t('resetPassword.or')}</div>

          <div className="text-center">
            <span className="text-base-content/70">
              {t('resetPassword.rememberPassword')}{' '}
            </span>
            <Link to="/login" className="link link-primary">
              {t('resetPassword.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordScreen;
