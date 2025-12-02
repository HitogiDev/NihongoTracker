import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUserFn, getPublicStatsFn } from '../api/trackerApi';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ILoginResponse,
  IPasswordValidation,
  IUsernameValidation,
} from '../types';
import { useUserDataStore } from '../store/userData';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import Loader from '../components/Loader';
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateUsername,
} from '../utils/validation';
import { gsap } from 'gsap';
import { getUserTimezone } from '../utils/timezone';

function RegisterScreen() {
  const { user, setUser } = useUserDataStore();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false);
  const [showUsernameRequirements, setShowUsernameRequirements] =
    useState(false);
  const navigate = useNavigate();

  // Refs for GSAP animations
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formFieldsRef = useRef<HTMLDivElement[]>([]);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Fetch public stats
  const { data: stats } = useQuery({
    queryKey: ['publicStats'],
    queryFn: getPublicStatsFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
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

  // Detailed validation states
  const [usernameValidation, setUsernameValidation] =
    useState<IUsernameValidation>({
      minLength: false,
      maxLength: true,
      validCharacters: false,
      notEmpty: false,
    });

  const [passwordValidation, setPasswordValidation] =
    useState<IPasswordValidation>({
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    });
  const recommendedTimezone = useMemo(() => getUserTimezone(), []);

  // GSAP entrance animation
  useEffect(() => {
    // Set initial state before animation
    gsap.set(cardRef.current, { y: 50, opacity: 0, scale: 0.95 });
    gsap.set(titleRef.current, { y: 20, opacity: 0 });
    gsap.set(formFieldsRef.current, { y: 20, opacity: 0 });

    const tl = gsap.timeline({ delay: 0.1 });

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

  // Update detailed validation states
  useEffect(() => {
    setUsernameValidation({
      notEmpty: username.trim().length > 0,
      minLength: username.length >= 3,
      maxLength: username.length <= 20,
      validCharacters: /^[a-zA-Z0-9_-]*$/.test(username),
    });
  }, [username]);

  useEffect(() => {
    setPasswordValidation({
      minLength: password.length >= 8,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    });
  }, [password]);

  // Validate fields when they change and are touched
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (touched.username) {
      const usernameError = validateUsername(username);
      if (usernameError) newErrors.username = usernameError;
    }

    if (touched.email) {
      const emailError = validateEmail(email);
      if (emailError) newErrors.email = emailError;
    }

    if (touched.password) {
      const passwordError = validatePassword(password);
      if (passwordError) newErrors.password = passwordError;
    }

    if (touched.passwordConfirmation) {
      const passwordMatchError = validatePasswordMatch(
        password,
        passwordConfirmation
      );
      if (passwordMatchError)
        newErrors.passwordConfirmation = passwordMatchError;
    }

    setErrors(newErrors);
  }, [username, email, password, passwordConfirmation, touched]);

  const isFormValid = () => {
    return (
      username.trim().length >= 3 &&
      username.length <= 20 &&
      /^[a-zA-Z0-9_-]+$/.test(username) &&
      password.length >= 8 &&
      password === passwordConfirmation &&
      passwordConfirmation.length > 0 &&
      agreedToTerms
    );
  };

  const handleFieldChange = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field === 'username') setUsername(value);
    if (field === 'email') setEmail(value);
    if (field === 'password') setPassword(value);
    if (field === 'passwordConfirmation') setPasswordConfirmation(value);
  };

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: registerUserFn,
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

    // Mark all fields as touched for final validation
    setTouched({ username: true, password: true, passwordConfirmation: true });

    if (!isFormValid()) {
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    mutate({
      username,
      email,
      password,
      passwordConfirmation,
      timezone: recommendedTimezone,
    });
  }

  useEffect(() => {
    if (isSuccess) {
      // Success animation
      gsap.to(cardRef.current, {
        duration: 0.5,
        scale: 1.05,
        ease: 'back.out(2)',
        onComplete: () => {
          gsap.to(cardRef.current, {
            duration: 0.3,
            scale: 1,
            ease: 'power2.inOut',
          });
        },
      });

      toast.success('Registration successful! Welcome aboard! 🎉');

      setTimeout(() => {
        navigate('/');
      }, 1000);
    }
  }, [navigate, isSuccess]);

  const addToRefs = (el: HTMLDivElement | null) => {
    if (el && !formFieldsRef.current.includes(el)) {
      formFieldsRef.current.push(el);
    }
  };

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
                  Start Your Journey
                </span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Track Your
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
                    Track Everything
                  </h3>
                  <p className="text-sm text-base-content/60">
                    Anime, manga, reading, listening, and more - all in one
                    place
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
                    Earn XP, maintain streaks, and climb the leaderboards
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
                    Join the Community
                  </h3>
                  <p className="text-sm text-base-content/60">
                    Create clubs, share progress, and learn together
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

          {/* Right Side - Registration Form */}
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
                  Create Account
                </h2>
                <p className="text-center text-base-content/60 mb-6 text-sm">
                  Join NihongoTracker and start your journey! 🚀
                </p>

                {/* Username Field */}
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
                      Username
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Choose a unique username"
                    className={`input input-bordered w-full transition-all duration-300 ${
                      errors.username
                        ? 'input-error focus:input-error'
                        : touched.username && !errors.username && username
                          ? 'input-success focus:input-success'
                          : 'focus:input-primary'
                    }`}
                    value={username}
                    onChange={(e) =>
                      handleFieldChange('username', e.target.value)
                    }
                    onFocus={() => setShowUsernameRequirements(true)}
                    onBlur={() =>
                      setTimeout(() => setShowUsernameRequirements(false), 150)
                    }
                    required
                  />
                  {errors.username && (
                    <label className="label">
                      <span className="label-text-alt text-error text-wrap break-words flex items-center gap-1">
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
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {errors.username}
                      </span>
                    </label>
                  )}

                  {showUsernameRequirements && (
                    <div className="mt-2 p-3 bg-base-200 rounded-box text-xs animate-fadeIn border border-base-300">
                      <p className="font-semibold mb-2 text-base-content">
                        Username Requirements:
                      </p>
                      <ul className="space-y-1.5">
                        <li
                          className={`flex items-center gap-2 transition-colors ${usernameValidation.notEmpty ? 'text-success' : 'text-base-content/60'}`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${usernameValidation.notEmpty ? 'bg-success/20' : 'bg-base-300'}`}
                          >
                            {usernameValidation.notEmpty ? (
                              <svg
                                className="w-3 h-3 text-success"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-base-content/30"></div>
                            )}
                          </div>
                          Not empty
                        </li>
                        <li
                          className={`flex items-center gap-2 transition-colors ${usernameValidation.minLength ? 'text-success' : 'text-base-content/60'}`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${usernameValidation.minLength ? 'bg-success/20' : 'bg-base-300'}`}
                          >
                            {usernameValidation.minLength ? (
                              <svg
                                className="w-3 h-3 text-success"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-base-content/30"></div>
                            )}
                          </div>
                          At least 3 characters
                        </li>
                        <li
                          className={`flex items-center gap-2 transition-colors ${usernameValidation.maxLength ? 'text-success' : 'text-error'}`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${usernameValidation.maxLength ? 'bg-success/20' : 'bg-error/20'}`}
                          >
                            {usernameValidation.maxLength ? (
                              <svg
                                className="w-3 h-3 text-success"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-3 h-3 text-error"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            )}
                          </div>
                          Maximum 20 characters
                        </li>
                        <li
                          className={`flex items-center gap-2 transition-colors ${usernameValidation.validCharacters ? 'text-success' : 'text-base-content/60'}`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${usernameValidation.validCharacters ? 'bg-success/20' : 'bg-base-300'}`}
                          >
                            {usernameValidation.validCharacters ? (
                              <svg
                                className="w-3 h-3 text-success"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-base-content/30"></div>
                            )}
                          </div>
                          Only letters, numbers, hyphens, and underscores
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Email Field */}
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
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      Email
                    </span>
                    <span className="label-text-alt badge badge-ghost badge-sm">
                      Optional
                    </span>
                  </label>
                  <input
                    type="email"
                    placeholder="your.email@example.com"
                    className={`input input-bordered w-full transition-all duration-300 ${
                      errors.email
                        ? 'input-error focus:input-error'
                        : touched.email && !errors.email && email
                          ? 'input-success focus:input-success'
                          : 'focus:input-primary'
                    }`}
                    value={email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                  />
                  {errors.email && (
                    <label className="label">
                      <span className="label-text-alt text-error flex items-center gap-1">
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
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {errors.email}
                      </span>
                    </label>
                  )}
                  <label className="label">
                    <span className="label-text-alt text-base-content/60 text-xs">
                      Recommended for account recovery & password reset
                    </span>
                  </label>
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
                    placeholder="Create a strong password"
                    className={`input input-bordered w-full transition-all duration-300 ${
                      errors.password
                        ? 'input-error focus:input-error'
                        : touched.password && !errors.password && password
                          ? 'input-success focus:input-success'
                          : 'focus:input-primary'
                    }`}
                    value={password}
                    onChange={(e) =>
                      handleFieldChange('password', e.target.value)
                    }
                    onFocus={() => setShowPasswordRequirements(true)}
                    onBlur={() =>
                      setTimeout(() => setShowPasswordRequirements(false), 150)
                    }
                    required
                  />
                  {errors.password && (
                    <label className="label">
                      <span className="label-text-alt text-error flex items-center gap-1">
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
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {errors.password}
                      </span>
                    </label>
                  )}

                  {showPasswordRequirements && (
                    <div className="mt-2 p-3 bg-base-200 rounded-box text-xs animate-fadeIn border border-base-300">
                      <p className="font-semibold mb-2 text-base-content">
                        Password Requirements:
                      </p>
                      <ul className="space-y-1.5">
                        <li
                          className={`flex items-center gap-2 transition-colors ${passwordValidation.minLength ? 'text-success' : 'text-base-content/60'}`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${passwordValidation.minLength ? 'bg-success/20' : 'bg-base-300'}`}
                          >
                            {passwordValidation.minLength ? (
                              <svg
                                className="w-3 h-3 text-success"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-base-content/30"></div>
                            )}
                          </div>
                          At least 8 characters
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Password Confirmation Field */}
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Confirm Password
                    </span>
                  </label>
                  <input
                    type="password"
                    placeholder="Re-enter your password"
                    className={`input input-bordered w-full transition-all duration-300 ${
                      errors.passwordConfirmation
                        ? 'input-error focus:input-error'
                        : touched.passwordConfirmation &&
                            !errors.passwordConfirmation &&
                            passwordConfirmation
                          ? 'input-success focus:input-success'
                          : 'focus:input-primary'
                    }`}
                    value={passwordConfirmation}
                    onChange={(e) =>
                      handleFieldChange('passwordConfirmation', e.target.value)
                    }
                    required
                  />
                  {errors.passwordConfirmation && (
                    <label className="label">
                      <span className="label-text-alt text-error flex items-center gap-1">
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
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {errors.passwordConfirmation}
                      </span>
                    </label>
                  )}
                </div>

                {/* Terms and Conditions */}
                <div ref={addToRefs} className="form-control">
                  <label className="label cursor-pointer justify-start gap-3 items-start p-3 rounded-lg hover:bg-base-200/50 transition-colors">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary mt-0.5 flex-shrink-0"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                    />
                    <span className="label-text text-sm text-left leading-relaxed">
                      I agree to the{' '}
                      <Link
                        to="/terms"
                        className="link link-primary font-semibold hover:link-hover"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link
                        to="/privacy"
                        className="link link-primary font-semibold hover:link-hover"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <div ref={addToRefs} className="form-control mt-4 items-center">
                  <button
                    className={`btn btn-primary btn-lg w-full transition-all duration-300 ${
                      !isFormValid() || isPending
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-lg hover:scale-[1.02]'
                    }`}
                    type="submit"
                    disabled={!isFormValid() || isPending}
                  >
                    {isPending ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Creating your account...
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
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                        Create Account
                      </>
                    )}
                  </button>
                </div>

                {/* Login Link */}
                <div
                  ref={addToRefs}
                  className="divider text-xs text-base-content/60"
                >
                  OR
                </div>

                <div ref={addToRefs} className="text-center">
                  <p className="text-sm text-base-content/70">
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="link link-primary font-semibold hover:link-hover"
                    >
                      Sign in here
                    </Link>
                  </p>
                </div>
              </form>
              {isPending && <Loader />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterScreen;
