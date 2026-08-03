import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUserFn, getPublicStatsFn } from '../api/trackerApi';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ILoginResponse } from '../types';
import { useUserDataStore } from '../store/userData';
import { toast } from 'react-toastify';
import Loader from '../components/Loader';
import { validateLogin } from '../utils/validation';
import { gsap } from 'gsap';
import { Trans, useTranslation } from 'react-i18next';
import type { ValidationKey } from '../utils/validation';
import { useValidationText } from '../hooks/useValidationText';
import { useDateFormatting } from '../hooks/useDateFormatting';
import { getLearnerCountKey } from '../utils/learnerCount';
import { getApiErrorMessage } from '../utils/apiError';

function LoginScreen() {
  const { t } = useTranslation('auth');
  const vt = useValidationText();
  const { formatNumber } = useDateFormatting();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ login: false, password: false });
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const { setUser } = useUserDataStore();
  const navigate = useNavigate();

  // Refs for GSAP animations
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formFieldsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Fetch public stats
  const { data: stats } = useQuery({
    queryKey: ['publicStats'],
    queryFn: getPublicStatsFn,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Compact notation gives "1.2K" in English and "1,2 mil" in Spanish.
  const formatCompact = (num: number): string =>
    formatNumber(num, { notation: 'compact', maximumFractionDigits: 1 });

  const addToRefs = (el: HTMLDivElement | null) => {
    if (el && !formFieldsRef.current.includes(el)) {
      formFieldsRef.current.push(el);
    }
  };

  // GSAP entrance animation
  useEffect(() => {
    const tl = gsap.timeline();

    // Set initial states
    gsap.set(cardRef.current, { y: 30, opacity: 0, scale: 0.95 });
    gsap.set(titleRef.current, { y: 20, opacity: 0 });
    gsap.set(formFieldsRef.current, { y: 20, opacity: 0 });

    tl.to(cardRef.current, {
      duration: 0.6,
      y: 0,
      opacity: 1,
      scale: 1,
      ease: 'power3.out',
    })
      .to(
        titleRef.current,
        {
          duration: 0.5,
          y: 0,
          opacity: 1,
          ease: 'power2.out',
        },
        '-=0.3'
      )
      .to(
        formFieldsRef.current,
        {
          duration: 0.4,
          y: 0,
          opacity: 1,
          stagger: 0.1,
          ease: 'power2.out',
        },
        '-=0.3'
      );
  }, []);

  // Validate fields when touched
  useEffect(() => {
    const newErrors: Record<string, ValidationKey> = {};

    if (touched.login) {
      const usernameOrEmailError = validateLogin(usernameOrEmail);
      if (usernameOrEmailError) {
        newErrors.usernameOrEmail = usernameOrEmailError;
      }
    }

    if (touched.password && !password) {
      newErrors.password = 'password.required';
    }

    setErrors(newErrors);
  }, [usernameOrEmail, password, touched]);

  const isFormValid = usernameOrEmail.trim().length > 0 && password.length > 0;

  const handleFieldChange = (field: 'login' | 'password', value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field === 'login') setUsernameOrEmail(value);
    if (field === 'password') setPassword(value);
  };

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: loginUserFn,
    onSuccess: (data: ILoginResponse) => {
      setUser(data);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    // Mark all fields as touched for validation display
    setTouched({ login: true, password: true });

    if (!isFormValid) {
      toast.error(t('login.toast.missingFields'));
      return;
    }

    mutate({ login: usernameOrEmail.trim(), password });
  }

  useEffect(() => {
    if (isSuccess) {
      // Success animation
      gsap.to(cardRef.current, {
        duration: 0.3,
        scale: 1.05,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
      });

      toast.success(t('login.toast.success'));
      setTimeout(() => {
        navigate('/');
      }, 500);
    }
  }, [navigate, isSuccess, t]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-base-200 via-base-300 to-base-200 overflow-hidden pt-20">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Side - Hero Content */}
          <div className="hidden lg:block space-y-8 p-8">
            <div className="space-y-6">
              <div className="inline-block">
                <span className="badge badge-primary badge-lg gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  {t('login.badge')}
                </span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                <Trans
                  t={t}
                  i18nKey="login.title"
                  components={{
                    hl: (
                      <span className="block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" />
                    ),
                  }}
                />
              </h1>

              <p className="text-xl text-base-content/70 leading-relaxed">
                {t('login.subtitle', {
                  learners: t(getLearnerCountKey(stats?.totalUsers)),
                })}
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-base-100/50 backdrop-blur-sm border border-base-300/50 hover:border-primary/50 transition-all">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">
                    {t('login.features.progress.title')}
                  </h3>
                  <p className="text-sm text-base-content/60">
                    {t('login.features.progress.description')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-base-100/50 backdrop-blur-sm border border-base-300/50 hover:border-secondary/50 transition-all">
                <div className="p-2 bg-secondary/10 rounded-lg flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-secondary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">
                    {t('login.features.levelUp.title')}
                  </h3>
                  <p className="text-sm text-base-content/60">
                    {t('login.features.levelUp.description')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-base-100/50 backdrop-blur-sm border border-base-300/50 hover:border-accent/50 transition-all">
                <div className="p-2 bg-accent/10 rounded-lg flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">
                    {t('login.features.clubs.title')}
                  </h3>
                  <p className="text-sm text-base-content/60">
                    {t('login.features.clubs.description')}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center p-4 rounded-lg bg-base-100/30 backdrop-blur-sm">
                <div className="text-3xl font-bold text-primary">
                  {stats?.totalUsers ? formatCompact(stats.totalUsers) : '...'}
                </div>
                <div className="text-xs text-base-content/60 mt-1">
                  {t('hero.stats.totalUsers')}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-base-100/30 backdrop-blur-sm">
                <div className="text-3xl font-bold text-secondary">
                  {stats?.totalXp ? formatCompact(stats.totalXp) : '...'}
                </div>
                <div className="text-xs text-base-content/60 mt-1">
                  {t('hero.stats.xpEarned')}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-base-100/30 backdrop-blur-sm">
                <div className="text-3xl font-bold text-accent">
                  {stats?.totalLogs ? formatCompact(stats.totalLogs) : '...'}
                </div>
                <div className="text-xs text-base-content/60 mt-1">
                  {t('hero.stats.logsTracked')}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="flex justify-center lg:justify-end">
            <div
              ref={cardRef}
              className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-300/50 backdrop-blur-sm"
            >
              <form className="card-body p-8" onSubmit={handleSubmit}>
                <h2
                  ref={titleRef}
                  className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
                >
                  {t('login.form.title')}
                </h2>
                <p className="text-center text-base-content/60 mb-6 text-sm">
                  {t('login.form.subtitle')}
                </p>

                {/* Username/Email Field */}
                <div ref={addToRefs} className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      {t('login.form.login.label')}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('login.form.login.placeholder')}
                    className={`input input-bordered w-full ${
                      errors.usernameOrEmail
                        ? 'input-error'
                        : touched.login &&
                            !errors.usernameOrEmail &&
                            usernameOrEmail
                          ? 'input-success'
                          : ''
                    }`}
                    value={usernameOrEmail}
                    onChange={(e) => handleFieldChange('login', e.target.value)}
                    required
                  />
                  {errors.usernameOrEmail && (
                    <label className="label">
                      <span className="label-text-alt text-error text-wrap break-words">
                        {vt(errors.usernameOrEmail)}
                      </span>
                    </label>
                  )}
                </div>

                {/* Password Field */}
                <div ref={addToRefs} className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      {t('login.form.password.label')}
                    </span>
                  </label>
                  <input
                    type="password"
                    placeholder={t('login.form.password.placeholder')}
                    className={`input input-bordered w-full ${
                      errors.password
                        ? 'input-error'
                        : touched.password && !errors.password && password
                          ? 'input-success'
                          : ''
                    }`}
                    value={password}
                    onChange={(e) =>
                      handleFieldChange('password', e.target.value)
                    }
                    required
                  />
                  {errors.password && (
                    <label className="label">
                      <span className="label-text-alt text-error text-wrap break-words">
                        {vt(errors.password)}
                      </span>
                    </label>
                  )}

                  <label className="label justify-end">
                    <Link
                      to="/forgot-password"
                      className="label-text-alt link link-hover link-primary"
                    >
                      {t('login.form.forgotPassword')}
                    </Link>
                  </label>
                </div>

                {/* Submit Button */}
                <div ref={addToRefs} className="form-control mt-4 items-center">
                  <button
                    className={`btn btn-primary btn-lg w-full transition-all duration-300 ${
                      !isFormValid || isPending
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-md hover:scale-[1.02]'
                    }`}
                    type="submit"
                    disabled={!isFormValid || isPending}
                  >
                    {isPending ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        {t('login.form.submitting')}
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                          />
                        </svg>
                        {t('login.form.submit')}
                      </>
                    )}
                  </button>
                </div>

                {/* Register Link */}
                {/* <div ref={addToRefs} className="text-center">
                  <p className="text-sm text-base-content/70">
                    Don't have an account?{' '}
                    <Link
                      to="/register"
                      className="link link-primary font-semibold hover:link-hover"
                    >
                      Create one here
                    </Link>
                  </p>
                </div> */}
              </form>
              {isPending && <Loader />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
