import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUserFn, getPublicStatsFn } from '../api/trackerApi';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ILoginResponse } from '../types';
import { useUserDataStore } from '../store/userData';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import Loader from '../components/Loader';
import { validateLogin } from '../utils/validation';
import { gsap } from 'gsap';

function LoginScreen() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ login: false, password: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  };

  // Get appropriate word based on user count
  const getUserCountWord = (count: number | undefined): string => {
    if (!count) return 'learners';
    if (count < 100) return 'learners';
    if (count < 1000) return 'hundreds of learners';
    if (count < 10000) return 'thousands of learners';
    if (count < 100000) return 'tens of thousands of learners';
    return 'hundreds of thousands of learners';
  };

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
    const newErrors: Record<string, string> = {};

    if (touched.login) {
      const usernameOrEmailError = validateLogin(usernameOrEmail);
      if (usernameOrEmailError) {
        newErrors.usernameOrEmail = usernameOrEmailError;
      }
    }

    if (touched.password && !password) {
      newErrors.password = 'Password is required';
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
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

  async function submitHandler(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Mark all fields as touched for validation display
    setTouched({ login: true, password: true });

    if (!isFormValid) {
      toast.error('Please fill in all required fields');
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

      toast.success('Login successful');
      setTimeout(() => {
        navigate('/');
      }, 500);
    }
  }, [navigate, isSuccess]);

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
                  Welcome Back
                </span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Continue Your{' '}
                <span className="block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Japanese Learning
                </span>
                Journey
              </h1>

              <p className="text-xl text-base-content/70 leading-relaxed">
                Join {getUserCountWord(stats?.totalUsers)} tracking their
                immersion, leveling up, and achieving their Japanese language
                goals.
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
                    Track Your Progress
                  </h3>
                  <p className="text-sm text-base-content/60">
                    Monitor your daily and long-term immersion goals
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
                    Level Up & Compete
                  </h3>
                  <p className="text-sm text-base-content/60">
                    Earn XP, climb leaderboards, and stay motivated
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
                    Join Your Clubs
                  </h3>
                  <p className="text-sm text-base-content/60">
                    Connect with your learning communities and friends
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center p-4 rounded-lg bg-base-100/30 backdrop-blur-sm">
                <div className="text-3xl font-bold text-primary">
                  {stats?.totalUsers ? formatNumber(stats.totalUsers) : '...'}
                </div>
                <div className="text-xs text-base-content/60 mt-1">
                  Total Users
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-base-100/30 backdrop-blur-sm">
                <div className="text-3xl font-bold text-secondary">
                  {stats?.totalXp ? formatNumber(stats.totalXp) : '...'}
                </div>
                <div className="text-xs text-base-content/60 mt-1">
                  XP Earned
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-base-100/30 backdrop-blur-sm">
                <div className="text-3xl font-bold text-accent">
                  {stats?.totalLogs ? formatNumber(stats.totalLogs) : '...'}
                </div>
                <div className="text-xs text-base-content/60 mt-1">
                  Logs Tracked
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
              <form className="card-body p-8" onSubmit={submitHandler}>
                <h2
                  ref={titleRef}
                  className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
                >
                  Welcome Back
                </h2>
                <p className="text-center text-base-content/60 mb-6 text-sm">
                  Sign in to continue your journey! 🚀
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
                      Username or Email
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your username or email"
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
                        {errors.usernameOrEmail}
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
                      Password
                    </span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
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
                        {errors.password}
                      </span>
                    </label>
                  )}

                  <label className="label justify-end">
                    <Link
                      to="/forgot-password"
                      className="label-text-alt link link-hover link-primary"
                    >
                      Forgot password?
                    </Link>
                  </label>
                </div>

                {/* Submit Button */}
                <div ref={addToRefs} className="form-control mt-4 items-center">
                  <button
                    className={`btn btn-primary btn-lg w-full transition-all duration-300 ${
                      !isFormValid || isPending
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-lg hover:scale-[1.02]'
                    }`}
                    type="submit"
                    disabled={!isFormValid || isPending}
                  >
                    {isPending ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Signing In...
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
                        Sign In
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
